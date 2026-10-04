"""Offline tests for the Clustal Omega MSA service and comparative route.

No external services are contacted — the EBI Clustal Omega REST endpoints are
faked at the httpx boundary, the same boundary the service talks to. The
alignment fixture is a real CLUSTAL-format document (two blocks, three
sequences, 22 columns).
"""
from __future__ import annotations

import asyncio

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services import clustal
from app.services.clustal import ClustalError, parse_clustal

MSA_PATH = "/api/comparative/msa"

ALIGNMENT_FIXTURE = """CLUSTAL O(1.2.4) multiple sequence alignment


human    MKTAYIAKQRQ
whale    MKTAYIAKQRQ
mouse    MKSAYIAKQRQ
              * ***

human    ISFVKSHFSRQ
whale    ISFVKSHFSRQ
mouse    ISFVKSHFSR-
              *** ***
"""


def make_app(**overrides) -> TestClient:
    kwargs = {"_env_file": None, "cors_origins": "http://localhost:3000", **overrides}
    return TestClient(create_app(Settings(**kwargs)))


def csrf_post(client, path, json, token=None):
    tok = token if token is not None else client.cookies.get("protheon_csrf")
    return client.post(path, json=json, headers={"X-CSRF-Token": tok})


def _payload(n: int = 3, sequence: str = "MKTAYIAKQRQ") -> dict:
    return {"sequences": [{"id": f"seq{i + 1}", "sequence": sequence} for i in range(n)]}


class FakeResponse:
    def __init__(self, status_code: int = 200, text: str = "") -> None:
        self.status_code = status_code
        self.text = text


class FakeEbi:
    """In-memory stand-in for the EBI Clustal Omega endpoints.

    `status` and `alignment` are mutated by tests to move a job from RUNNING
    to FINISHED (or ERROR); call counters let tests assert the polling design
    (at most one status call per GET, caching, etc.).
    """

    def __init__(self, *, run_id: str = "clustalo-20260930-0001", status: str = "RUNNING") -> None:
        self.run_id = run_id
        self.status = status
        self.alignment = ALIGNMENT_FIXTURE
        self.run_calls = 0
        self.status_calls = 0
        self.result_calls = 0
        self.run_status_code = 200
        self.last_form: dict | None = None

    async def post(self, url, *args, **kwargs):
        self.run_calls += 1
        self.last_form = kwargs.get("data")
        return FakeResponse(self.run_status_code, self.run_id)

    async def get(self, url, *args, **kwargs):
        if "/status/" in url:
            self.status_calls += 1
            return FakeResponse(200, self.status)
        if "/result/" in url:
            self.result_calls += 1
            return FakeResponse(200, self.alignment)
        return FakeResponse(404, "")


def install(monkeypatch, fake: FakeEbi) -> FakeEbi:
    monkeypatch.setattr(httpx.AsyncClient, "post", fake.post)
    monkeypatch.setattr(httpx.AsyncClient, "get", fake.get)
    return fake


@pytest.fixture(autouse=True)
def _isolate_state():
    """Job table and 24 h result cache are module-level — isolate every test."""
    clustal._jobs.clear()
    clustal._result_cache._data.clear()
    yield
    clustal._jobs.clear()
    clustal._result_cache._data.clear()


# ── Strict CLUSTAL parsing ─────────────────────────────────────────────────


class TestParseClustal:
    def test_blocks_append_and_width_is_consistent(self):
        result = parse_clustal(ALIGNMENT_FIXTURE)
        ids = [entry["id"] for entry in result["alignment"]]
        assert ids == ["human", "whale", "mouse"]
        widths = {len(entry["sequence"]) for entry in result["alignment"]}
        assert widths == {22}
        assert result["alignment"][0]["sequence"] == "MKTAYIAKQRQISFVKSHFSRQ"

    def test_conservation_consensus_and_identity(self):
        result = parse_clustal(ALIGNMENT_FIXTURE)
        assert len(result["conservation"]) == 22
        assert all(0.0 <= c <= 1.0 for c in result["conservation"])
        # Column 2 is T/T/S → 2/3; the gap column (21) is Q/Q/- → 2/3.
        assert result["conservation"][2] == pytest.approx(2 / 3, abs=1e-3)
        assert result["conservation"][21] == pytest.approx(2 / 3, abs=1e-3)
        assert len(result["consensus"]) == 22
        matrix = result["identity_matrix"]
        assert len(matrix) == 3 and all(len(row) == 3 for row in matrix)
        assert [matrix[i][i] for i in range(3)] == [100.0, 100.0, 100.0]
        assert matrix == [list(row) for row in zip(*matrix)]  # symmetric
        assert matrix[0][1] == 100.0
        assert matrix[0][2] < 100.0

    def test_all_gap_column_scores_zero(self):
        text = "CLUSTAL O(1.2.4) multiple sequence alignment\n\na  MK-\nb  MK-\n"
        result = parse_clustal(text)
        assert result["conservation"][2] == 0.0
        assert result["consensus"] == "MK-"

    def test_numbered_variant_tolerated(self):
        # EBI's aln-clustal_num output carries residue numbers.
        text = (
            "CLUSTAL O(1.2.4) multiple sequence alignment\n\n"
            "human    1 MKTAYIAKQRQ 11\n"
            "whale    1 MKTAYIAKQRQ 11\n"
        )
        result = parse_clustal(text)
        assert [len(e["sequence"]) for e in result["alignment"]] == [11, 11]

    def test_ragged_widths_rejected(self):
        with pytest.raises(ClustalError):
            parse_clustal("CLUSTAL\na  MKTA\nb  MKT\n")

    def test_single_sequence_rejected(self):
        with pytest.raises(ClustalError):
            parse_clustal("CLUSTAL\na  MKTA\n")

    def test_hostile_id_rejected(self):
        with pytest.raises(ClustalError):
            parse_clustal("CLUSTAL\n<script>  MKTA\nother  MKTA\n")

    def test_blank_input_rejected(self):
        with pytest.raises(ClustalError):
            parse_clustal("")


# ── Submit route ───────────────────────────────────────────────────────────


class TestMsaSubmit:
    def test_valid_submission_returns_job_id(self, monkeypatch):
        fake = install(monkeypatch, FakeEbi())
        with make_app() as client:
            client.get("/api/health")
            resp = csrf_post(client, MSA_PATH, _payload())
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "running"
        assert clustal._EBI_JOB_RE.fullmatch(body["job_id"])
        assert fake.run_calls == 1

    def test_post_without_csrf_is_403(self, monkeypatch):
        install(monkeypatch, FakeEbi())
        with make_app() as client:
            resp = client.post(MSA_PATH, json=_payload())
        assert resp.status_code == 403

    @pytest.mark.parametrize(
        "payload",
        [
            {"sequences": [{"id": "bad id!", "sequence": "MKTA"}, {"id": "b", "sequence": "MKTA"}]},
            {"sequences": [{"id": "", "sequence": "MKTA"}, {"id": "b", "sequence": "MKTA"}]},
            {"sequences": [{"id": "a" * 41, "sequence": "MKTA"}, {"id": "b", "sequence": "MKTA"}]},
            {"sequences": [{"id": "a", "sequence": "mktayia"}, {"id": "b", "sequence": "MKTA"}]},
            {"sequences": [{"id": "a", "sequence": ""}, {"id": "b", "sequence": "MKTA"}]},
            {"sequences": [{"id": "a", "sequence": "MKTA IA"}, {"id": "b", "sequence": "MKTA"}]},
            {"sequences": [{"id": "a", "sequence": "A" * 2001}, {"id": "b", "sequence": "MKTA"}]},
            {"sequences": [{"id": "only", "sequence": "MKTA"}]},
            {"sequences": [{"id": f"s{i}", "sequence": "MKTA"} for i in range(51)]},
        ],
    )
    def test_invalid_bodies_rejected_422(self, monkeypatch, payload):
        install(monkeypatch, FakeEbi())
        with make_app() as client:
            client.get("/api/health")
            resp = csrf_post(client, MSA_PATH, payload)
        assert resp.status_code == 422
        assert "<script>" not in resp.text

    def test_hostile_sequence_never_echoed(self, monkeypatch):
        install(monkeypatch, FakeEbi())
        with make_app() as client:
            client.get("/api/health")
            resp = csrf_post(
                client,
                MSA_PATH,
                {"sequences": [{"id": "a", "sequence": "<script>alert(1)</script>"}, {"id": "b", "sequence": "MKTA"}]},
            )
        assert resp.status_code == 422
        assert "<script>" not in resp.text
        assert "alert(1)" not in resp.text

    def test_upstream_failure_is_502_with_fixed_detail(self, monkeypatch):
        fake = FakeEbi()
        fake.run_status_code = 500
        install(monkeypatch, fake)
        with make_app() as client:
            client.get("/api/health")
            resp = csrf_post(client, MSA_PATH, _payload())
        assert resp.status_code == 502
        assert resp.json()["detail"] == "Clustal Omega unavailable (upstream error)."

    def test_upstream_transport_error_is_502(self, monkeypatch):
        async def boom(*args, **kwargs):
            raise httpx.ConnectError("connection refused")

        monkeypatch.setattr(httpx.AsyncClient, "post", boom)
        with make_app() as client:
            client.get("/api/health")
            resp = csrf_post(client, MSA_PATH, _payload())
        assert resp.status_code == 502
        assert "refused" not in resp.text

    def test_fasta_form_is_built_from_validated_fields(self, monkeypatch):
        fake = install(monkeypatch, FakeEbi())
        with make_app() as client:
            client.get("/api/health")
            csrf_post(client, MSA_PATH, _payload(2, "MKTAYIAKQRQ"))
        assert fake.last_form is not None
        assert fake.last_form["email"] == "protheon@example.com"
        assert fake.last_form["sequence"] == ">seq1\nMKTAYIAKQRQ\n>seq2\nMKTAYIAKQRQ"


# ── Status route (polling design) ──────────────────────────────────────────


class TestMsaStatus:
    def test_running_then_done_payload_is_valid(self, monkeypatch):
        fake = install(monkeypatch, FakeEbi())
        with make_app() as client:
            client.get("/api/health")
            job_id = csrf_post(client, MSA_PATH, _payload()).json()["job_id"]

            first = client.get(f"{MSA_PATH}/{job_id}")
            assert first.status_code == 200
            assert first.json() == {"status": "running"}
            assert fake.status_calls == 1

            fake.status = "FINISHED"
            second = client.get(f"{MSA_PATH}/{job_id}")
            assert second.status_code == 200
            body = second.json()
            assert body["status"] == "done"
            result = body["result"]
            assert fake.status_calls == 2  # exactly one status call per GET
            assert fake.result_calls == 1

            widths = {len(e["sequence"]) for e in result["alignment"]}
            assert len(widths) == 1
            width = widths.pop()
            assert [e["id"] for e in result["alignment"]] == ["human", "whale", "mouse"]
            assert len(result["conservation"]) == width
            assert all(0.0 <= c <= 1.0 for c in result["conservation"])
            assert len(result["consensus"]) == width
            matrix = result["identity_matrix"]
            assert len(matrix) == 3 and all(len(row) == 3 for row in matrix)
            assert [matrix[i][i] for i in range(3)] == [100.0, 100.0, 100.0]
            assert matrix == [list(row) for row in zip(*matrix)]

            # A finished job is served from memory — no further upstream calls.
            third = client.get(f"{MSA_PATH}/{job_id}")
            assert third.json()["status"] == "done"
            assert fake.status_calls == 2
            assert fake.result_calls == 1

    def test_unknown_job_is_404(self):
        with make_app() as client:
            resp = client.get(f"{MSA_PATH}/nope-not-a-job")
        assert resp.status_code == 404

    @pytest.mark.parametrize("job_id", ["..%2F..%2Fetc", "a" * 81, "bad%20id"])
    def test_malformed_job_id_rejected(self, job_id):
        with make_app() as client:
            resp = client.get(f"{MSA_PATH}/{job_id}")
        assert resp.status_code in (404, 422)

    @pytest.mark.parametrize("remote_status", ["ERROR", "FAILURE"])
    def test_upstream_error_status_is_sticky(self, monkeypatch, remote_status):
        fake = install(monkeypatch, FakeEbi())
        with make_app() as client:
            client.get("/api/health")
            job_id = csrf_post(client, MSA_PATH, _payload()).json()["job_id"]
            fake.status = remote_status
            body = client.get(f"{MSA_PATH}/{job_id}").json()
            assert body["status"] == "error"
            assert body["detail"] == "Clustal Omega unavailable (upstream error)."
            # Sticky: the next poll answers from the job table, no upstream call.
            calls = fake.status_calls
            assert client.get(f"{MSA_PATH}/{job_id}").json()["status"] == "error"
            assert fake.status_calls == calls

    def test_transient_transport_error_is_not_sticky(self, monkeypatch):
        fake = install(monkeypatch, FakeEbi())
        with make_app() as client:
            client.get("/api/health")
            job_id = csrf_post(client, MSA_PATH, _payload()).json()["job_id"]

            async def boom(*args, **kwargs):
                raise httpx.ReadTimeout("upstream timed out")

            with monkeypatch.context() as patch:
                patch.setattr(httpx.AsyncClient, "get", boom)
                body = client.get(f"{MSA_PATH}/{job_id}").json()
            assert body == {"status": "error", "detail": "Clustal Omega unavailable (upstream error)."}

            # The job survives — a later poll still reaches the (healthy) fake.
            assert client.get(f"{MSA_PATH}/{job_id}").json() == {"status": "running"}
            assert fake.status_calls == 1

    def test_unparseable_alignment_is_error(self, monkeypatch):
        fake = install(monkeypatch, FakeEbi(status="FINISHED"))
        fake.alignment = "<html>not an alignment</html>"
        with make_app() as client:
            client.get("/api/health")
            job_id = csrf_post(client, MSA_PATH, _payload()).json()["job_id"]
            body = client.get(f"{MSA_PATH}/{job_id}").json()
        assert body == {"status": "error", "detail": "Clustal Omega unavailable (upstream error)."}

    def test_identical_submission_skips_upstream(self, monkeypatch):
        fake = install(monkeypatch, FakeEbi())
        payload = _payload()
        with make_app() as client:
            client.get("/api/health")
            first_job = csrf_post(client, MSA_PATH, payload).json()["job_id"]
            fake.status = "FINISHED"
            assert client.get(f"{MSA_PATH}/{first_job}").json()["status"] == "done"
            assert fake.run_calls == 1

            # Same ids/sequences/order → served from the 24 h content cache.
            second_job = csrf_post(client, MSA_PATH, payload).json()["job_id"]
            assert fake.run_calls == 1
            calls = fake.status_calls
            body = client.get(f"{MSA_PATH}/{second_job}").json()
            assert body["status"] == "done"
            assert body["result"]["alignment"] == parse_clustal(ALIGNMENT_FIXTURE)["alignment"]
            assert fake.status_calls == calls


# ── Job table bound ────────────────────────────────────────────────────────


class TestJobTable:
    def test_job_table_is_bounded_fifo(self, monkeypatch):
        install(monkeypatch, FakeEbi())
        # The production cap is 200; the eviction logic is the same at 3 and a
        # smaller cap keeps the test off the ~0.6 s-per-submit httpx client cost.
        monkeypatch.setattr(clustal, "_MAX_JOBS", 3)

        async def flood() -> list[str]:
            ids = []
            for i in range(5):
                # Distinct sequences so the content cache cannot collapse them.
                ids.append(
                    await clustal.submit(
                        [{"id": "a", "sequence": "MKTAYIAKQRQ" + "A" * (i % 4) + "W" * (i // 4)}]
                    )
                )
            return ids

        job_ids = asyncio.run(flood())
        assert len(clustal._jobs) == 3
        # Oldest evicted, newest retained.
        assert job_ids[0] not in clustal._jobs
        assert job_ids[1] not in clustal._jobs
        assert job_ids[-1] in clustal._jobs
