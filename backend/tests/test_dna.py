"""Offline tests for the GenBank parser, restriction enzyme math and DNA routes.

No external services are contacted — the Entrez fetch is faked at the
service boundary, the same boundary the hostile-input tests attack.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.enzymes import digest_fragments, find_sites
from app.main import create_app
from app.parsers import ParseError, parse_genbank_text
from app.services import entrez


def make_app(**overrides) -> TestClient:
    kwargs = {"_env_file": None, "cors_origins": "http://localhost:3000", **overrides}
    return TestClient(create_app(Settings(**kwargs)))


def _genbank(length: int = 100, extra: str = "") -> str:
    """Synthetic 100 bp circular record with one complement feature."""
    seq = "ACGT" * (length // 4)
    body = (
        "LOCUS       SYN100                  100 bp    DNA     circular SYN 01-JAN-2026\n"
        "DEFINITION  Synthetic test vector.\n"
        "FEATURES             Location/Qualifiers\n"
        "     gene            complement(10..50)\n"
        '                     /gene="bla"\n'
        '                     /product="beta-lactamase"\n'
        "     rep_origin      60..100\n"
        '                     /note="ori"\n'
        "     misc_feature    1..9\n"
        '                     /note="basis of mobility region"\n'
        "ORIGIN\n"
    )
    rows = [f"{i * 60 + 1:>9} " + " ".join(seq[i : i + 60][j : j + 10] for j in range(0, 60, 10)) for i in range(0, length, 60)]
    # extra is spliced BEFORE the // terminator so it lands inside the record.
    return body + "\n".join(rows) + "\n" + extra + "//\n"


# ── GenBank parsing ────────────────────────────────────────────────────────


class TestGenbankParser:
    def test_valid_record(self):
        rec = parse_genbank_text(_genbank(100))
        assert rec["length"] == 100
        assert rec["topology"] == "circular"
        assert len(rec["sequence"]) == 100
        assert rec["sequence"].startswith("ACGT")
        assert [f["label"] for f in rec["features"]] == ["bla", "ori", "basis of mobility region"]
        assert rec["features"][0]["strand"] == -1
        assert (rec["features"][0]["start"], rec["features"][0]["end"]) == (10, 50)

    def test_rejects_non_genbank(self):
        with pytest.raises(ParseError):
            parse_genbank_text("<html>hello world</html>")

    def test_rejects_length_mismatch(self):
        with pytest.raises(ParseError):
            parse_genbank_text(_genbank(100, extra="    1 acgt\n"))

    def test_rejects_invalid_bases(self):
        # XYZZ are alphabetic but not valid bases — same declared length, so
        # the invalid-character gate (not the length gate) must fire.
        bad = _genbank(100).replace("ACGT", "XYZZ", 1)
        with pytest.raises(ParseError):
            parse_genbank_text(bad)

    def test_rejects_oversize(self, monkeypatch):
        from app import parsers

        monkeypatch.setattr(parsers, "_MAX_GB_BYTES", 200)
        with pytest.raises(ParseError):
            parse_genbank_text(_genbank(1000))

    def test_rejects_oversize_length(self, monkeypatch):
        from app import parsers

        monkeypatch.setattr(parsers, "_MAX_GB_LEN", 50)
        with pytest.raises(ParseError):
            parse_genbank_text(_genbank(100))

    def test_features_span_join_locations(self):
        rec = parse_genbank_text(
            _genbank(100).replace("complement(10..50)", "join(10..20,30..50)")
        )
        assert (rec["features"][0]["start"], rec["features"][0]["end"]) == (10, 50)


# ── Enzyme math ────────────────────────────────────────────────────────────


class TestEnzymes:
    def test_find_sites(self):
        assert find_sites("GAATTCGAATTC", "EcoRI") == [0, 6]
        assert find_sites("CAGCTGCAGCTG", "PvuII") == [0, 6]
        assert find_sites("AAAAAA", "EcoRI") == []

    def test_circular_fragments(self):
        assert digest_fragments(10, [2, 7], "circular") == [5, 5]
        assert digest_fragments(4361, [], "circular") == [4361]
        # One cut on a circle linearizes it.
        assert digest_fragments(4361, [100], "circular") == [4361]

    def test_linear_fragments(self):
        assert digest_fragments(100, [40, 70], "linear") == [40, 30, 30]
        assert digest_fragments(100, [40], "linear") == [40, 60]

    def test_fragments_sum_to_length(self):
        frags = digest_fragments(4361, [375, 651, 3609], "circular")
        assert sum(frags) == 4361

    def test_circular_junction_motif_found(self):
        from app.enzymes import all_sites

        # GAATTC spans the junction: positions 11,0,1,2,3,4 (pBR322's EcoRI
        # site does exactly this at 4360→1). A linear scan misses it.
        seq = "AATTC" + "AAAAAA" + "G"
        assert len(seq) == 12
        sites = all_sites(seq, "circular", ["EcoRI"])
        assert any(s["start"] == 11 for s in sites)
        # The interior scan stays correct too.
        sites = all_sites(seq + "GAATTC", "circular", ["EcoRI"])
        assert any(s["start"] == 12 for s in sites)

    def test_linear_topology_does_not_wrap(self):
        from app.enzymes import all_sites

        seq = "AATTC" + "AAAAAA" + "G"
        sites = all_sites(seq, "linear", ["EcoRI"])
        assert sites == []


# ── Routes (offline, faked Entrez) ─────────────────────────────────────────


class TestDnaRoutes:
    def test_registry_returns_record(self, monkeypatch):
        async def fake_fetch(accession: str) -> str:
            return _genbank(100)

        monkeypatch.setattr(entrez, "fetch_genbank", fake_fetch)
        with make_app() as client:
            resp = client.get("/api/dna/registry/J01749")
        assert resp.status_code == 200
        body = resp.json()
        assert body["accession"] == "J01749"
        assert body["topology"] == "circular"
        assert body["length"] == 100
        assert len(body["sequence"]) == 100

    def test_registry_upstream_missing_is_404(self, monkeypatch):
        def fake_fetch(accession: str):
            raise ValueError(f"No GenBank record available for {accession}.")

        monkeypatch.setattr(entrez, "fetch_genbank", fake_fetch)
        with make_app() as client:
            resp = client.get("/api/dna/registry/ZZZZ99")
        assert resp.status_code == 404

    def test_traversal_id_rejected(self):
        with make_app() as client:
            resp = client.get("/api/dna/registry/..%2F..%2Fetc")
        assert resp.status_code in (404, 422)

    def test_digest_unknown_enzyme_rejected(self, monkeypatch):
        async def fake_fetch(accession: str) -> str:
            return _genbank(100)

        monkeypatch.setattr(entrez, "fetch_genbank", fake_fetch)
        with make_app() as client:
            resp = client.get("/api/dna/digest/J01749?enzymes=EcoRI,NotAnEnzyme")
        assert resp.status_code == 422

    def test_digest_fragments(self, monkeypatch):
        async def fake_fetch(accession: str) -> str:
            return _genbank(100)

        monkeypatch.setattr(entrez, "fetch_genbank", fake_fetch)
        with make_app() as client:
            resp = client.get("/api/dna/digest/J01749?enzymes=PvuII")
        assert resp.status_code == 200
        assert sum(resp.json()["fragments"]) == 100

    def test_enzyme_catalog(self):
        with make_app() as client:
            resp = client.get("/api/dna/enzymes")
        assert resp.status_code == 200
        assert any(e["name"] == "EcoRI" for e in resp.json()["enzymes"])


class TestDnaIngest:
    """File uploads — CSRF-protected, strict parsers, same registry shape."""

    def test_ingest_requires_csrf(self):
        with make_app() as client:
            resp = client.post("/api/dna/ingest", files={"file": ("x.fa", b">x\nACGTACGT")})
        assert resp.status_code == 403

    def test_ingest_fasta(self):
        with make_app() as client:
            client.get("/api/health")  # obtain the CSRF cookie
            resp = client.post(
                "/api/dna/ingest",
                files={"file": ("mini.fa", b">Mini vector\nACGTACGTACGT")},
                headers={"X-CSRF-Token": client.cookies.get("protheon_csrf")},
            )
        assert resp.status_code == 200
        body = resp.json()
        assert body["accession"] == "MINI"
        assert body["topology"] == "linear"
        assert body["sequence"] == "ACGTACGTACGT"
        assert body["features"] == []

    def test_ingest_genbank(self):
        with make_app() as client:
            client.get("/api/health")
            resp = client.post(
                "/api/dna/ingest",
                files={"file": ("vec.gb", _genbank(100))},
                headers={"X-CSRF-Token": client.cookies.get("protheon_csrf")},
            )
        assert resp.status_code == 200
        body = resp.json()
        assert body["topology"] == "circular"
        assert body["length"] == 100
        assert any(f["label"] == "bla" for f in body["features"])

    def test_ingest_rejects_protein_fasta(self):
        with make_app() as client:
            client.get("/api/health")
            resp = client.post(
                "/api/dna/ingest",
                files={"file": ("prot.fa", b">protein\nMQRSIMSFFHPKK")},
                headers={"X-CSRF-Token": client.cookies.get("protheon_csrf")},
            )
        assert resp.status_code == 422
        assert "Not a DNA sequence" in resp.json()["detail"]

    def test_ingest_rejects_junk(self):
        with make_app() as client:
            client.get("/api/health")
            resp = client.post(
                "/api/dna/ingest",
                files={"file": ("junk.txt", b"<script>alert(1)</script>")},
                headers={"X-CSRF-Token": client.cookies.get("protheon_csrf")},
            )
        assert resp.status_code == 422
