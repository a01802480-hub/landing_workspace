"""Offline tests for the raw structure-file endpoints (cartoon viewer feed).

`/api/structure/pdb/{id}/file` and `/api/structure/alphafold/{accession}/file`
proxy the untouched PDB text to the client's 3Dmol viewer. No external service
is contacted: the fetch helpers and httpx are faked at the boundary the routes
call, and every error path is asserted to return a *fixed* message (upstream
text — URLs, stack internals — must never be echoed).

Raw files are cached module-globally for 24 h, so each test uses its own
identifier where the cache could otherwise mask the code under test.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.routes import structure
from app.services import alphafold

FAKE_PDB = (
    "TITLE     FAKE STRUCTURE\n"
    "ATOM      1  CA  GLY A   1       0.000   0.000   0.000  1.00 42.50           C\n"
    "ATOM      2  CA  ALA A   2       3.800   0.000   0.000  1.00 88.00           C\n"
    "END\n"
)


def make_app(**overrides) -> TestClient:
    kwargs = {"_env_file": None, "cors_origins": "http://localhost:3000", **overrides}
    return TestClient(create_app(Settings(**kwargs)))


class FakeResponse:
    """Minimal stand-in for httpx.Response at the helper boundary."""

    def __init__(self, text: str = FAKE_PDB, status_code: int = 200, headers: dict | None = None):
        self.text = text
        self.status_code = status_code
        self.headers = headers or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


# ── RCSB raw file route ────────────────────────────────────────────────────


class TestRcsbFileRoute:
    def test_returns_raw_pdb_passthrough(self, monkeypatch):
        async def fake_fetch(pdb_id: str) -> str:
            assert pdb_id == "1X9N"
            return FAKE_PDB

        monkeypatch.setattr(structure, "_fetch_rcsb_raw", fake_fetch)
        with make_app() as client:
            resp = client.get("/api/structure/pdb/1X9N/file")
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/plain")
        assert resp.text == FAKE_PDB  # verbatim — the viewer parses it itself

    def test_unknown_pdb_is_404_with_fixed_message(self, monkeypatch):
        async def fake_fetch(pdb_id: str) -> str:
            raise FileNotFoundError(pdb_id)

        monkeypatch.setattr(structure, "_fetch_rcsb_raw", fake_fetch)
        with make_app() as client:
            resp = client.get("/api/structure/pdb/9ZZZ/file")
        assert resp.status_code == 404
        assert "Unknown PDB ID" in resp.json()["detail"]

    def test_upstream_failure_is_502_without_echoing_upstream(self, monkeypatch):
        async def fake_fetch(pdb_id: str) -> str:
            raise RuntimeError("https://files.rcsb.org/download/X.pdb — connection reset")

        monkeypatch.setattr(structure, "_fetch_rcsb_raw", fake_fetch)
        with make_app() as client:
            resp = client.get("/api/structure/pdb/1X9N/file")
        assert resp.status_code == 502
        body = resp.text
        assert "files.rcsb.org" not in body
        assert "connection reset" not in body

    @pytest.mark.parametrize(
        "bad",
        ["AAA", "AAAAA", "1X9N;rm", "..%2F..%2Fetc", "%2e%2e", "1X9N%0A", "1X9N%00", "abc<"],
    )
    def test_invalid_identifier_rejected_before_any_upstream_call(self, bad, monkeypatch):
        calls: list[str] = []

        async def fake_fetch(pdb_id: str) -> str:
            calls.append(pdb_id)
            return FAKE_PDB

        monkeypatch.setattr(structure, "_fetch_rcsb_raw", fake_fetch)
        with make_app() as client:
            resp = client.get(f"/api/structure/pdb/{bad}/file")
        assert resp.status_code in (404, 422)
        assert calls == []

    def test_helper_uses_files_rcsb_url_and_caches(self, monkeypatch):
        """The real helper (not the route) is exercised here: one upstream GET,
        then the 24 h cache answers the second call."""
        requests: list[str] = []

        async def fake_get(self, url, *a, **k):
            requests.append(url)
            return FakeResponse()

        monkeypatch.setattr("httpx.AsyncClient.get", fake_get)
        with make_app() as client:
            first = client.get("/api/structure/pdb/7ZZQ/file")
            second = client.get("/api/structure/pdb/7ZZQ/file")
        assert first.status_code == 200 and second.status_code == 200
        assert first.text == FAKE_PDB and second.text == FAKE_PDB
        assert requests == ["https://files.rcsb.org/download/7ZZQ.pdb"]

    def test_helper_maps_404_to_file_not_found(self, monkeypatch):
        async def fake_get(self, url, *a, **k):
            return FakeResponse(status_code=404)

        monkeypatch.setattr("httpx.AsyncClient.get", fake_get)
        with make_app() as client:
            resp = client.get("/api/structure/pdb/6YYQ/file")
        assert resp.status_code == 404
        assert "Unknown PDB ID" in resp.json()["detail"]

    def test_oversize_file_refused(self, monkeypatch):
        async def fake_get(self, url, *a, **k):
            return FakeResponse(headers={"content-length": str(structure._MAX_FILE_BYTES + 1)})

        monkeypatch.setattr("httpx.AsyncClient.get", fake_get)
        with make_app() as client:
            resp = client.get("/api/structure/pdb/5XXQ/file")
        assert resp.status_code == 502


# ── AlphaFold raw file route ───────────────────────────────────────────────


class TestAlphafoldFileRoute:
    def test_returns_raw_model_passthrough(self, monkeypatch):
        async def fake_fetch(uniprot: str) -> str:
            assert uniprot == "P18858"
            return FAKE_PDB

        monkeypatch.setattr(structure, "_fetch_af_raw", fake_fetch)
        with make_app() as client:
            resp = client.get("/api/structure/alphafold/P18858/file")
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/plain")
        assert resp.text == FAKE_PDB

    def test_missing_model_is_404_with_fixed_message(self, monkeypatch):
        async def fake_fetch(uniprot: str) -> str:
            raise ValueError(f"No AlphaFold model available for {uniprot}.")

        monkeypatch.setattr(structure, "_fetch_af_raw", fake_fetch)
        with make_app() as client:
            resp = client.get("/api/structure/alphafold/Q99999/file")
        assert resp.status_code == 404
        assert "No AlphaFold model available for Q99999." in resp.json()["detail"]

    def test_missing_model_file_is_404(self, monkeypatch):
        async def fake_fetch(uniprot: str) -> str:
            raise FileNotFoundError(uniprot)

        monkeypatch.setattr(structure, "_fetch_af_raw", fake_fetch)
        with make_app() as client:
            resp = client.get("/api/structure/alphafold/Q9ZZZ2/file")
        assert resp.status_code == 404

    def test_upstream_failure_is_502_without_echoing_upstream(self, monkeypatch):
        async def fake_fetch(uniprot: str) -> str:
            raise RuntimeError("https://alphafold.ebi.ac.uk/files/AF-P18858-F1-model_v4.pdb timeout")

        monkeypatch.setattr(structure, "_fetch_af_raw", fake_fetch)
        with make_app() as client:
            resp = client.get("/api/structure/alphafold/P18858/file")
        assert resp.status_code == 502
        assert "alphafold.ebi.ac.uk" not in resp.text

    @pytest.mark.parametrize(
        "bad",
        ["2BMY", "1X9N", "P18858;SELECT", "..%2F..%2Fetc", "a" * 30, "P18858%00"],
    )
    def test_invalid_accession_rejected_before_any_upstream_call(self, bad, monkeypatch):
        calls: list[str] = []

        async def fake_fetch(uniprot: str) -> str:
            calls.append(uniprot)
            return FAKE_PDB

        monkeypatch.setattr(structure, "_fetch_af_raw", fake_fetch)
        with make_app() as client:
            resp = client.get(f"/api/structure/alphafold/{bad}/file")
        assert resp.status_code in (404, 422)
        assert calls == []

    def test_helper_follows_metadata_pdb_url(self, monkeypatch):
        """The real helper resolves the file URL through the AlphaFold service
        metadata — the URL is never built from user input."""
        seen: list[str] = []

        async def fake_metadata(uniprot: str) -> dict:
            return {"entryId": f"AF-{uniprot}-F1", "pdbUrl": f"https://example.invalid/{uniprot}.pdb"}

        async def fake_get(self, url, *a, **k):
            seen.append(url)
            return FakeResponse()

        monkeypatch.setattr(alphafold, "_metadata", fake_metadata)
        monkeypatch.setattr("httpx.AsyncClient.get", fake_get)
        with make_app() as client:
            first = client.get("/api/structure/alphafold/Q8W3V4/file")
            second = client.get("/api/structure/alphafold/Q8W3V4/file")
        assert first.status_code == 200 and first.text == FAKE_PDB
        assert second.status_code == 200
        # Cached: exactly one upstream fetch of the metadata-provided URL.
        assert seen == ["https://example.invalid/Q8W3V4.pdb"]

    def test_helper_missing_pdb_url_is_404(self, monkeypatch):
        async def fake_metadata(uniprot: str) -> dict:
            return {"entryId": f"AF-{uniprot}-F1"}

        monkeypatch.setattr(alphafold, "_metadata", fake_metadata)
        with make_app() as client:
            resp = client.get("/api/structure/alphafold/Q4ZZZ9/file")
        assert resp.status_code == 404
