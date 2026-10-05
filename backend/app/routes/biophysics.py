"""Biophysics endpoints: empirical ligand docking and solvent denaturation.

The docking score and the solvent curves are Vina-like / linear-extrapolation
approximations implemented in `app.services.biophysics` — see that module for
the exact terms and the honest-approximation notes.  This router only
fetches, validates and shapes the payload.

Security: the PDB ID is regex-constrained before it is ever interpolated
into the RCSB URL, the fetched file goes through the strict fail-closed atom
reader, and every error is reported with a fixed, user-safe message — raw
upstream text is never echoed.
"""
from __future__ import annotations

from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import BaseModel, Field

from ..cache import TTLCache
from ..parsers import ParseError
from ..services import biophysics

router = APIRouter(tags=["biophysics"])

# Same 24 h policy as the other structure endpoints: upstream models are
# immutable for practical purposes, so there is no reason to re-fetch.
_pdb_cache = TTLCache(ttl_s=86400, max_entries=100)

_PDB_ID_PATTERN = r"^[0-9A-Za-z]{4}$"
_RCSB_URL = "https://files.rcsb.org/download/{pdb_id}.pdb"


class DockRequest(BaseModel):
    pdb_id: str = Field(pattern=_PDB_ID_PATTERN)
    ligand: Literal["aspirin", "ibuprofen", "caffeine", "warfarin"]
    center_resi: int | None = Field(default=None, ge=1, le=20000)


async def _fetch_pdb_text(pdb_id: str) -> str:
    """Fetch a PDB file from RCSB with a fixed 90 s timeout and 24 h cache."""
    key = pdb_id.upper()
    cached = _pdb_cache.get(key)
    if cached is not None:
        return cached
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.get(_RCSB_URL.format(pdb_id=key))
            if resp.status_code == 404:
                raise HTTPException(status_code=404, detail="Unknown PDB ID.")
            resp.raise_for_status()
    except HTTPException:
        raise
    except Exception as exc:
        # Never echo the raw httpx error — it embeds the request URL and
        # internals. One fixed, user-safe message covers timeouts and 5xx.
        raise HTTPException(status_code=502, detail="Structure source unavailable.") from exc
    text = resp.text
    _pdb_cache.set(key, text)
    return text


@router.post("/biophysics/dock")
async def dock(payload: DockRequest) -> dict:
    """Dock a hardcoded ligand model into a PDB structure's detected pocket."""
    pdb_id = payload.pdb_id.upper()
    text = await _fetch_pdb_text(pdb_id)
    try:
        atoms = biophysics.parse_pdb_atoms(text)
        result = biophysics.dock_ligand(atoms, payload.ligand, payload.center_resi)
    except (ParseError, biophysics.DockingError) as exc:
        # ParseError / DockingError messages are our own fixed strings — safe.
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"pdb_id": pdb_id, "ligand": payload.ligand, **result}


@router.get("/biophysics/solvent/{solvent}")
async def solvent(
    solvent: str = Path(pattern=r"^[a-z0-9_]{1,20}$"),
    temperature_c: float = Query(25.0, ge=0.0, le=100.0),
) -> dict:
    """Dielectric-constant and denaturation curves for a solvent.

    The name is validated against the solvent library (404 for unknowns);
    `temperature_c` shifts the midpoint for molar solvents (dCm/dT coupling).
    """
    if solvent not in biophysics.SOLVENTS:
        raise HTTPException(status_code=404, detail="Unknown solvent.")
    return biophysics.solvent_curve(solvent, temperature_c)
