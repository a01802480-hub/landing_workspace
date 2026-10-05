"""Offline tests for /comparative/search — the on-demand sequence search.

No external services are contacted: the UniProt service boundaries are
monkeypatched, and every error path asserts a *fixed* message (upstream
text must never be echoed).
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.routes import comparative

FAKE_ENTRY = {
    "accession": "P18858",
    "gene": "LIG1",
    "name": "DNA ligase 1",
    "organism": "Homo sapiens",
    "length": 919,
    "sequence": "M" * 919,
}


def make_app(**overrides) -> TestClient:
    kwargs = {"_env_file": None, "cors_origins": "http://localhost:3000", **overrides}
    return TestClient(create_app(Settings(**kwargs)))


def test_search_by_accession(monkeypatch) -> None:
    async def fake_fetch_entry(accession: str) -> dict:
        assert accession == "P18858"
        return FAKE_ENTRY

    monkeypatch.setattr(comparative.uniprot, "fetch_entry", fake_fetch_entry)
    with make_app() as client:
        resp = client.get("/api/comparative/search?q=P18858")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["entries"]) == 1
    entry = body["entries"][0]
    assert entry["accession"] == "P18858"
    assert entry["gene"] == "LIG1"
    assert entry["sequence"] == "M" * 919
    assert entry["truncated"] is False


def test_search_by_symbol(monkeypatch) -> None:
    async def fake_fetch_by_symbol(symbol: str, organism: str = "9606") -> dict:
        assert symbol == "LIG1"
        return FAKE_ENTRY

    monkeypatch.setattr(comparative.uniprot, "fetch_by_symbol", fake_fetch_by_symbol)
    with make_app() as client:
        resp = client.get("/api/comparative/search?q=LIG1")
    assert resp.status_code == 200
    assert resp.json()["entries"][0]["gene"] == "LIG1"


def test_search_truncates_long_sequences(monkeypatch) -> None:
    long_entry = {**FAKE_ENTRY, "length": 4500, "sequence": "K" * 4500}

    async def fake_fetch_entry(accession: str) -> dict:
        return long_entry

    monkeypatch.setattr(comparative.uniprot, "fetch_entry", fake_fetch_entry)
    with make_app() as client:
        resp = client.get("/api/comparative/search?q=P18858")
    entry = resp.json()["entries"][0]
    assert len(entry["sequence"]) == 2000
    assert entry["truncated"] is True


def test_search_unknown_is_404(monkeypatch) -> None:
    async def fake_fetch_by_symbol(symbol: str, organism: str = "9606") -> dict:
        raise ValueError("No reviewed entry for that gene.")

    monkeypatch.setattr(comparative.uniprot, "fetch_by_symbol", fake_fetch_by_symbol)
    with make_app() as client:
        resp = client.get("/api/comparative/search?q=ZZZZZ")
    assert resp.status_code == 404


def test_search_upstream_error_is_502(monkeypatch) -> None:
    async def fake_fetch_by_symbol(symbol: str, organism: str = "9606") -> dict:
        raise RuntimeError("boom: https://internal.example/x")

    monkeypatch.setattr(comparative.uniprot, "fetch_by_symbol", fake_fetch_by_symbol)
    with make_app() as client:
        resp = client.get("/api/comparative/search?q=LIG1")
    assert resp.status_code == 502
    assert "https://" not in resp.json()["detail"]


def test_search_query_validation() -> None:
    with make_app() as client:
        assert client.get("/api/comparative/search?q=x").status_code == 422
        assert client.get("/api/comparative/search?q=" + "a" * 25).status_code == 422
