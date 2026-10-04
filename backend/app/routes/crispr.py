"""CRISPR design routes — CHOPCHOP / CRISPR-GATE / CRISPR-P 2.0 workflows.

POST /crispr/design           queue a guide-design job (target sequence +
                              tool + organism, optional region) → {job_id}
GET  /crispr/design/{job_id}  poll the job → {status, tool, results[]}

The target sequence is either pasted (≤ 10 kb, strict alphabet) or fetched
by the client from /dna/registry first. `region_start`/`region_end`
(1-based inclusive) scope the design to a selection made upstream — the
frontend → external-tool bridge: what the DNA canvas selected is exactly
what gets scanned. Guide coordinates in the results are region-relative.
Every guide the client renders crosses its Zod schema (SgRnaSchema) — this
route returns exactly that shape.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel, Field, field_validator

from ..services import crispr

router = APIRouter()

# NOTE: length bounds use Field(min_length/max_length), NOT a {80,10000}
# quantifier — pydantic v2 unrolls bounded repetitions into a compiled
# regex that can exceed the engine's 10 MB size limit and refuse to boot.
_SEQ_RE = r"^[ACGTNacgtn\s]*$"
_TOOLS = ("chopchop", "crispr_gate", "crispr_p")
_JOB_RE = r"^[A-Za-z0-9_-]{1,80}$"
_UPSTREAM_DETAIL = "CRISPR design unavailable (upstream error)."


class CrisprDesignRequest(BaseModel):
    tool: str = Field(pattern=r"^(chopchop|crispr_gate|crispr_p)$")
    sequence: str = Field(pattern=_SEQ_RE, min_length=80, max_length=10_000)
    gene_label: str = Field(default="", max_length=80)
    organism: str = Field(default="", max_length=80)
    # Optional 1-based inclusive region (a selection made on the canvas).
    region_start: int | None = Field(default=None, ge=1)
    region_end: int | None = Field(default=None, ge=1)

    @field_validator("sequence")
    @classmethod
    def _strip_whitespace(cls, v: str) -> str:
        return "".join(v.split()).upper()


@router.post("/crispr/design")
async def design_submit(req: CrisprDesignRequest) -> dict:
    """Queue a design job; the client polls the returned job id."""
    seq = req.sequence
    if req.region_start is not None or req.region_end is not None:
        # Fail closed on half-specified or inverted regions.
        if req.region_start is None or req.region_end is None:
            raise HTTPException(status_code=422, detail="Region must include both start and end.")
        if req.region_end < req.region_start:
            raise HTTPException(status_code=422, detail="Region end must be ≥ start.")
        if req.region_end > len(seq):
            raise HTTPException(status_code=422, detail="Region exceeds the sequence length.")
        seq = seq[req.region_start - 1 : req.region_end]
        if len(seq) < 80:
            raise HTTPException(status_code=422, detail="Region too short for guide design (≥ 80 nt).")
    try:
        job_id = crispr.submit_job(seq, req.tool, req.gene_label, req.organism)
    except crispr.CrisprError as exc:
        raise HTTPException(status_code=422, detail=str(exc)[:200])
    return {"job_id": job_id, "status": "queued", "tool": req.tool}


@router.get("/crispr/design/{job_id}")
async def design_status(job_id: str = Path(pattern=_JOB_RE)) -> dict:
    try:
        return crispr.poll_job(job_id)
    except crispr.CrisprError as exc:
        raise HTTPException(status_code=404, detail=str(exc)[:200])
