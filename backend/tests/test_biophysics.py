"""Offline tests for the biophysics service: PDB atom reader, docking score
and solvent models.  No external services are contacted — the RCSB fetch is
faked at the module boundary, and the routes run against a synthetic PDB
fixture (24 atoms, side chains and a zinc ion).
"""
from __future__ import annotations

import math

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.parsers import ParseError
from app.routes import biophysics as biophysics_routes
from app.services import biophysics
from app.services.biophysics import DockingError, LIGANDS, parse_pdb_atoms


def make_app(**overrides) -> TestClient:
    kwargs = {"_env_file": None, "cors_origins": "http://localhost:3000", **overrides}
    return TestClient(create_app(Settings(**kwargs)))


def csrf_post(client: TestClient, path: str, payload: dict):
    client.get("/api/health")  # safe request → sets the CSRF cookie
    token = client.cookies.get("protheon_csrf")
    return client.post(path, json=payload, headers={"X-CSRF-Token": token})


# ── Synthetic PDB fixture ──────────────────────────────────────────────────

def pdb_atom(serial, name, resname, chain, resseq, x, y, z, element, record="ATOM"):
    """One fixed-column ATOM/HETATM record (element in columns 77-78)."""
    return (
        f"{record:<6}{serial:>5} {name:>4} {resname:>3} {chain}{resseq:>4}    "
        f"{x:>8.3f}{y:>8.3f}{z:>8.3f}{1.00:>6.2f}{50.00:>6.2f}          {element:>2}"
    )


FIXTURE_LINES = [
    pdb_atom(1, "N", "ALA", "A", 1, 0.0, 0.0, 0.0, "N"),
    pdb_atom(2, "CA", "ALA", "A", 1, 1.46, 0.0, 0.0, "C"),
    pdb_atom(3, "C", "ALA", "A", 1, 2.0, 1.4, 0.0, "C"),
    pdb_atom(4, "O", "ALA", "A", 1, 1.3, 2.3, 0.0, "O"),
    pdb_atom(5, "CB", "ALA", "A", 1, 2.1, -1.1, 0.7, "C"),
    pdb_atom(6, "N", "GLY", "A", 2, 3.5, 1.7, 0.0, "N"),
    pdb_atom(7, "CA", "GLY", "A", 2, 4.2, 2.9, 0.1, "C"),
    pdb_atom(8, "C", "GLY", "A", 2, 5.6, 2.6, -0.4, "C"),
    pdb_atom(9, "O", "GLY", "A", 2, 6.2, 1.6, -0.2, "O"),
    pdb_atom(10, "N", "SER", "A", 3, 6.3, 3.6, -0.9, "N"),
    pdb_atom(11, "CA", "SER", "A", 3, 7.7, 3.5, -1.0, "C"),
    pdb_atom(12, "C", "SER", "A", 3, 8.3, 4.9, -1.0, "C"),
    pdb_atom(13, "O", "SER", "A", 3, 7.6, 5.9, -1.2, "O"),
    pdb_atom(14, "CB", "SER", "A", 3, 8.3, 2.7, -2.2, "C"),
    pdb_atom(15, "OG", "SER", "A", 3, 9.6, 3.1, -2.3, "O"),
    pdb_atom(16, "N", "ASP", "A", 4, 9.6, 5.0, -0.8, "N"),
    pdb_atom(17, "CA", "ASP", "A", 4, 10.9, 5.5, -0.6, "C"),
    pdb_atom(18, "C", "ASP", "A", 4, 11.6, 4.9, 0.6, "C"),
    pdb_atom(19, "O", "ASP", "A", 4, 11.1, 3.9, 1.2, "O"),
    pdb_atom(20, "CB", "ASP", "A", 4, 11.5, 4.9, -1.9, "C"),
    pdb_atom(21, "CG", "ASP", "A", 4, 12.9, 5.4, -1.8, "C"),
    pdb_atom(22, "OD1", "ASP", "A", 4, 13.8, 4.6, -1.6, "O"),
    pdb_atom(23, "OD2", "ASP", "A", 4, 13.2, 6.6, -1.9, "O"),
    pdb_atom(24, "ZN", "ZN", "A", 401, 7.0, 1.5, -0.5, "ZN", record="HETATM"),
]
FIXTURE_TEXT = "TITLE     SYNTHETIC POCKET\n" + "\n".join(FIXTURE_LINES) + "\nEND\n"


# ── Strict PDB atom reader ─────────────────────────────────────────────────


class TestPdbAtomReader:
    def test_parses_all_atoms_including_hetatm_metal(self):
        atoms = parse_pdb_atoms(FIXTURE_TEXT)
        assert len(atoms) == 24
        assert {a.element for a in atoms} == {"C", "N", "O", "ZN"}
        zn = [a for a in atoms if a.element == "ZN"]
        assert len(zn) == 1 and zn[0].record == "HETATM" and zn[0].resseq == 401
        ca = [a for a in atoms if a.name == "CA" and a.record == "ATOM"]
        assert [a.resseq for a in ca] == [1, 2, 3, 4]
        assert ca[0].x == pytest.approx(1.46)

    def test_element_fallback_from_atom_name(self):
        # Legacy file: element columns blank, atom-name field carries the element.
        line = (
            f"{'ATOM':<6}{7:>5} {' CA':>4} {'GLY':>3} {'A'}{2:>4}    "
            f"{4.2:>8.3f}{2.9:>8.3f}{0.1:>8.3f}{1.00:>6.2f}{50.00:>6.2f}   "
        )
        atoms = parse_pdb_atoms(line)
        assert len(atoms) == 1
        assert atoms[0].element == "C"

    @pytest.mark.parametrize("bad", ["     nan", "     inf", "  1e999"])
    def test_rejects_non_finite_coordinates(self, bad):
        line = FIXTURE_LINES[0][:30] + bad + FIXTURE_LINES[0][38:]
        with pytest.raises(ParseError):
            parse_pdb_atoms(line)

    def test_rejects_junk_numeric_field(self):
        line = FIXTURE_LINES[0][:30] + "  1.2.3 " + FIXTURE_LINES[0][38:]
        with pytest.raises(ParseError):
            parse_pdb_atoms(line)

    def test_rejects_script_payload(self):
        line = FIXTURE_LINES[0][:30] + "<script>" + FIXTURE_LINES[0][38:]
        with pytest.raises(ParseError):
            parse_pdb_atoms(line)

    def test_rejects_truncated_record(self):
        with pytest.raises(ParseError):
            parse_pdb_atoms("ATOM      1  CA  GLY A   2     4.2")

    def test_rejects_file_without_atoms(self):
        with pytest.raises(ParseError):
            parse_pdb_atoms("HEADER    NOT A COORDINATE FILE\nEND\n")

    def test_rejects_oversize_atom_count(self, monkeypatch):
        monkeypatch.setattr(biophysics, "_MAX_ATOMS", 10)
        with pytest.raises(ParseError):
            parse_pdb_atoms(FIXTURE_TEXT)

    def test_rejects_oversize_file(self, monkeypatch):
        monkeypatch.setattr(biophysics, "_MAX_PDB_BYTES", 10)
        with pytest.raises(ParseError):
            parse_pdb_atoms(FIXTURE_TEXT)


# ── Ligand models ──────────────────────────────────────────────────────────


class TestLigandModels:
    @pytest.mark.parametrize("name", sorted(LIGANDS))
    def test_model_shape(self, name):
        model = LIGANDS[name]
        assert 6 <= len(model.atoms) <= 14
        assert {a.element for a in model.atoms} <= {"C", "N", "O"}
        assert all(-0.6 <= a.charge <= 0.6 for a in model.atoms)
        assert any(a.donor for a in model.atoms)
        assert any(a.acceptor for a in model.atoms)
        assert all(a.name for a in model.atoms)

    @pytest.mark.parametrize("name", sorted(LIGANDS))
    def test_geometry_is_plausible(self, name):
        atoms = LIGANDS[name].atoms
        for i, a in enumerate(atoms):
            for b in atoms[i + 1:]:
                d = math.dist((a.x, a.y, a.z), (b.x, b.y, b.z))
                assert d >= 1.0, f"{name}: {a.name}-{b.name} overlap at {d:.2f} Å"


# ── Pocket detection and scoring ───────────────────────────────────────────


class TestDocking:
    def test_density_peak_pocket(self):
        pocket = biophysics.find_pocket(parse_pdb_atoms(FIXTURE_TEXT))
        # GLY2 and SER3 tie on 3 neighbours; the lower resseq wins.
        assert (pocket.resi, pocket.resname) == (2, "GLY")

    def test_center_resi_wins(self):
        pocket = biophysics.find_pocket(parse_pdb_atoms(FIXTURE_TEXT), center_resi=4)
        assert (pocket.resi, pocket.resname) == (4, "ASP")
        assert pocket.x == pytest.approx(10.9)

    def test_missing_center_resi_raises(self):
        with pytest.raises(DockingError):
            biophysics.find_pocket(parse_pdb_atoms(FIXTURE_TEXT), center_resi=999)

    def test_unknown_ligand_raises(self):
        with pytest.raises(DockingError):
            biophysics.dock_ligand(parse_pdb_atoms(FIXTURE_TEXT), "novichok")

    @pytest.mark.parametrize("name", sorted(LIGANDS))
    def test_score_is_finite_and_labelled(self, name):
        out = biophysics.dock_ligand(parse_pdb_atoms(FIXTURE_TEXT), name)
        assert math.isfinite(out["delta_g_kcal_per_mol"])
        assert out["kd_molar"] > 0
        assert math.isfinite(out["kd_molar"])
        assert out["kd_label"] in {"sub-nM", "nM", "µM", "mM", "weak (mM+)"}
        assert out["pocket"] == {"resi": 2, "resname": "GLY"}

    def test_contacts_are_capped_and_sorted(self):
        out = biophysics.dock_ligand(parse_pdb_atoms(FIXTURE_TEXT), "aspirin")
        contacts = out["contacts"]
        assert 0 < len(contacts) <= 30
        order = {"hbond": 0, "clash": 1, "vdw": 2}
        keys = [(order[c["type"]], c["distance_angstrom"]) for c in contacts]
        assert keys == sorted(keys)
        for c in contacts:
            assert c["ligand_atom"] and c["ligand_element"] in {"C", "N", "O"}
            assert c["residue"].endswith(":A")
            assert c["atom"]
            assert c["type"] in {"hbond", "clash", "vdw"}

    def test_hydrogen_bonds_are_identified(self):
        out = biophysics.dock_ligand(parse_pdb_atoms(FIXTURE_TEXT), "aspirin", center_resi=4)
        hbonds = [c for c in out["contacts"] if c["type"] == "hbond"]
        assert hbonds
        assert all(2.6 <= c["distance_angstrom"] <= 3.5 for c in hbonds)

    def test_center_resi_is_reported(self):
        out = biophysics.dock_ligand(parse_pdb_atoms(FIXTURE_TEXT), "warfarin", center_resi=3)
        assert out["pocket"] == {"resi": 3, "resname": "SER"}


# ── Dock route ─────────────────────────────────────────────────────────────

DOCK_URL = "/api/biophysics/dock"


def test_dock_route_end_to_end(monkeypatch):
    async def fake_fetch(pdb_id: str) -> str:
        assert pdb_id == "1ABC"  # uppercased before the upstream URL is built
        return FIXTURE_TEXT

    monkeypatch.setattr(biophysics_routes, "_fetch_pdb_text", fake_fetch)
    with make_app() as client:
        resp = csrf_post(client, DOCK_URL, {"pdb_id": "1abc", "ligand": "aspirin"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["pdb_id"] == "1ABC" and body["ligand"] == "aspirin"
    assert math.isfinite(body["delta_g_kcal_per_mol"])
    assert body["kd_molar"] > 0
    assert body["contacts"]
    assert set(body["pocket"]) == {"resi", "resname"}


def test_dock_requires_csrf():
    with make_app() as client:
        resp = client.post(DOCK_URL, json={"pdb_id": "1ABC", "ligand": "aspirin"})
    assert resp.status_code == 403


@pytest.mark.parametrize(
    "payload",
    [
        {"pdb_id": "1ABC", "ligand": "novichok"},
        {"pdb_id": "..%2F", "ligand": "aspirin"},
        {"pdb_id": "12", "ligand": "aspirin"},
        {"pdb_id": "1ABC", "ligand": "aspirin", "center_resi": 0},
        {"pdb_id": "1ABC", "ligand": "aspirin", "center_resi": 20001},
        {"pdb_id": "1ABC", "ligand": "aspirin", "center_resi": "abc"},
    ],
)
def test_dock_rejects_bad_input(payload):
    with make_app() as client:
        resp = csrf_post(client, DOCK_URL, payload)
    assert resp.status_code == 422


def test_dock_maps_parse_error_to_422(monkeypatch):
    async def fake_fetch(pdb_id: str) -> str:
        return "ATOM      1  CA  GLY A   2     nope"

    monkeypatch.setattr(biophysics_routes, "_fetch_pdb_text", fake_fetch)
    with make_app() as client:
        resp = csrf_post(client, DOCK_URL, {"pdb_id": "1ABD", "ligand": "caffeine"})
    assert resp.status_code == 422


def test_dock_maps_missing_residue_to_422(monkeypatch):
    async def fake_fetch(pdb_id: str) -> str:
        return FIXTURE_TEXT

    monkeypatch.setattr(biophysics_routes, "_fetch_pdb_text", fake_fetch)
    with make_app() as client:
        resp = csrf_post(
            client, DOCK_URL, {"pdb_id": "1ABE", "ligand": "caffeine", "center_resi": 777}
        )
    assert resp.status_code == 422
    assert resp.json()["detail"] == "Residue 777 was not found in the structure."


class _FakeResponse:
    def __init__(self, status_code: int) -> None:
        self.status_code = status_code
        self.text = FIXTURE_TEXT

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            request = httpx.Request("GET", "https://files.rcsb.org/download/1ABF.pdb")
            raise httpx.HTTPStatusError("boom", request=request, response=httpx.Response(self.status_code, request=request))


def _mock_get(status_code: int):
    async def fake_get(url, *args, **kwargs):
        return _FakeResponse(status_code)

    return fake_get


def test_dock_upstream_404(monkeypatch):
    monkeypatch.setattr(httpx.AsyncClient, "get", _mock_get(404))
    with make_app() as client:
        resp = csrf_post(client, DOCK_URL, {"pdb_id": "1ABF", "ligand": "aspirin"})
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Unknown PDB ID."


def test_dock_upstream_failure_is_502(monkeypatch):
    monkeypatch.setattr(httpx.AsyncClient, "get", _mock_get(500))
    with make_app() as client:
        resp = csrf_post(client, DOCK_URL, {"pdb_id": "1ABG", "ligand": "ibuprofen"})
    assert resp.status_code == 502
    assert resp.json()["detail"] == "Structure source unavailable."


def test_dock_real_fetch_path_caches(monkeypatch):
    calls: list[str] = []

    async def fake_get(url, *args, **kwargs):
        calls.append(url)
        return _FakeResponse(200)

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    with make_app() as client:
        first = csrf_post(client, DOCK_URL, {"pdb_id": "1ABH", "ligand": "warfarin"})
        second = csrf_post(client, DOCK_URL, {"pdb_id": "1ABH", "ligand": "caffeine"})
    assert first.status_code == second.status_code == 200
    # Second call is served from the 24 h PDB cache.
    assert len(calls) == 1


# ── Solvent models ─────────────────────────────────────────────────────────


class TestSolventService:
    @pytest.mark.parametrize("name", ["ethanol", "urea", "guanidinium"])
    def test_curve_shape(self, name):
        out = biophysics.solvent_curve(name)
        assert out["solvent"] == name
        assert out["cm_molar"] > 0
        assert out["m_value_kcal_per_mol_per_molar"] > 0
        assert out["notes"]
        curve = out["dielectric_curve"]
        assert len(curve) == 40
        assert curve[0]["concentration_molar"] == 0.0
        assert curve[-1]["concentration_molar"] == 8.0
        assert curve[0]["dielectric_constant"] == 78.5

    @pytest.mark.parametrize("name", ["ethanol", "urea", "guanidinium"])
    def test_fraction_unfolded_is_monotonic(self, name):
        curve = biophysics.solvent_curve(name)["dielectric_curve"]
        fractions = [p["fraction_unfolded"] for p in curve]
        assert all(a <= b for a, b in zip(fractions, fractions[1:]))
        assert fractions[0] < fractions[-1]
        assert all(0.0 <= f <= 1.0 for f in fractions)

    def test_ethanol_lowers_dielectric(self):
        curve = biophysics.solvent_curve("ethanol")["dielectric_curve"]
        eps = [p["dielectric_constant"] for p in curve]
        assert all(a > b for a, b in zip(eps, eps[1:]))
        assert eps[-1] == pytest.approx(78.5 - 2.4 * 8.0, abs=0.01)

    def test_guanidinium_parameters(self):
        out = biophysics.solvent_curve("guanidinium")
        assert out["cm_molar"] == 2.6
        assert out["m_value_kcal_per_mol_per_molar"] == 2.4

    def test_unknown_solvent_raises(self):
        with pytest.raises(DockingError):
            biophysics.solvent_curve("dmso")


class TestSolventRoute:
    @pytest.mark.parametrize("name", ["ethanol", "urea", "guanidinium"])
    def test_solvent_endpoint(self, name):
        with make_app() as client:
            resp = client.get(f"/api/biophysics/solvent/{name}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["solvent"] == name
        assert len(body["dielectric_curve"]) == 40

    def test_unknown_solvent_is_422(self):
        with make_app() as client:
            resp = client.get("/api/biophysics/solvent/dmso")
        assert resp.status_code == 422

    def test_traversal_solvent_is_rejected(self):
        with make_app() as client:
            resp = client.get("/api/biophysics/solvent/..%2F..%2Fetc")
        # Starlette normalises the dot segments before routing; either way the
        # request must never reach the handler with a traversing value.
        assert resp.status_code in (404, 422)
