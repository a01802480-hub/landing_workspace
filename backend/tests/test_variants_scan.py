"""Offline tests for the all-substitutions variant scan.

No external services are contacted: uniprot/alphafold/alphamissense/vep
boundaries are monkeypatched at the service level.  The scan runs on a
module worker loop, so tests poll the job store until terminal.
"""
from __future__ import annotations

import time

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services import alphafold, alphamissense, uniprot, variantscan, vep

FAKE_ENTRY = {
    "accession": "P18858",
    "gene": "LIG1",
    "name": "DNA ligase 1",
    "organism": "Homo sapiens",
    "length": 100,
    "sequence": "M" * 100,
    "ensembl_gene": "ENSG00000000001",
}

FAKE_MODEL = {
    "mean_plddt": 78.1,
    "points": [{"resi": i, "plddt": 60.0 + i} for i in range(1, 101)],
}

FAKE_AM_ROW = {"aa": "M", "mean": 0.97, "pathogenic": "1:L,K", "ambiguous": "1:Q", "benign": "1:G"}


def make_app(**overrides) -> TestClient:
    kwargs = {"_env_file": None, "cors_origins": "http://localhost:3000", **overrides}
    return TestClient(create_app(Settings(**kwargs)))


def _post(client: TestClient, path: str, payload: dict):
    if not client.cookies.get("protheon_csrf"):
        client.get("/api/health")
    return client.post(path, json=payload, headers={"X-CSRF-Token": client.cookies.get("protheon_csrf")})


def _wait_terminal(client: TestClient, job_id: str, timeout: float = 30.0) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        body = client.get(f"/api/variants/scan/{job_id}").json()
        if body["status"] in ("done", "error"):
            return body
        last = body
        time.sleep(0.3)
    raise AssertionError(f"scan {job_id} did not reach a terminal state within {timeout}s; last body: {last}")


def test_scan_happy_path(monkeypatch) -> None:
    async def fake_entry(acc: str) -> dict:
        return FAKE_ENTRY

    async def fake_model(acc: str) -> dict:
        return FAKE_MODEL

    async def fake_row(acc: str, pos: int) -> dict | None:
        return FAKE_AM_ROW

    async def fake_batch(symbol: str, notations: list[str], ensembl_gene: str | None = None) -> dict:
        return {"status": "ok", "results": {f"p.M{i}L": {"sift": {"score": 0.01, "prediction": "deleterious"}} for i in range(1, 3)}}

    monkeypatch.setattr(uniprot, "fetch_entry", fake_entry)
    monkeypatch.setattr(alphafold, "fetch_model", fake_model)
    monkeypatch.setattr(variantscan, "fetch_row", fake_row)  # direct import binding
    monkeypatch.setattr(vep, "predict_batch", fake_batch)

    with make_app() as client:
        started = _post(client, "/api/variants/scan", {"uniprot_id": "P18858", "start": 1, "end": 5})
        assert started.status_code == 200, started.text
        job_id = started.json()["job_id"]
        body = _wait_terminal(client, job_id)

    assert body["status"] == "done"
    assert body["progress"] == {"scanned": 5, "total": 5}
    assert len(body["positions"]) == 5
    first = body["positions"][0]
    assert first["ref"] == "M"
    assert first["plddt"]["status"] == "ok"
    assert first["alphamissense"]["status"] == "ok"
    # 19 substitutions per position minus the ref (M) = 19, minus non-listed (only L,K,Q,G listed)
    assert len(first["alphamissense"]["substitutions"]) == 4
    assert body["vep_applied"] is True


def test_scan_per_position_degradation(monkeypatch) -> None:
    async def fake_entry(acc: str) -> dict:
        return FAKE_ENTRY

    async def fake_model(acc: str) -> dict:
        return FAKE_MODEL

    async def flaky_row(acc: str, pos: int) -> dict | None:
        if pos == 3:
            raise RuntimeError("upstream down")
        return FAKE_AM_ROW

    async def fake_batch(symbol: str, notations: list[str], ensembl_gene: str | None = None) -> dict:
        return {"status": "unavailable", "detail": "offline"}

    monkeypatch.setattr(uniprot, "fetch_entry", fake_entry)
    monkeypatch.setattr(alphafold, "fetch_model", fake_model)
    monkeypatch.setattr(variantscan, "fetch_row", flaky_row)  # direct import binding
    monkeypatch.setattr(vep, "predict_batch", fake_batch)

    with make_app() as client:
        started = _post(client, "/api/variants/scan", {"uniprot_id": "P18858", "start": 1, "end": 5})
        body = _wait_terminal(client, started.json()["job_id"])

    assert body["status"] == "done"
    assert body["positions"][2]["alphamissense"]["status"] == "unavailable"
    assert body["positions"][0]["alphamissense"]["status"] == "ok"


def test_scan_window_validation(monkeypatch) -> None:
    long_entry = {**FAKE_ENTRY, "length": 1000, "sequence": "M" * 1000}

    async def fake_entry(acc: str) -> dict:
        return long_entry

    async def fake_model(acc: str) -> dict:
        return FAKE_MODEL

    async def fake_row(acc: str, pos: int) -> dict | None:
        return FAKE_AM_ROW

    async def fake_batch(symbol: str, notations: list[str], ensembl_gene: str | None = None) -> dict:
        return {"status": "unavailable", "detail": "offline"}

    monkeypatch.setattr(uniprot, "fetch_entry", fake_entry)
    monkeypatch.setattr(variantscan, "fetch_row", fake_row)
    monkeypatch.setattr(alphafold, "fetch_model", fake_model)
    monkeypatch.setattr(vep, "predict_batch", fake_batch)
    with make_app() as client:
        # Inverted window
        started = _post(client, "/api/variants/scan", {"uniprot_id": "P18858", "start": 10, "end": 2})
        assert started.status_code == 200
        body = _wait_terminal(client, started.json()["job_id"])
        assert body["status"] == "error"

        # Oversized window (> 500 positions)
        started = _post(client, "/api/variants/scan", {"uniprot_id": "P18858", "start": 1, "end": 501})
        assert started.status_code == 200
        body = _wait_terminal(client, started.json()["job_id"])
        assert body["status"] == "error"

        # Unknown job id
        assert client.get("/api/variants/scan/not-a-job").status_code == 404
        # Bad accession pattern
        assert _post(client, "/api/variants/scan", {"uniprot_id": "not-valid"}).status_code == 422
