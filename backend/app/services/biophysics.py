"""Empirical biophysics models for Protheon: docking scores and solvent unfolding.

Everything here is an **honest approximation**, documented as such — it is not
a free-energy calculation and must not be presented as one.

Protein–ligand docking
    A rigid-receptor empirical score in the spirit of AutoDock Vina's
    empirical terms.  The ligand is one of the hardcoded parameterized
    pharmacophore models below (plausible small-molecule geometry, partial
    charges in [-0.6, 0.6]); it is translated so that its centroid sits at
    the detected pocket's Cα, and every ligand-atom ↔ protein-atom pair
    within 8 Å contributes:

    - van der Waals: Lennard-Jones 6-12 with per-element σ (Å) / ε (kcal/mol)
      and Lorentz-Berthelot mixing (σ_mix = mean, ε_mix = 0.6·√(ε_i·ε_j) —
      the 0.6 scale keeps the empirical total on a Vina-like scale).  The
      repulsive wall is capped at +10 kcal/mol per pair so the rigid score
      stays finite when a ligand atom sits on top of a protein atom (Vina
      clamps its repulsion for the same reason).
    - Hydrogen bond: a ligand donor facing a protein acceptor (O) or a ligand
      acceptor facing a protein donor (N) at 2.6–3.5 Å → −2.5 kcal/mol each.
    - Steric clash: any non-hydrogen pair closer than 2.2 Å → +4.0 kcal/mol
      each.

    ΔG = Σ terms + 1.5 kcal/mol (entropic constant); Kd = exp(ΔG / RT) at
    298.15 K (two-state, rigid ligand and receptor — a coarse but
    directionally meaningful estimate).  Ligand partial charges are carried
    in the models for reference; the score itself is nonpolar, like Vina's.

Solvent denaturation
    Two-state linear-extrapolation models: the dielectric constant of the
    medium is ε(c) = 78.5 + slope·c and the unfolded fraction is
    1/(1 + exp((Cm − c)/s)).  Ethanol lowers ε and attacks the hydrophobic
    core; urea and guanidinium raise ε slightly and compete for backbone
    hydrogen bonds.  Cm and m are order-of-magnitude literature-scale
    constants, not measured here.

Security rules (see SECURITY_AUDIT.md), mirroring `app/parsers.py`: the PDB
reader is fixed-column only and fail-closed — malformed records raise
ParseError, every coordinate is finite-checked, and the file size and atom
count are capped before work happens.  Nothing upstream is echoed back.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass

from ..parsers import ParseError

# ── Numeric constants ──────────────────────────────────────────────────────

_MAX_PDB_BYTES = 25_000_000
_MAX_ATOMS = 50_000

_POCKET_CUTOFF = 10.0        # Å, Cα–Cα neighbourhood for pocket detection
_PAIR_CUTOFF = 8.0           # Å, ligand↔protein pair scan
_HBOND_MIN = 2.6             # Å
_HBOND_MAX = 3.5             # Å
_CLASH_CUTOFF = 2.2          # Å, non-hydrogen pairs
_LJ_CAP = 10.0               # kcal/mol, soft cap on the repulsive wall
_VDW_SCALE = 0.6             # empirical ε scale (documented above)
_HBOND_ENERGY = -2.5         # kcal/mol per hydrogen bond
_CLASH_ENERGY = 4.0          # kcal/mol per steric clash
_ENTROPIC = 1.5              # kcal/mol, constant entropic/desolvation term
_RT = 0.0019872041 * 298.15  # kcal/mol at 298.15 K
_EXPONENT_LIMIT = 700.0      # keeps exp() finite for JSON

_SOLVENT_POINTS = 40
_SOLVENT_MAX_MOLAR = 8.0

_WATER_RESNAMES = {"HOH", "WAT", "DOD", "H2O"}

# Per-element Lennard-Jones parameters: σ (Å), ε (kcal/mol).  Values are the
# usual AMBER/CGenFF-scale numbers; the ε column is scaled by _VDW_SCALE at
# mixing time.  Unknown elements fall back to a carbon-like default.
_ELEMENT_PARAMS: dict[str, tuple[float, float]] = {
    "H": (2.40, 0.02),
    "C": (3.40, 0.15),
    "N": (3.25, 0.16),
    "O": (3.12, 0.21),
    "S": (4.00, 0.25),
    "P": (3.70, 0.20),
    "SE": (4.10, 0.28),
    "MG": (2.20, 0.10),
    "ZN": (2.10, 0.12),
    "MN": (2.20, 0.12),
    "FE": (2.20, 0.12),
    "CU": (2.20, 0.12),
    "CA": (2.40, 0.14),
    "NA": (2.30, 0.10),
    "K": (2.60, 0.10),
    "NI": (2.20, 0.12),
    "CO": (2.20, 0.12),
    "CL": (3.50, 0.20),
}
_DEFAULT_PARAMS = (3.40, 0.15)

_CONTACT_ORDER = {"hbond": 0, "clash": 1, "vdw": 2}
_MAX_CONTACTS = 30

_ELEMENT_RE = re.compile(r"^[A-Z]{1,2}$")
_RESNAME_RE = re.compile(r"^[A-Z0-9]{1,4}$")
_CHAIN_RE = re.compile(r"^[A-Z0-9]$")


class DockingError(ValueError):
    """Docking could not be scored (missing pocket, unknown ligand). Safe to show."""


# ── Data model ─────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class PdbAtom:
    """One ATOM/HETATM record, parsed from fixed PDB columns."""

    record: str      # "ATOM" | "HETATM"
    serial: int
    name: str        # atom name, uppercased
    resname: str
    chain: str
    resseq: int
    x: float
    y: float
    z: float
    element: str     # columns 77-78, or a name-based guess for legacy files


@dataclass(frozen=True)
class LigandAtom:
    name: str
    element: str
    x: float
    y: float
    z: float
    charge: float
    donor: bool = False     # O/N carrying an H
    acceptor: bool = False  # O/N lone-pair acceptor


@dataclass(frozen=True)
class LigandModel:
    name: str
    atoms: tuple[LigandAtom, ...]
    description: str


@dataclass(frozen=True)
class Pocket:
    resi: int
    resname: str
    chain: str
    x: float
    y: float
    z: float


@dataclass(frozen=True)
class SolventModel:
    name: str
    cm_molar: float
    m_value: float
    s: float
    epsilon_water: float
    epsilon_slope: float
    notes: str
    # Visual/geometry parameterization for the unfolding viewer — each field
    # is a documented, deterministic parameter, never a random fudge:
    seed: int = 7            # seeds the unfolded-coil reference geometry
    core_attack: float = 1.6 # hydrophobic-core exposure tint factor
    collapse: float = 0.45   # side-chain collapse fraction at full unfolding
    dcm_dt: float = 0.0      # dCm/dT (M per degC, negative = heat assists unfolding)
    axis: str = "molar"      # "molar" (denaturant M) | "temperature" (degC)
    axis_max: float = 8.0    # curve span: 8.0 M or 95.0 degC


# ── Strict PDB atom reader ─────────────────────────────────────────────────


def parse_pdb_atoms(text: str) -> list[PdbAtom]:
    """Parse every ATOM/HETATM record with fixed-column slicing.

    Unlike `parsers.parse_pdb_text` (which keeps only Cα), docking needs the
    full heavy-atom set.  Fail-closed: a record that announces itself as
    ATOM/HETATM but has truncated or non-numeric or non-finite fields raises
    ParseError instead of being skipped or guessed at.  Hydrogens are kept in
    the parse (they are rare in X-ray files and excluded later in scoring);
    the atom count is capped at 50 000.
    """
    if len(text.encode("utf-8", errors="ignore")) > _MAX_PDB_BYTES:
        raise ParseError("PDB file too large (limit 25 MB).")
    atoms: list[PdbAtom] = []
    for line in text.splitlines():
        record = line[:6].strip()
        if record not in {"ATOM", "HETATM"}:
            continue
        if len(line) < 54:
            raise ParseError("Malformed PDB ATOM record (truncated).")
        try:
            x = float(line[30:38])
            y = float(line[38:46])
            z = float(line[46:54])
            resseq = int(line[22:26])
        except ValueError as exc:
            raise ParseError("Malformed PDB ATOM record (non-numeric field).") from exc
        if not (math.isfinite(x) and math.isfinite(y) and math.isfinite(z)):
            raise ParseError("Non-finite coordinate in PDB ATOM record.")
        # The serial is not used for scoring; tolerate blanks/asterisks that
        # some legacy writers emit rather than failing an otherwise fine file.
        try:
            serial = int(line[6:11])
        except ValueError:
            serial = 0
        name = line[12:16].strip().upper()
        resname = line[17:20].strip().upper()
        chain = line[21:22].strip().upper() or "A"
        if not _RESNAME_RE.match(resname):
            raise ParseError("Malformed PDB ATOM record (invalid residue name).")
        if not _CHAIN_RE.match(chain):
            raise ParseError("Malformed PDB ATOM record (invalid chain identifier).")
        element = _element(line[76:78], line[12:16])
        atoms.append(PdbAtom(record, serial, name, resname, chain, resseq, x, y, z, element))
        if len(atoms) > _MAX_ATOMS:
            raise ParseError("Too many atoms (limit 50000).")
    if not atoms:
        raise ParseError("No ATOM/HETATM records found in PDB file.")
    return atoms


def _element(element_col: str, atom_name_field: str) -> str:
    """Element from columns 77-78, falling back to the atom-name field.

    Legacy files leave the element column blank or shifted; the atom-name
    field (" CA ", "ZN  ", "1HB ") then carries it.  The PDB convention
    disambiguates the classic " CA " trap (α-carbon vs. calcium): a
    left-justified two-letter name is a two-letter element, a right-justified
    name is a single-letter one.  Unrecognised elements map to the generic
    "X" so scoring falls back to default parameters instead of failing an
    otherwise valid structure.
    """
    cleaned = "".join(c for c in element_col if c.isalpha()).upper()
    if cleaned and _ELEMENT_RE.match(cleaned):
        return cleaned
    raw = atom_name_field.upper()
    letters = "".join(c for c in raw.strip() if c.isalpha())
    if not letters:
        return "X"
    if raw[:1] != " " and len(letters) >= 2 and letters[:2] in _ELEMENT_PARAMS:
        return letters[:2]
    if letters[:1] in _ELEMENT_PARAMS:
        return letters[:1]
    if len(letters) >= 2 and letters[:2] in _ELEMENT_PARAMS:
        return letters[:2]
    return "X"


def _element_params(element: str) -> tuple[float, float]:
    return _ELEMENT_PARAMS.get(element, _DEFAULT_PARAMS)


# ── Ligand models ──────────────────────────────────────────────────────────
#
# Hand-built, parameterized heavy-atom models — never fetched, never parsed
# from upstream.  Coordinates are offsets in Å from the model's centroid,
# with bond lengths in the plausible 1.2–1.6 Å small-molecule range.  These
# are reduced pharmacophore models: where the real molecule exceeds the
# 6–14-atom modelling budget, the less critical substituent is dropped and
# the reduction is documented in the description.  Partial charges are
# illustrative (PEOE-like) and stay inside [-0.6, 0.6].


def _la(name: str, element: str, x: float, y: float, z: float, charge: float,
        donor: bool = False, acceptor: bool = False) -> LigandAtom:
    return LigandAtom(name, element, x, y, z, charge, donor, acceptor)


LIGANDS: dict[str, LigandModel] = {
    # Acetylsalicylic acid — all 13 heavy atoms of aspirin.
    "aspirin": LigandModel(
        name="aspirin",
        description="Acetylsalicylic acid, all 13 heavy atoms (COX-1/2 acetyl donor).",
        atoms=(
            _la("C1", "C", 0.00, 1.39, 0.00, 0.05),
            _la("C2", "C", 1.20, 0.70, 0.00, -0.05),
            _la("C3", "C", 1.20, -0.70, 0.00, -0.05),
            _la("C4", "C", 0.00, -1.39, 0.00, -0.05),
            _la("C5", "C", -1.20, -0.70, 0.00, -0.05),
            _la("C6", "C", -1.20, 0.70, 0.00, -0.05),
            _la("C7", "C", 0.00, 2.85, 0.00, 0.45),
            _la("O1", "O", 1.15, 3.25, 0.00, -0.52, acceptor=True),
            _la("O2", "O", -1.10, 3.30, 0.00, -0.45, donor=True, acceptor=True),
            _la("O3", "O", 2.35, 1.55, 0.15, -0.38, acceptor=True),
            _la("C8", "C", 2.95, 2.75, 0.30, 0.42),
            _la("O4", "O", 4.10, 3.15, 0.45, -0.52, acceptor=True),
            _la("C9", "C", 1.85, 3.85, 0.50, -0.16),
        ),
    ),
    # Ibuprofen — reduced 14-heavy-atom model (the α-methyl is omitted).
    "ibuprofen": LigandModel(
        name="ibuprofen",
        description=(
            "2-(4-isobutylphenyl)propanoic acid — reduced 14-heavy-atom model "
            "(the α-methyl of the propanoic acid is omitted to fit the "
            "modelling budget; ring, isobutyl and carboxyl pharmacophores kept)."
        ),
        atoms=(
            _la("C1", "C", 0.00, 1.40, 0.00, -0.05),
            _la("C2", "C", 1.21, 0.70, 0.00, -0.05),
            _la("C3", "C", 1.21, -0.70, 0.00, -0.05),
            _la("C4", "C", 0.00, -1.40, 0.00, 0.05),
            _la("C5", "C", -1.21, -0.70, 0.00, -0.05),
            _la("C6", "C", -1.21, 0.70, 0.00, -0.05),
            _la("C7", "C", 0.00, 2.90, 0.00, -0.08),
            _la("C8", "C", 1.30, 3.55, 0.30, -0.06),
            _la("C9", "C", 2.45, 2.65, 0.60, -0.12),
            _la("C10", "C", 1.80, 4.90, 0.35, -0.12),
            _la("C11", "C", 0.00, -2.85, 0.00, -0.07),
            _la("C12", "C", 0.00, -4.30, 0.40, 0.46),
            _la("O1", "O", 1.10, -4.90, 0.60, -0.52, acceptor=True),
            _la("O2", "O", -1.10, -4.80, 0.55, -0.46, donor=True, acceptor=True),
        ),
    ),
    # Caffeine — all 14 heavy atoms of the xanthine core.
    "caffeine": LigandModel(
        name="caffeine",
        description=(
            "1,3,7-trimethylxanthine, all 14 heavy atoms.  Caffeine has no "
            "classical H-bond donor; N9 is flagged as a weak donor (the "
            "theophylline-like N–H tautomer) so the model carries both "
            "donor and acceptor character, as documented."
        ),
        atoms=(
            _la("N1", "N", 0.00, 1.40, 0.00, -0.25),
            _la("C2", "C", 1.21, 0.70, 0.00, 0.42),
            _la("N3", "N", 1.21, -0.70, 0.00, -0.25),
            _la("C4", "C", 0.00, -1.40, 0.00, 0.16),
            _la("C5", "C", -1.21, -0.70, 0.00, -0.08),
            _la("C6", "C", -1.21, 0.70, 0.00, 0.46),
            _la("N9", "N", -0.55, -2.60, 0.00, -0.22, donor=True),
            _la("C8", "C", -1.95, -2.55, 0.00, 0.14),
            _la("N7", "N", -2.50, -1.35, 0.00, -0.20),
            _la("O2", "O", 2.35, 1.35, 0.00, -0.50, acceptor=True),
            _la("O6", "O", -2.35, 1.35, 0.00, -0.50, acceptor=True),
            _la("C10", "C", 0.00, 2.85, 0.15, -0.14),
            _la("C11", "C", 2.45, -1.30, 0.15, -0.14),
            _la("C12", "C", -3.89, -0.94, 0.20, -0.14),
        ),
    ),
    # Warfarin — reduced 12-heavy-atom 4-hydroxycoumarin scaffold.
    "warfarin": LigandModel(
        name="warfarin",
        description=(
            "4-hydroxycoumarin scaffold (12 heavy atoms) — the shared warfarin "
            "pharmacophore; the 1-phenyl-3-oxobutyl side chain is omitted in "
            "this reduced model."
        ),
        atoms=(
            _la("C5", "C", 0.00, 1.40, 0.00, -0.05),
            _la("C6", "C", 1.21, 0.70, 0.00, -0.05),
            _la("C7", "C", 1.21, -0.70, 0.00, -0.05),
            _la("C8", "C", 0.00, -1.40, 0.00, -0.05),
            _la("C8A", "C", -1.21, -0.70, 0.00, 0.10),
            _la("C4A", "C", -1.21, 0.70, 0.00, 0.10),
            _la("O1", "O", -2.42, 1.40, 0.00, -0.34, acceptor=True),
            _la("C2", "C", -3.63, 0.70, 0.00, 0.46),
            _la("C3", "C", -3.63, -0.70, 0.00, -0.10),
            _la("C4", "C", -2.42, -1.40, 0.00, 0.36),
            _la("O2", "O", -4.75, 1.35, 0.00, -0.50, acceptor=True),
            _la("O4", "O", -2.42, -2.85, 0.00, -0.42, donor=True, acceptor=True),
        ),
    ),
}


# ── Pocket detection ───────────────────────────────────────────────────────


def find_pocket(atoms: list[PdbAtom], center_resi: int | None = None) -> Pocket:
    """Locate the docking pocket.

    With `center_resi` the pocket is that residue's Cα (centroid fallback for
    residues without a Cα, e.g. a HETATM centre).  Otherwise the density peak
    is used: among the primary chain's residues, the one with the most other
    residues' Cα within 10 Å — a crude but deterministic cavity proxy.
    """
    ca_atoms = [a for a in atoms if a.record == "ATOM" and a.name == "CA"]
    polymer = [a for a in atoms if a.record == "ATOM"]
    if not polymer:
        raise DockingError("No polymer atoms found in the structure.")
    counts: dict[str, int] = {}
    for a in polymer:
        counts[a.chain] = counts.get(a.chain, 0) + 1
    primary = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]

    if center_resi is not None:
        for pool in (
            [a for a in ca_atoms if a.resseq == center_resi and a.chain == primary],
            [a for a in ca_atoms if a.resseq == center_resi],
        ):
            if pool:
                a = pool[0]
                return Pocket(a.resseq, a.resname, a.chain, a.x, a.y, a.z)
        for pool in (
            [a for a in atoms if a.resseq == center_resi and a.chain == primary],
            [a for a in atoms if a.resseq == center_resi],
        ):
            if pool:
                n = float(len(pool))
                return Pocket(
                    pool[0].resseq,
                    pool[0].resname,
                    pool[0].chain,
                    sum(a.x for a in pool) / n,
                    sum(a.y for a in pool) / n,
                    sum(a.z for a in pool) / n,
                )
        raise DockingError(f"Residue {center_resi} was not found in the structure.")

    if not ca_atoms:
        raise DockingError("No protein Cα atoms found in the structure.")
    best: tuple[int, int, str] | None = None
    best_point: PdbAtom | None = None
    cutoff_sq = _POCKET_CUTOFF * _POCKET_CUTOFF
    for cand in ca_atoms:
        if cand.chain != primary:
            continue
        neighbours = 0
        for other in ca_atoms:
            if other.chain == cand.chain and other.resseq == cand.resseq:
                continue
            dx = other.x - cand.x
            dy = other.y - cand.y
            dz = other.z - cand.z
            if dx * dx + dy * dy + dz * dz <= cutoff_sq:
                neighbours += 1
        key = (-neighbours, cand.resseq, cand.chain)
        if best is None or key < best:
            best = key
            best_point = cand
    if best_point is None:
        raise DockingError("No pocket could be resolved for this structure.")
    return Pocket(
        best_point.resseq, best_point.resname, best_point.chain,
        best_point.x, best_point.y, best_point.z,
    )


# ── Empirical docking score ────────────────────────────────────────────────


def dock_ligand(atoms: list[PdbAtom], ligand_name: str, center_resi: int | None = None) -> dict:
    """Score a ligand model against a parsed structure.

    Returns the response fragment consumed by the route: delta_g, Kd, pocket
    and the capped contact list.  See the module docstring for the exact
    empirical terms — this is a Vina-like approximation, not a free-energy
    calculation.
    """
    model = LIGANDS.get(ligand_name)
    if model is None:
        raise DockingError("Unknown ligand.")
    pocket = find_pocket(atoms, center_resi)

    n = float(len(model.atoms))
    cx = sum(a.x for a in model.atoms) / n
    cy = sum(a.y for a in model.atoms) / n
    cz = sum(a.z for a in model.atoms) / n
    placed = [
        (a, a.x - cx + pocket.x, a.y - cy + pocket.y, a.z - cz + pocket.z)
        for a in model.atoms
    ]
    radius = max(
        math.sqrt((a.x - cx) ** 2 + (a.y - cy) ** 2 + (a.z - cz) ** 2)
        for a in model.atoms
    )

    # Pre-filter: only atoms that can possibly sit within _PAIR_CUTOFF of a
    # placed ligand atom.  Waters and hydrogens are excluded from scoring —
    # the same solvent stripping real docking pipelines do.
    reach = radius + _PAIR_CUTOFF
    reach_sq = reach * reach
    nearby: list[PdbAtom] = []
    for a in atoms:
        if a.element == "H":
            continue
        if a.record == "HETATM" and a.resname in _WATER_RESNAMES:
            continue
        dx = a.x - pocket.x
        dy = a.y - pocket.y
        dz = a.z - pocket.z
        if dx * dx + dy * dy + dz * dz <= reach_sq:
            nearby.append(a)

    pair_cutoff_sq = _PAIR_CUTOFF * _PAIR_CUTOFF
    total = 0.0
    found: list[tuple[int, float, dict]] = []
    for la, lx, ly, lz in placed:
        l_sigma, l_eps = _element_params(la.element)
        for pa in nearby:
            dx = lx - pa.x
            dy = ly - pa.y
            dz = lz - pa.z
            r_sq = dx * dx + dy * dy + dz * dz
            if r_sq > pair_cutoff_sq:
                continue
            r = math.sqrt(r_sq)
            p_sigma, p_eps = _element_params(pa.element)
            sigma = 0.5 * (l_sigma + p_sigma)
            eps = _VDW_SCALE * math.sqrt(l_eps * p_eps)
            if r < 1e-3:
                term = _LJ_CAP  # exact overlap — the soft cap stands in
            else:
                sr = sigma / r
                sr6 = sr ** 6
                term = eps * (sr6 * sr6 - 2.0 * sr6)
                if term > _LJ_CAP:
                    term = _LJ_CAP
            total += term

            kind = "vdw"
            # Protein O atoms accept; protein N atoms donate (documented).
            if _HBOND_MIN <= r <= _HBOND_MAX and (
                (la.donor and pa.element == "O") or (la.acceptor and pa.element == "N")
            ):
                total += _HBOND_ENERGY
                kind = "hbond"
            if r < _CLASH_CUTOFF and la.element != "H" and pa.element != "H":
                total += _CLASH_ENERGY
                if kind == "vdw":
                    kind = "clash"
            found.append((
                _CONTACT_ORDER[kind],
                r,
                {
                    "ligand_atom": la.name,
                    "ligand_element": la.element,
                    "residue": f"{pa.resname}{pa.resseq}:{pa.chain}",
                    "atom": pa.name,
                    "type": kind,
                    "distance_angstrom": round(r, 2),
                },
            ))

    found.sort(key=lambda t: (t[0], t[1]))
    delta_g = total + _ENTROPIC
    if not math.isfinite(delta_g):
        raise DockingError("Docking score did not converge.")
    exponent = max(-_EXPONENT_LIMIT, min(_EXPONENT_LIMIT, delta_g / _RT))
    kd = math.exp(exponent)
    return {
        "delta_g_kcal_per_mol": round(delta_g, 2),
        "kd_molar": kd,
        "kd_label": _kd_label(kd),
        "pocket": {"resi": pocket.resi, "resname": pocket.resname},
        "contacts": [c for _, _, c in found[:_MAX_CONTACTS]],
    }


def _kd_label(kd: float) -> str:
    if kd < 1e-9:
        return "sub-nM"
    if kd < 1e-6:
        return "nM"
    if kd < 1e-3:
        return "µM"
    if kd < 1.0:
        return "mM"
    return "weak (mM+)"


# ── Solvent denaturation models ────────────────────────────────────────────
#
# Empirical two-state linear-extrapolation models, documented as such:
#   ε(c)            = 78.5 + epsilon_slope · c          (dielectric constant)
#   fraction_unfolded = 1 / (1 + exp((Cm − c) / s))     (two-state sigmoid)
# Cm (midpoint molarity) and m (kcal mol⁻¹ M⁻¹) are literature-scale
# constants for each denaturant, not measurements made here.

SOLVENTS: dict[str, SolventModel] = {
    "ethanol": SolventModel(
        name="ethanol",
        cm_molar=4.2,
        m_value=1.6,
        s=1.0,
        epsilon_water=78.5,
        epsilon_slope=-2.4,
        notes=(
            "Empirical two-state linear-extrapolation model: ε(c) = 78.5 − 2.4·c "
            "(ethanol lowers the dielectric constant of the medium); Cm = 4.2 M, "
            "m = 1.6 kcal mol⁻¹ M⁻¹, s = 1.0 M. Ethanol partitions into the "
            "hydrophobic core and destabilizes it — an order-of-magnitude "
            "estimate, not a measured denaturation isotherm."
        ),
        seed=11,
        core_attack=1.6,
        collapse=0.45,
        dcm_dt=-0.02,
    ),
    "urea": SolventModel(
        name="urea",
        cm_molar=6.5,
        m_value=1.2,
        s=1.5,
        epsilon_water=78.5,
        epsilon_slope=0.5,
        notes=(
            "Empirical two-state linear-extrapolation model: ε(c) = 78.5 + 0.5·c; "
            "Cm = 6.5 M, m = 1.2 kcal mol⁻¹ M⁻¹, s = 1.5 M. Urea raises the "
            "dielectric constant only slightly and acts mainly by competing for "
            "backbone hydrogen bonds — an order-of-magnitude estimate."
        ),
        seed=23,
        core_attack=0.9,
        collapse=0.35,
        dcm_dt=-0.04,
    ),
    "guanidinium": SolventModel(
        name="guanidinium",
        cm_molar=2.6,
        m_value=2.4,
        s=0.8,
        epsilon_water=78.5,
        epsilon_slope=1.0,
        notes=(
            "Empirical two-state linear-extrapolation model: ε(c) = 78.5 + 1.0·c; "
            "Cm = 2.6 M, m = 2.4 kcal mol⁻¹ M⁻¹, s = 0.8 M. Guanidinium chloride "
            "(GdmCl) is the strongest of the three denaturants per mole; it is "
            "charged and also perturbs the ionic atmosphere — an "
            "order-of-magnitude estimate."
        ),
        seed=37,
        core_attack=0.9,
        collapse=0.25,
        dcm_dt=-0.03,
    ),
    "dmso": SolventModel(
        name="dmso",
        cm_molar=4.5,
        m_value=1.0,
        s=1.3,
        epsilon_water=78.5,
        epsilon_slope=-1.1,
        notes=(
            "Empirical two-state model: ε(c) = 78.5 − 1.1·c; Cm = 4.5 M, "
            "m = 1.0 kcal mol⁻¹ M⁻¹, s = 1.3 M. DMSO is a mild "
            "cosolvent denaturant that lowers the dielectric constant "
            "(ε ~ 47 neat) and weakly attacks the hydrophobic core — "
            "order-of-magnitude literature-scale constants."
        ),
        seed=41,
        core_attack=1.1,
        collapse=0.5,
        dcm_dt=-0.01,
    ),
    "tfe": SolventModel(
        name="tfe",
        cm_molar=2.5,
        m_value=1.8,
        s=0.9,
        epsilon_water=78.5,
        epsilon_slope=-2.0,
        notes=(
            "Empirical two-state model: ε(c) = 78.5 − 2.0·c; Cm = 2.5 M, "
            "m = 1.8 kcal mol⁻¹ M⁻¹, s = 0.9 M. 2,2,2-trifluoroethanol "
            "is a strong helix-inducing cosolvent at low concentration and a "
            "potent core destabilizer at higher concentration — "
            "order-of-magnitude literature-scale constants."
        ),
        seed=53,
        core_attack=2.2,
        collapse=0.3,
        dcm_dt=-0.02,
    ),
    "methanol": SolventModel(
        name="methanol",
        cm_molar=5.5,
        m_value=1.4,
        s=1.2,
        epsilon_water=78.5,
        epsilon_slope=-1.6,
        notes=(
            "Empirical two-state model: ε(c) = 78.5 − 1.6·c; Cm = 5.5 M, "
            "m = 1.4 kcal mol⁻¹ M⁻¹, s = 1.2 M. Methanol is a weaker "
            "core destabilizer than ethanol — order-of-magnitude "
            "literature-scale constants."
        ),
        seed=67,
        core_attack=1.3,
        collapse=0.5,
        dcm_dt=-0.02,
    ),
    "sds": SolventModel(
        name="sds",
        cm_molar=0.9,
        m_value=3.2,
        s=0.4,
        epsilon_water=78.5,
        epsilon_slope=0.0,
        notes=(
            "Empirical two-state model: Cm = 0.9 M (≈ 0.3% w/v), "
            "m = 3.2 kcal mol⁻¹ M⁻¹, s = 0.4 M. Sodium dodecyl sulfate "
            "unfolds at millimolar concentrations through Coulombic wrapping "
            "of the peptide chain — order-of-magnitude literature-scale "
            "constants."
        ),
        seed=71,
        core_attack=0.6,
        collapse=0.85,
        dcm_dt=0.0,
    ),
    "heat": SolventModel(
        name="heat",
        cm_molar=68.0,
        m_value=0.0,
        s=7.0,
        epsilon_water=78.5,
        epsilon_slope=-0.02,
        notes=(
            "Empirical two-state thermal model: the midpoint is Tm = 68 °C "
            "with a sigmoid width s = 7 °C. The dielectric constant falls "
            "only weakly with temperature — order-of-magnitude "
            "literature-scale constants, not a measured melting curve."
        ),
        seed=83,
        core_attack=1.2,
        collapse=0.55,
        dcm_dt=0.0,
        axis="temperature",
        axis_max=95.0,
    ),
}


def solvent_curve(solvent: str, temperature_c: float = 25.0) -> dict:
    """Dielectric constant and unfolded fraction across the solvent's axis.

    Two-state linear-extrapolation models, documented in the module
    docstring and in the per-solvent notes — honest approximations, not a
    free-energy calculation.  For molar solvents the temperature shifts the
    midpoint: Cm_eff = Cm + dcm_dt·(T − 25).  For axis="temperature"
    (heat) the curve spans degrees Celsius instead of molarity.
    """
    model = SOLVENTS.get(solvent)
    if model is None:
        raise DockingError("Unknown solvent.")
    temp = max(0.0, min(100.0, float(temperature_c)))
    cm_eff = model.cm_molar + model.dcm_dt * (temp - 25.0)
    curve: list[dict] = []
    for i in range(_SOLVENT_POINTS):
        x = model.axis_max * i / (_SOLVENT_POINTS - 1)
        epsilon = model.epsilon_water + model.epsilon_slope * x
        fraction = 1.0 / (1.0 + math.exp((cm_eff - x) / model.s))
        curve.append({
            "concentration_molar": round(x, 3),
            "temperature_c": round(x if model.axis == "temperature" else temp, 2),
            "dielectric_constant": round(epsilon, 2),
            "fraction_unfolded": round(fraction, 3),
        })
    return {
        "solvent": model.name,
        "cm_molar": round(cm_eff, 3),
        "m_value_kcal_per_mol_per_molar": model.m_value,
        "dielectric_curve": curve,
        "notes": model.notes,
        # Viewer parameterization — deterministic, documented per solvent.
        "seed": model.seed,
        "core_attack": model.core_attack,
        "collapse": model.collapse,
        "dcm_dt": model.dcm_dt,
        "axis": model.axis,
        "axis_max": model.axis_max,
        "temperature_c": temp,
    }
