"""Variant impact: AlphaFold pLDDT + AlphaMissense + SIFT/PolyPhen (via VEP).

All three upstream calls run concurrently under one deadline; each source
degrades independently to a `{status: "unavailable", detail: ...}` object
rather than failing the whole response.
"""
from __future__ import annotations

import asyncio
import re

from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel, Field

from ..config import get_settings
from ..services import alphafold, alphamissense, uniprot, variantscan, vep
from .schemas import VariantImpactRequest

router = APIRouter(tags=["variants"])


async def _plddt_at(uniprot_id: str, position: int) -> dict:
    model = await alphafold.fetch_model(uniprot_id)
    for p in model["points"]:
        if p["resi"] == position:
            return {"status": "ok", "plddt": p["plddt"], "mean_model_plddt": model["mean_plddt"]}
    return {"status": "unavailable", "detail": "Residue not present in the AlphaFold model."}


@router.post("/variants/impact")
async def impact(req: VariantImpactRequest) -> dict:
    s = get_settings()
    try:
        entry = await uniprot.fetch_entry(req.uniprot_id)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Unknown UniProt accession: {req.uniprot_id}")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"UniProtKB upstream error: {exc}")

    async def guard(coro) -> dict:
        try:
            return await asyncio.wait_for(coro, timeout=s.variant_timeout_s)
        except asyncio.TimeoutError:
            return {"status": "timeout"}
        except Exception as exc:  # upstream failures degrade per-source
            # Some exception types stringify to "" (e.g. CancelledError) —
            # always produce a useful detail for the source card.
            return {"status": "unavailable", "detail": (str(exc) or type(exc).__name__)[:200]}

    plddt, am, sift = await asyncio.gather(
        guard(_plddt_at(req.uniprot_id, req.position)),
        guard(alphamissense.predict(req.uniprot_id, req.position, req.ref, req.alt)),
        guard(
            vep.predict(
                entry.get("gene"),
                req.position,
                req.ref,
                req.alt,
                ensembl_gene=entry.get("ensembl_gene"),
            )
        ),
    )
    return {
        "uniprot_id": req.uniprot_id,
        "gene": entry.get("gene"),
        "variant": f"p.{req.ref}{req.position}{req.alt}",
        "plddt": plddt,
        "alphamissense": am,
        "sift": sift,
    }


_UNIPROT_RE = r"^[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}$"
_SCAN_JOB_RE = r"^[A-Za-z0-9_-]{1,80}$"


class VariantScanRequest(BaseModel):
    uniprot_id: str = Field(pattern=_UNIPROT_RE)
    start: int | None = Field(default=None, ge=1, le=100000)
    end: int | None = Field(default=None, ge=1, le=100000)


@router.post("/variants/scan")
async def scan(req: VariantScanRequest) -> dict:
    """Start an all-substitutions scan over a protein window (≤ 500
    positions).  pLDDT from one model fetch, AlphaMissense per position
    (degrading per position), VEP batched for flagged positions only."""
    try:
        job_id = variantscan.submit(req.uniprot_id, req.start, req.end)
    except variantscan.VariantScanError as exc:
        raise HTTPException(status_code=422, detail=str(exc)[:200])
    return {"job_id": job_id, "status": "queued"}


@router.get("/variants/scan/{job_id}")
async def scan_status(job_id: str = Path(pattern=_SCAN_JOB_RE)) -> dict:
    try:
        return variantscan.poll(job_id)
    except variantscan.VariantScanError as exc:
        raise HTTPException(status_code=404, detail=str(exc)[:200])
