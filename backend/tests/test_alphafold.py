"""Offline tests for AlphaFold PAE validation, downsampling and routing.

No external services are contacted — upstream payloads are faked at the
parse/function boundary, the same boundary the hostile-input tests attack.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services import alphafold
from app.services.alphafold import PaeError, downsample_pae, parse_pae_json


def make_app(**overrides) -> TestClient:
    kwargs = {"_env_file": None, "cors_origins": "http://localhost:3000", **overrides}
    return TestClient(create_app(Settings(**kwargs)))


def _good_pae(n: int = 4) -> dict:
    return {
        "predicted_aligned_error": [[0.5 + i * 0.1 + j * 0.1 for j in range(n)] for i in range(n)],
        "residue_index": list(range(1, n + 1)),
        "max_predicted_aligned_error": 12.0,
    }


# ── Strict PAE parsing ─────────────────────────────────────────────────────


class TestParsePae:
    def test_valid_matrix(self):
        parsed = parse_pae_json(_good_pae(), 100)
        assert parsed["residue_index"] == [1, 2, 3, 4]
        assert parsed["pae"][0][0] == 0.5
        assert parsed["max_pae"] == 12.0
        assert parsed["mean_pae"] > 0

    def test_rejects_non_object(self):
        with pytest.raises(PaeError):
            parse_pae_json(["x"], 100)

    def test_rejects_missing_matrix(self):
        with pytest.raises(PaeError):
            parse_pae_json({"residue_index": [1]}, 100)

    def test_rejects_ragged_row(self):
        payload = _good_pae()
        payload["predicted_aligned_error"][0].append(1.0)
        with pytest.raises(PaeError):
            parse_pae_json(payload, 100)

    def test_rejects_script_payload(self):
        payload = _good_pae()
        payload["predicted_aligned_error"][1][1] = "<script>alert(1)</script>"
        with pytest.raises(PaeError):
            parse_pae_json(payload, 100)

    @pytest.mark.parametrize("bad", [float("nan"), float("inf"), -1.0, 10**9])
    def test_rejects_non_finite_or_out_of_range(self, bad):
        payload = _good_pae()
        payload["predicted_aligned_error"][0][0] = bad
        with pytest.raises(PaeError):
            parse_pae_json(payload, 100)

    def test_rejects_bool_as_number(self):
        payload = _good_pae()
        payload["predicted_aligned_error"][0][0] = True
        with pytest.raises(PaeError):
            parse_pae_json(payload, 100)

    def test_rejects_mismatched_index(self):
        payload = _good_pae()
        payload["residue_index"] = [1, 2, 3]
        with pytest.raises(PaeError):
            parse_pae_json(payload, 100)

    def test_rejects_non_integral_index(self):
        payload = _good_pae()
        payload["residue_index"][2] = "3"
        with pytest.raises(PaeError):
            parse_pae_json(payload, 100)

    def test_rejects_oversize(self):
        with pytest.raises(PaeError):
            parse_pae_json(_good_pae(8), 4)

    def test_max_falls_back_to_computed(self):
        payload = _good_pae()
        del payload["max_predicted_aligned_error"]
        parsed = parse_pae_json(payload, 100)
        assert parsed["max_pae"] == round(0.5 + 0.3 + 0.3, 3)

    def test_legacy_distance_field_accepted(self):
        payload = _good_pae()
        payload["distance"] = payload.pop("predicted_aligned_error")
        parsed = parse_pae_json(payload, 100)
        assert parsed["pae"][0][0] == 0.5

    def test_v6_entity_list_accepted(self):
        # v6: top-level list of entities, no residue_index.
        entity = _good_pae(3)
        del entity["residue_index"]
        parsed = parse_pae_json([entity], 100, residue_start=5)
        assert parsed["residue_index"] == [5, 6, 7]
        assert parsed["pae"][0][0] == 0.5

    def test_v6_entity_list_requires_start(self):
        entity = _good_pae(3)
        del entity["residue_index"]
        with pytest.raises(PaeError):
            parse_pae_json([entity], 100)

    def test_v6_entity_list_rejects_empty(self):
        with pytest.raises(PaeError):
            parse_pae_json([], 100)

    def test_v6_entity_list_rejects_junk_entry(self):
        with pytest.raises(PaeError):
            parse_pae_json([["<script>"]], 100, residue_start=1)


# ── Mean-pool downsampling ─────────────────────────────────────────────────


class TestDownsample:
    def test_small_matrix_passthrough(self):
        payload = _good_pae(3)
        index, matrix, stride = downsample_pae(payload["residue_index"], payload["predicted_aligned_error"], 10)
        assert stride == 1
        assert matrix == payload["predicted_aligned_error"]

    def test_mean_pooling(self):
        # 6×6 matrix of i*10+j → target 2 → stride 3, block means 11/14/41/44.
        n = 6
        index = list(range(1, n + 1))
        matrix = [[float(i * 10 + j) for j in range(n)] for i in range(n)]
        idx_out, out, stride = downsample_pae(index, matrix, 2)
        assert stride == 3
        assert idx_out == [2, 5]
        assert out == [[11.0, 14.0], [41.0, 44.0]]


# ── Confidence route (offline, faked service) ──────────────────────────────


class TestConfidenceRoute:
    def test_returns_validated_payload(self, monkeypatch):
        async def fake_fetch(uniprot: str) -> dict:
            return {
                "uniprot": uniprot,
                "stride": 1,
                "residue_index": [1, 2],
                "pae": [[0.5, 0.6], [0.6, 0.5]],
                "max_pae": 12.0,
                "mean_pae": 0.55,
            }

        monkeypatch.setattr(alphafold, "fetch_confidence", fake_fetch)
        with make_app() as client:
            resp = client.get("/api/structure/alphafold/P18858/confidence")
        assert resp.status_code == 200
        body = resp.json()
        assert body["uniprot"] == "P18858"
        assert body["max_pae"] == 12.0

    def test_pae_unavailable_is_404(self, monkeypatch):
        def fake_fetch(uniprot: str):
            raise PaeError(f"No PAE matrix available for {uniprot}.")

        monkeypatch.setattr(alphafold, "fetch_confidence", fake_fetch)
        # A fresh accession — the route's 24 h cache holds the previous test's
        # entry, so reusing P18858 would bypass the faked service entirely.
        with make_app() as client:
            resp = client.get("/api/structure/alphafold/Q99999/confidence")
        assert resp.status_code == 404
        assert "No PAE matrix" in resp.json()["detail"]

    def test_traversal_id_rejected(self):
        with make_app() as client:
            resp = client.get("/api/structure/alphafold/..%2F..%2Fetc/confidence")
        assert resp.status_code in (404, 422)

    @pytest.mark.parametrize("pdb_id", ["2BMY", "1X9N", "8RUC"])
    def test_pdb_ids_rejected_for_uniprot_routes(self, pdb_id):
        """A PDB ID in the UniProt field must 422 before any upstream call."""
        with make_app() as client:
            resp = client.get(f"/api/structure/alphafold/{pdb_id}")
        assert resp.status_code == 422
        with make_app() as client:
            resp = client.get(f"/api/structure/alphafold/{pdb_id}/confidence")
        assert resp.status_code == 422

    @pytest.mark.parametrize("accession", ["P18858", "Q99999", "A0A075B6P5"])
    def test_legit_accessions_pass_pattern(self, accession, monkeypatch):
        """Real accession shapes pass the path validator and the (faked)
        pipeline runs end to end — 200 with a one-atom model."""
        async def fake_meta(uniprot: str) -> dict:
            return {"entryId": f"AF-{uniprot}-F1", "pdbUrl": f"https://example.invalid/{uniprot}.pdb"}

        monkeypatch.setattr(alphafold, "_metadata", fake_meta)

        import httpx as _httpx

        atom = (
            f"ATOM  {1:5d} {' CA':>4s} {'GLY':>3s} A{1:4d}    "
            f"{0.0:8.3f}{0.0:8.3f}{0.0:8.3f}{1.0:6.2f}{42.5:6.2f}          C  "
        )

        class FakeResponse:
            status_code = 200
            text = "TITLE     fake\n" + atom + "\n"

            def raise_for_status(self):
                return None

        async def fake_get(url, *a, **k):
            return FakeResponse()

        monkeypatch.setattr(_httpx.AsyncClient, "get", fake_get)
        with make_app() as client:
            resp = client.get(f"/api/structure/alphafold/{accession}")
        # 200 only if the pattern passed and the whole pipeline ran.
        assert resp.status_code == 200
        assert resp.json()["source"] == "alphafold"
