"""Structure endpoints: RCSB PDB models, AlphaFold models, backbone writhe.

The R3F viewer consumes a ~160-point Cα trace of the primary chain together
with per-residue local writhe, active-site residues (from SITE records, plus a
curated catalytic set for RuBisCO) and metal ions (from HETATM records).
Active-site residues carry their exact Cα coordinates so the viewer can place
markers without re-deriving them from the downsampled trace.

The Mol* → 3Dmol cartoon viewer additionally consumes the *raw* PDB file
(`/structure/pdb/{id}/file`, `/structure/alphafold/{accession}/file`): a
cartoon needs the full atom set and the HELIX/SHEET records, which the
downsampled trace deliberately does not carry. Those files are proxied
verbatim (fixed error mapping, byte cap, 24 h cache) — never re-parsed.
"""
from __future__ import annotations

from collections import Counter

import httpx
from fastapi import APIRouter, HTTPException, Path, Query, Response

from ..cache import TTLCache
from ..config import get_settings
from ..parsers import ParsedPdb, ParseError, ResiduePoint, parse_pdb_text
from ..services import alphafold
from ..writhe import downsample, local_writhe, writhe

router = APIRouter(tags=["structure"])

_cache = TTLCache(ttl_s=86400, max_entries=100)
# Raw structure files (one ~0.1–2 MB string per entry) live in their own
# 24 h cache so they never evict the parsed model payloads.
_raw_cache = TTLCache(ttl_s=86400, max_entries=100)
_MAX_TRACE_POINTS = 160
# A hostile or bloated upstream file is refused before it is cached or
# served — the viewer never receives an unbounded body.
_MAX_FILE_BYTES = 64 * 1024 * 1024

# UniProtKB accession grammar (6-char TrEMBL + 10-char forms). Anything else —
# e.g. a PDB ID like "2BMY" typed into the UniProt field — is rejected with a
# 422 before it ever reaches an upstream URL.
_UNIPROT_RE = r"^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2})$"

CATALOG = [
    {
        "id": "lig1",
        "pdb": "1X9N",
        "title": "Human DNA ligase I — catalytic core",
        "note": "Base-excision-repair junction enzyme (challenge target). Backbone writhe + active-site geometry.",
    },
    {
        "id": "rubisco",
        "pdb": "8RUC",
        "title": "RuBisCO (spinach) — activated",
        "note": "Ribulose-1,5-bisphosphate carboxylase/oxygenase. Catalytic Mg²⁺ site and carbamylated lysine.",
    },
]

# Curated catalytic residues of activated spinach RuBisCO (PDB 8RUC / 1RXO).
# The SITE records in these files only name the carbamylated lysine and a
# ligand placeholder; the set below is the textbook Mg²⁺-coordinating /
# catalytic ensemble. It is a *residue reference* — coordinates are always
# resolved from the structure's own ATOM records, never hard-coded.
_RUBISCO_CATALYTIC: list[tuple[str, str, int]] = [
    ("LYS", "A", 175),
    ("KCX", "A", 201),  # carbamylated lysine — Mg²⁺ ligand
    ("ASP", "A", 203),  # Mg²⁺ ligand
    ("GLU", "A", 204),  # Mg²⁺ ligand
    ("HIS", "A", 294),
    ("LYS", "A", 334),
]
_RUBISCO_PDBS = {"8RUC", "1RXO", "1RCX"}


@router.get("/structure/catalog")
async def catalog() -> dict:
    return {"entries": CATALOG}


@router.get("/structure/rcsb/{pdb_id}")
async def rcsb_model(pdb_id: str = Path(pattern=r"^[0-9A-Za-z]{4}$")) -> dict:
    key = f"rcsb:{pdb_id.upper()}"
    cached = _cache.get(key)
    if cached is not None:
        return cached
    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.get(f"https://files.rcsb.org/download/{pdb_id.upper()}.pdb")
        if resp.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Unknown PDB ID: {pdb_id.upper()}")
        resp.raise_for_status()
        try:
            parsed = parse_pdb_text(resp.text)
        except ParseError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
    model = _finalize(parsed, source="rcsb", pdb_id=pdb_id.upper())
    _cache.set(key, model)
    return model


@router.get("/structure/alphafold/{uniprot}")
async def alphafold_model(
    uniprot: str = Path(pattern=_UNIPROT_RE),
    full: bool = Query(default=False, description="Return the full Cα trace (no writhe fields)."),
) -> dict:
    key = f"af:{uniprot}:{full}"
    cached = _cache.get(key)
    if cached is not None:
        return cached
    try:
        raw = await alphafold.fetch_model(uniprot)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AlphaFold upstream error: {exc}")
    model = _finalize_from_dicts(
        raw["points"],
        source="alphafold",
        uniprot=uniprot,
        title=f"AlphaFold model — {uniprot}",
        full=full,
    )
    model["mean_plddt"] = raw["mean_plddt"]
    # Comprehensive AlphaFold payload: whitelisted model metadata, full
    # per-residue pLDDT list (sequence track) and PAE availability flag.
    model["model_metadata"] = raw["model_metadata"]
    model["pae_available"] = raw["pae_available"]
    model["residues_full"] = raw["residues_full"]
    _cache.set(key, model)
    return model


@router.get("/structure/alphafold/{uniprot}/confidence")
async def alphafold_confidence(uniprot: str = Path(pattern=_UNIPROT_RE)) -> dict:
    """PAE (predicted aligned error) matrix for an AlphaFold model.

    Upstream matrix files are strictly validated and mean-pooled to the
    configured display size (default 200×200). Never proxied raw.
    """
    key = f"afpae:{uniprot}"
    cached = _cache.get(key)
    if cached is not None:
        return cached
    try:
        data = await alphafold.fetch_confidence(uniprot)
    except (alphafold.PaeError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AlphaFold upstream error: {exc}")
    _cache.set(key, data)
    return data


# ── Raw structure files (3Dmol cartoon viewer) ─────────────────────────────
#
# The cartoon renderer needs the untouched PDB text: HELIX/SHEET records and
# the full atom set. Both helpers below are deliberately thin — the routes do
# the error mapping, the helpers only speak "text or raise".


def _too_large(resp: httpx.Response) -> bool:
    length = resp.headers.get("content-length")
    return bool(length and length.isdigit() and int(length) > _MAX_FILE_BYTES)


async def _fetch_rcsb_raw(pdb_id: str) -> str:
    """Download the raw PDB file for a 4-character PDB ID (24 h cache).

    Raises FileNotFoundError for an unknown ID; transport and upstream
    failures propagate to the route, which maps them to fixed messages.
    """
    key = f"rcsb_raw:{pdb_id.upper()}"
    cached = _raw_cache.get(key)
    if cached is not None:
        return cached
    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.get(f"https://files.rcsb.org/download/{pdb_id.upper()}.pdb")
        if resp.status_code == 404:
            raise FileNotFoundError(pdb_id.upper())
        resp.raise_for_status()
        if _too_large(resp):
            raise ValueError("structure file exceeds the size limit")
        text = resp.text
    _raw_cache.set(key, text)
    return text


async def _fetch_af_raw(uniprot: str) -> str:
    """Raw AlphaFold model file text for a UniProt accession (24 h cache).

    Reuses the AlphaFold service's cached metadata for the `pdbUrl` — the
    URL is never constructed client-side or accepted from the caller.
    """
    key = f"af_raw:{uniprot}"
    cached = _raw_cache.get(key)
    if cached is not None:
        return cached
    meta = await alphafold._metadata(uniprot)
    pdb_url = meta.get("pdbUrl")
    if not isinstance(pdb_url, str) or not pdb_url:
        raise ValueError("AlphaFold metadata missing the model URL.")
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.get(pdb_url)
        if resp.status_code == 404:
            raise FileNotFoundError(uniprot)
        resp.raise_for_status()
        if _too_large(resp):
            raise ValueError("structure file exceeds the size limit")
        text = resp.text
    _raw_cache.set(key, text)
    return text


@router.get("/structure/pdb/{pdb_id}/file")
async def rcsb_file(pdb_id: str = Path(pattern=r"^[0-9A-Za-z]{4}$")) -> Response:
    """Raw PDB file text for the cartoon viewer (`text/plain`, verbatim).

    Never re-serialized: the client renders it with 3Dmol, which derives the
    secondary-structure cartoon from the file's own HELIX/SHEET records.
    """
    try:
        text = await _fetch_rcsb_raw(pdb_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Unknown PDB ID: {pdb_id.upper()}")
    except Exception:
        raise HTTPException(status_code=502, detail="RCSB upstream error: the structure file could not be downloaded.")
    return Response(content=text, media_type="text/plain")


@router.get("/structure/alphafold/{uniprot}/file")
async def alphafold_file(uniprot: str = Path(pattern=_UNIPROT_RE)) -> Response:
    """Raw AlphaFold model file text for the cartoon viewer (text/plain)."""
    try:
        text = await _fetch_af_raw(uniprot)
    except (FileNotFoundError, ValueError):
        # Fixed message — the accession is pattern-validated, upstream text
        # (and any exception detail) is never echoed.
        raise HTTPException(status_code=404, detail=f"No AlphaFold model available for {uniprot}.")
    except Exception:
        raise HTTPException(status_code=502, detail="AlphaFold upstream error: the model file could not be downloaded.")
    return Response(content=text, media_type="text/plain")


def _finalize(parsed: ParsedPdb, source: str, pdb_id: str | None = None, title: str | None = None) -> dict:
    if not parsed.points:
        raise HTTPException(status_code=404, detail="No Cα atoms found in this structure.")
    primary_chain = Counter(p.chain for p in parsed.points).most_common(1)[0][0]
    strided = downsample([p for p in parsed.points if p.chain == primary_chain], _MAX_TRACE_POINTS)
    coords = [(p.x, p.y, p.z) for p in strided]
    return {
        "source": source,
        "pdb_id": pdb_id,
        "title": title or parsed.title,
        "chains": parsed.chains,
        "primary_chain": primary_chain,
        "residue_count": len(strided),
        "full_residue_count": len(parsed.points),
        "points": [
            {
                "resn": p.resname,
                "resi": p.resseq,
                "chain": p.chain,
                "x": round(p.x, 3),
                "y": round(p.y, 3),
                "z": round(p.z, 3),
                "plddt": p.bfactor if p.bfactor > 0 else None,
            }
            for p in strided
        ],
        "writhe": round(writhe(coords), 4),
        "local_writhe": [round(v, 4) for v in local_writhe(coords)],
        "active_sites": _active_sites(parsed, primary_chain, pdb_id),
        "metals": [
            {"element": m.element, "resi": m.resseq, "chain": m.chain, "x": m.x, "y": m.y, "z": m.z}
            for m in parsed.metals
        ],
        "secondary": _secondary(parsed, primary_chain),
        "coordinations": _coordinations(parsed, primary_chain),
    }


def _finalize_from_dicts(
    points: list[dict], source: str, uniprot: str, title: str, full: bool = False
) -> dict:
    if full:
        strided = points
        writhe_value = None
        local: list[float] = []
    else:
        strided = downsample(points, _MAX_TRACE_POINTS)
        coords = [(p["x"], p["y"], p["z"]) for p in strided]
        writhe_value = round(writhe(coords), 4)
        local = [round(v, 4) for v in local_writhe(coords)]
    return {
        "source": source,
        "pdb_id": None,
        "uniprot": uniprot,
        "title": title,
        "chains": sorted({p["chain"] for p in points}),
        "primary_chain": strided[0]["chain"] if strided else "A",
        "residue_count": len(strided),
        "full_residue_count": len(points),
        "points": [
            {
                "resn": p["resn"],
                "resi": p["resi"],
                "chain": p["chain"],
                "x": round(p["x"], 3),
                "y": round(p["y"], 3),
                "z": round(p["z"], 3),
                "plddt": p.get("plddt"),
            }
            for p in strided
        ],
        "writhe": writhe_value,
        "local_writhe": local,
        "active_sites": [],
        "metals": [],
        # AlphaFold model files carry no HELIX/SHEET records — the cartoon
        # falls back to a plain trace for predicted structures.
        "secondary": [],
        "coordinations": [],
    }


# Metal ↔ Cα coordination cutoff (Å). Cα sits ~3.8–5.5 Å from a ligating
# side-chain oxygen, so 6.5 Å captures direct ligands (ASP/GLU/SER/THR)
# without noise; the result is capped at 6 contacts per metal.
_COORD_CUTOFF = 6.5


def _secondary(parsed: ParsedPdb, primary_chain: str) -> list[dict]:
    spans = [
        {"kind": s.kind, "start": s.start, "end": s.end}
        for s in (*parsed.helices, *parsed.sheets)
        if s.chain == primary_chain and s.start <= s.end
    ]
    return spans[:80]


def _coordinations(parsed: ParsedPdb, primary_chain: str) -> list[dict]:
    out: list[dict] = []
    for metal_index, metal in enumerate(parsed.metals):
        if metal.chain != primary_chain:
            continue
        near: list[tuple[float, ResiduePoint]] = []
        for p in parsed.points:
            if p.chain != primary_chain:
                continue
            d = ((metal.x - p.x) ** 2 + (metal.y - p.y) ** 2 + (metal.z - p.z) ** 2) ** 0.5
            if d <= _COORD_CUTOFF:
                near.append((d, p))
        near.sort(key=lambda t: t[0])
        for d, p in near[:6]:
            # Residue Cα coordinates travel with the contact so the client
            # can draw the dashed line without re-deriving positions from
            # the (possibly downsampled) trace.
            out.append(
                {
                    "metal": metal_index,
                    "resi": p.resseq,
                    "chain": p.chain,
                    "dist": round(d, 2),
                    "x": round(p.x, 3),
                    "y": round(p.y, 3),
                    "z": round(p.z, 3),
                }
            )
    return out


def _active_sites(parsed: ParsedPdb, primary_chain: str, pdb_id: str | None) -> list[dict]:
    by_res: dict[tuple[str, int], ResiduePoint] = {
        (p.chain, p.resseq): p for p in parsed.points
    }

    def attach(resname: str, chain: str, resi: int) -> dict:
        pt = by_res.get((chain, resi))
        # The PDB's own atom records win over the curated name (handles
        # modified residues like KCX / SP in legacy RuBisCO files).
        return {
            "resname": pt.resname if pt else resname,
            "chain": chain,
            "resi": resi,
            "x": round(pt.x, 3) if pt else None,
            "y": round(pt.y, 3) if pt else None,
            "z": round(pt.z, 3) if pt else None,
        }

    sites: list[dict] = []
    for site in parsed.sites:
        residues = [attach(r, c, s) for (r, c, s) in site.residues if c == primary_chain]
        residues = [r for r in residues if r["x"] is not None]
        if residues:
            sites.append({"site_id": site.site_id, "residues": residues})

    if pdb_id and pdb_id.upper() in _RUBISCO_PDBS:
        catalytic = [attach(r, c, s) for (r, c, s) in _RUBISCO_CATALYTIC if c == primary_chain]
        catalytic = [r for r in catalytic if r["x"] is not None]
        if catalytic:
            sites.insert(0, {"site_id": "CAT", "residues": catalytic})
    return sites[:10]
