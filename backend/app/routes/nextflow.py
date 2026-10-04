"""Nextflow pipeline routes — trigger and monitor computational pipelines.

GET  /nextflow/pipelines    template catalog (name, description, params)
POST /nextflow/runs         launch a run → {run_id}
GET  /nextflow/runs         recent runs
GET  /nextflow/runs/{id}    live status → {run, steps, log_tail}
POST /nextflow/runs/{id}/cancel   cancel a running pipeline

Run payloads carry `source: "tower" | "demo"` so the UI can badge
simulated progress honestly.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel, Field

from ..services import nextflow

router = APIRouter()

_RUN_ID_RE = r"^[A-Za-z0-9_-]{1,80}$"
_PIPELINE_RE = r"^[a-z0-9-]{1,60}$"
_UPSTREAM_DETAIL = "Pipeline service unavailable (upstream error)."


class LaunchRequest(BaseModel):
    pipeline: str = Field(pattern=_PIPELINE_RE)
    params: dict = Field(default_factory=dict)


@router.get("/nextflow/pipelines")
async def pipelines() -> dict:
    return {"pipelines": nextflow.PIPELINES}


@router.post("/nextflow/runs")
async def launch(req: LaunchRequest) -> dict:
    try:
        run_id = nextflow.submit_run(req.pipeline, req.params)
    except nextflow.NextflowError as exc:
        raise HTTPException(status_code=502, detail=str(exc)[:200])
    return {"run_id": run_id, "status": "submitted"}


@router.get("/nextflow/runs")
async def runs() -> dict:
    return {"runs": nextflow.list_runs()}


@router.get("/nextflow/runs/{run_id}")
async def run_status(run_id: str = Path(pattern=_RUN_ID_RE)) -> dict:
    try:
        return nextflow.get_run(run_id)
    except nextflow.NextflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)[:200])


@router.post("/nextflow/runs/{run_id}/cancel")
async def run_cancel(run_id: str = Path(pattern=_RUN_ID_RE)) -> dict:
    try:
        return nextflow.cancel_run(run_id)
    except nextflow.NextflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)[:200])
