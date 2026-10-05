"""DAG run routes — submit a flow-builder graph, watch it execute.

POST /dag/runs                      launch a workflow → {run_id}
GET  /dag/runs                      recent runs
GET  /dag/runs/{id}                 live snapshot → {run, nodes}
GET  /dag/runs/{id}/stream          SSE progress stream (replay + live)
POST /dag/runs/{id}/cancel          cooperative cancel

The stream is a GET — safe by construction under the CSRF middleware,
which EventSource cannot satisfy (it sends no headers). Run payloads
carry `source: "demo"` so the UI can badge simulated progress honestly.
"""
from __future__ import annotations

from typing import Annotated, Literal, Union

from fastapi import APIRouter, HTTPException, Path, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..services import dag

router = APIRouter()

_RUN_ID_RE = r"^[A-Za-z0-9_-]{1,80}$"
_NODE_ID_RE = r"^[A-Za-z0-9_-]{1,60}$"

MAX_SEQ_NT = dag.MAX_SEQ_NT
MAX_NODES = dag.MAX_NODES
MAX_EDGES = dag.MAX_EDGES


class DataframePayload(BaseModel):
    columns: list[str] = Field(max_length=50)
    rows: list[list[str]] = Field(max_length=2000)


class InputNode(BaseModel):
    kind: Literal["input"]
    id: str = Field(pattern=_NODE_ID_RE)
    source_kind: Literal["sequence", "fasta", "dataframe"]
    name: str = Field(max_length=120)
    # Length bounds as Field(max_length) — bounded regex quantifiers blow
    # pydantic v2's compiled-regex engine limit (see routes/crispr.py).
    sequence: str | None = Field(default=None, max_length=MAX_SEQ_NT)
    dataframe: DataframePayload | None = None


class ToolNode(BaseModel):
    kind: Literal["tool"]
    id: str = Field(pattern=_NODE_ID_RE)
    tool: Literal["chopchop", "crispr_gate", "crispr_p"]
    gene_label: str = Field(default="", max_length=80)
    organism: str = Field(default="", max_length=80)


class ComputeNode(BaseModel):
    kind: Literal["compute"]
    id: str = Field(pattern=_NODE_ID_RE)
    pipeline: str = Field(pattern=r"^[a-z0-9-]{1,60}$")
    params: dict[str, str] = Field(default_factory=dict)


DagNode = Annotated[Union[InputNode, ToolNode, ComputeNode], Field(discriminator="kind")]


class DagEdge(BaseModel):
    id: str = Field(pattern=_NODE_ID_RE)
    source: str = Field(pattern=_NODE_ID_RE)
    target: str = Field(pattern=_NODE_ID_RE)


class DagRunStart(BaseModel):
    nodes: list[DagNode] = Field(min_length=1, max_length=MAX_NODES)
    edges: list[DagEdge] = Field(default_factory=list, max_length=MAX_EDGES)


@router.post("/dag/runs")
async def launch(req: DagRunStart) -> dict:
    try:
        run_id = dag.submit_run(
            [n.model_dump() for n in req.nodes],
            [e.model_dump() for e in req.edges],
        )
    except dag.DagError as exc:
        raise HTTPException(status_code=422, detail=str(exc)[:200])
    return {"run_id": run_id, "status": "queued"}


@router.get("/dag/runs")
async def runs() -> dict:
    return {"runs": dag.list_runs()}


@router.get("/dag/runs/{run_id}")
async def run_status(run_id: str = Path(pattern=_RUN_ID_RE)) -> dict:
    try:
        return dag.get_run(run_id)
    except dag.DagError as exc:
        raise HTTPException(status_code=404, detail=str(exc)[:200])


@router.get("/dag/runs/{run_id}/stream")
async def run_stream(run_id: str = Path(pattern=_RUN_ID_RE), request: Request = None) -> StreamingResponse:
    try:
        dag._require_run(run_id)
    except dag.DagError as exc:
        raise HTTPException(status_code=404, detail=str(exc)[:200])
    last_seq = 0
    if request is not None and request.headers.get("last-event-id", "").isdigit():
        last_seq = int(request.headers["last-event-id"])
    return StreamingResponse(
        dag.stream_events(run_id, last_seq),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


@router.post("/dag/runs/{run_id}/cancel")
async def run_cancel(run_id: str = Path(pattern=_RUN_ID_RE)) -> dict:
    try:
        return dag.cancel_run(run_id)
    except dag.DagError as exc:
        raise HTTPException(status_code=404, detail=str(exc)[:200])
