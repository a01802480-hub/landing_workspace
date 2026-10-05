"""Offline tests for the CRISPR guide scanner and the design job routes.

No external services are contacted — the local scoring core is pure, and
the route tests run against the in-memory job store. The Nextflow demo
simulator is covered here too (deterministic, no Tower token required).
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services import crispr, nextflow


def make_app(**overrides) -> TestClient:
    kwargs = {"_env_file": None, "cors_origins": "http://localhost:3000", **overrides}
    return TestClient(create_app(Settings(**kwargs)))


def _post(client: TestClient, path: str, payload: dict):
    """POST with the CSRF double-submit token (a safe GET plants the cookie)."""
    if not client.cookies.get("protheon_csrf"):
        client.get("/api/health")
    return client.post(path, json=payload, headers={"X-CSRF-Token": client.cookies.get("protheon_csrf")})


# ── Scanner core ────────────────────────────────────────────────────────────

def _target() -> str:
    """300-nt target with a guaranteed PAM on each strand:
    AGG at index 25 (plus-strand guide) and CCT at index 160 (its reverse
    complement carries NGG, so the minus-strand scan finds a guide too).
    Index 175 is flipped to break the ACGT periodicity inside the
    minus-strand spacer window — in the pure tandem repeat the two spacers
    are identical and the dedupe keeps only the first (plus) one."""
    seq = list("ACGT" * 75)
    seq[25:28] = list("AGG")
    seq[160:163] = list("CCT")
    seq[175] = "C"
    return "".join(seq)


def test_scan_finds_guides_on_both_strands() -> None:
    """A target with PAMs in both orientations must yield guides from both
    strands, each with a valid 20-nt spacer, and scores inside 0–100."""
    seq = _target()
    guides = crispr.scan_guides(seq, "crispr_gate", "TEST", "Homo sapiens")
    assert guides, "expected guides from the constructed target"
    assert {g["strand"] for g in guides} == {"+", "-"}
    for g in guides[:5]:
        assert len(g["sequence"]) == 20
        assert 0 <= g["on_target_score"] <= 100
        assert g["start"] >= 1 and g["end"] <= len(seq)


def test_scan_rejects_invalid_input() -> None:
    try:
        crispr.scan_guides("ACGT" * 10 + "X" * 40, "chopchop", "T", "org")
        raise AssertionError("expected CrisprError for non-ACGTN input")
    except crispr.CrisprError:
        pass


def test_scan_deduplicates_repeated_spacers() -> None:
    """Four tandem copies of the same motif produce identical spacers —
    the scanner keeps one guide per spacer sequence."""
    half = "ACGTAACCGGTTAACGGTTA"
    seq = (half * 4) + "CC" + (half[::-1] * 4)
    guides = crispr.scan_guides(seq, "crispr_gate", "T", "org")
    spacers = [g["sequence"] for g in guides]
    assert len(spacers) == len(set(spacers))


def test_unenriched_guides_carry_honest_note() -> None:
    """Without an upstream off-target source every guide must say so —
    off-target counts are never fabricated."""
    seq = "G" * 300
    guides = crispr.enrich_off_targets(crispr.scan_guides(seq, "chopchop", "T", "org"), "chopchop")
    for g in guides:
        assert g["off_target_count"] == 0
        assert "unavailable" in (g["efficiency_note"] or "")


# ── Routes ──────────────────────────────────────────────────────────────────

def test_design_job_roundtrip() -> None:
    client = make_app()
    seq = "G" * 300
    started = _post(
        client,
        "/api/crispr/design",
        {"tool": "crispr_gate", "sequence": seq, "gene_label": "TEST", "organism": "Homo sapiens"},
    )
    assert started.status_code == 200, started.text
    job_id = started.json()["job_id"]
    status = client.get(f"/api/crispr/design/{job_id}")
    assert status.status_code == 200
    body = status.json()
    assert body["status"] == "done"
    assert len(body["results"]) > 0


def test_design_rejects_hostile_payloads() -> None:
    client = make_app()
    # Non-ACGTN input, overlong sequence, unknown tool — all 422, fail-closed.
    for payload in (
        {"tool": "chopchop", "sequence": "A" * 90 + "Z" * 10},
        {"tool": "chopchop", "sequence": "A" * 100001},
        {"tool": "other_tool", "sequence": "G" * 300},
    ):
        resp = _post(client, "/api/crispr/design", payload)
        assert resp.status_code == 422, payload


def test_design_region_bridge() -> None:
    """The canvas → tool bridge: a selected region scopes the scan and the
    returned guide coordinates stay inside it (region-relative)."""
    client = make_app()
    seq = _target()
    region = (100, 250)
    started = _post(
        client,
        "/api/crispr/design",
        {"tool": "crispr_gate", "sequence": seq, "region_start": region[0], "region_end": region[1]},
    )
    assert started.status_code == 200, started.text
    body = client.get(f"/api/crispr/design/{started.json()['job_id']}").json()
    assert body["status"] == "done"
    for g in body["results"]:
        assert g["start"] >= 1 and g["end"] <= region[1] - region[0] + 1

    # Half-specified / inverted / out-of-bounds regions are 422.
    for region_payload in (
        {"region_start": 10},
        {"region_start": 200, "region_end": 100},
        {"region_start": 1, "region_end": len(seq) + 1},
    ):
        resp = _post(client, "/api/crispr/design", {"tool": "chopchop", "sequence": seq, **region_payload})
        assert resp.status_code == 422, region_payload


# ── Nextflow demo simulator ─────────────────────────────────────────────────

def test_nextflow_demo_run_reaches_success() -> None:
    client = make_app()
    catalogs = client.get("/api/nextflow/pipelines")
    assert catalogs.status_code == 200
    names = [p["name"] for p in catalogs.json()["pipelines"]]
    assert "crispr-knockout" in names

    launched = _post(client, "/api/nextflow/runs", {"pipeline": "crispr-knockout", "params": {"target": "BRCA1"}})
    assert launched.status_code == 200
    run_id = launched.json()["run_id"]

    # Force the demo clock: the simulator derives status from elapsed time.
    run = nextflow._runs[run_id]
    run["started_at"] -= 1_000  # 1 000 s ago — every step is done
    status = client.get(f"/api/nextflow/runs/{run_id}").json()
    assert status["run"]["status"] == "succeeded"
    assert status["run"]["source"] == "demo"
    assert all(s["status"] == "succeeded" for s in status["steps"])
    assert status["log_tail"], "a finished run always has log lines"


def test_nextflow_demo_failure_path() -> None:
    client = make_app()
    launched = _post(
        client,
        "/api/nextflow/runs",
        {"pipeline": "crispr-knockout", "params": {"simulate_failure": "true"}},
    )
    run_id = launched.json()["run_id"]
    nextflow._runs[run_id]["started_at"] -= 1_000
    status = client.get(f"/api/nextflow/runs/{run_id}").json()
    assert status["run"]["status"] == "failed"
    assert status["steps"][-1]["status"] == "failed"
