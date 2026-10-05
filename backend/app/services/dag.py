"""DAG execution engine — the async supervisor behind the flow builder.

POSTed graphs are validated fail-closed (unique ids, real endpoints, no
self-loops, sequence-producing predecessors for every tool, Kahn cycle
check), then executed topologically by an asyncio task — the first real
background-execution mechanism in the codebase. Tool nodes run the local
CRISPR scanner (pure — off the event loop via asyncio.to_thread); compute
nodes drive the shared Nextflow simulator and forward its step
transitions. Progress is emitted as JSON events into a per-run
asyncio.Queue plus a retained log: the SSE route replays the log on
connect and then drains the queue live, so reconnects lose nothing.

Runs are in-memory and process-local (same contract as
services/crispr._jobs and services/nextflow._runs). Cancellation is
cooperative: a flag checked at node boundaries, cascading into
nextflow.cancel_run for the watched pipeline — never task.cancel(), which
could abort a scanner thread mid-write.

Dataflow semantics: an edge means "the target consumes the source's
output". A tool node resolves its sequence by walking upstream to the
nearest sequence input (traversing through tool nodes, whose own output
is a guide set, not a sequence).
"""
from __future__ import annotations

import asyncio
import json
import re
import secrets
import threading
from datetime import datetime, timezone

from . import crispr, nextflow

MAX_NODES = 50
MAX_EDGES = 200
MIN_SEQ_NT = 80
MAX_SEQ_NT = 10_000
MAX_EVENTS = 200
MAX_RUNS = 50
MAX_PARAMS = 20

_NODE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,60}$")
_SEQ_RE = re.compile(r"^[ACGTN]+$")

TERMINAL = ("succeeded", "failed", "cancelled")


class DagError(Exception):
    """Graph validation failure — surfaced as a designed 422."""


_runs: dict[str, dict] = {}

# Runs execute on a dedicated worker loop (daemon thread), NOT on the
# request loop: Starlette cancels tasks created inside a request scope the
# moment the response is sent, which would kill every workflow. The worker
# loop is process-local, lazily started, and survives every request.
_worker_loop: asyncio.AbstractEventLoop | None = None
_worker_lock = threading.Lock()


def _ensure_worker() -> asyncio.AbstractEventLoop:
    global _worker_loop
    with _worker_lock:
        if _worker_loop is None or _worker_loop.is_closed():
            _worker_loop = asyncio.new_event_loop()
            threading.Thread(
                target=_worker_loop.run_forever, name="protheon-dag-worker", daemon=True
            ).start()
    return _worker_loop


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ── Validation ──────────────────────────────────────────────────────────────

def _valid_id(value: object) -> bool:
    return isinstance(value, str) and bool(_NODE_ID_RE.match(value))


def validate_graph(
    nodes: list[dict], edges: list[dict]
) -> tuple[dict[str, dict], dict[str, list[str]], dict[str, list[str]], list[list[str]]]:
    """Validate a graph and return (nodes_by_id, preds, succ, levels).

    Raises DagError with a safe message on the first violation.
    """
    if not nodes:
        raise DagError("The graph has no nodes.")
    if len(nodes) > MAX_NODES:
        raise DagError(f"Too many nodes (max {MAX_NODES}).")
    if len(edges) > MAX_EDGES:
        raise DagError(f"Too many edges (max {MAX_EDGES}).")

    by_id: dict[str, dict] = {}
    for n in nodes:
        if not isinstance(n, dict) or not _valid_id(n.get("id")):
            raise DagError("Node ids must match [A-Za-z0-9_-]{1,60}.")
        if n.get("id") in by_id:
            raise DagError(f"Duplicate node id '{n['id']}'.")
        if n.get("kind") not in ("input", "tool", "compute"):
            raise DagError(f"Unknown node kind on '{n['id']}'.")
        by_id[n["id"]] = n

    preds: dict[str, list[str]] = {nid: [] for nid in by_id}
    succ: dict[str, list[str]] = {nid: [] for nid in by_id}
    indeg: dict[str, int] = {nid: 0 for nid in by_id}
    seen_edges: set[tuple[str, str]] = set()
    for e in edges:
        src, tgt = e.get("source"), e.get("target")
        if not _valid_id(src) or not _valid_id(tgt):
            raise DagError("Edge ids must match [A-Za-z0-9_-]{1,60}.")
        if src not in by_id or tgt not in by_id:
            raise DagError("Every edge must reference existing nodes.")
        if src == tgt:
            raise DagError("Self-loops are not allowed.")
        if (src, tgt) in seen_edges:
            continue
        seen_edges.add((src, tgt))
        preds[tgt].append(src)
        succ[src].append(tgt)
        indeg[tgt] += 1

    # Kahn — nodes left over after the sweep mean a cycle exists.
    queue = [nid for nid, d in indeg.items() if d == 0]
    levels: list[list[str]] = []
    seen = 0
    while queue:
        level, next_queue = queue[:], []
        levels.append(level)
        for nid in level:
            seen += 1
            for t in succ[nid]:
                indeg[t] -= 1
                if indeg[t] == 0:
                    next_queue.append(t)
        queue = next_queue
    if seen != len(by_id):
        raise DagError("The graph contains a cycle.")

    # Node payload + wiring checks.
    for nid, n in by_id.items():
        if n["kind"] == "input":
            if n.get("source_kind") not in ("sequence", "fasta", "dataframe"):
                raise DagError(f"Input '{nid}' has an unknown source kind.")
            if n["source_kind"] == "dataframe":
                df = n.get("dataframe")
                if not df or not df.get("columns") or not df.get("rows"):
                    raise DagError(f"Input '{nid}' has no dataframe payload.")
                continue
            seq = "".join((n.get("sequence") or "").split()).upper()
            if not seq:
                raise DagError(f"Input '{nid}' has no sequence payload.")
            if not _SEQ_RE.fullmatch(seq):
                raise DagError(f"Input '{nid}': sequence contains characters outside [ACGTN].")
            if not (MIN_SEQ_NT <= len(seq) <= MAX_SEQ_NT):
                raise DagError(f"Input '{nid}': sequence must be {MIN_SEQ_NT}–{MAX_SEQ_NT} nt.")
            n["sequence"] = seq
        elif n["kind"] == "tool":
            if n.get("tool") not in crispr.TOOLS:
                raise DagError(f"Unknown CRISPR tool '{n.get('tool')}'.")
            if not preds[nid]:
                raise DagError(f"Tool '{nid}' needs at least one incoming edge.")
            direct = by_id[preds[nid][0]]["kind"] if preds[nid] else None
            seq_producers = [
                p
                for p in preds[nid]
                if by_id[p]["kind"] == "tool"
                or (by_id[p]["kind"] == "input" and by_id[p]["source_kind"] in ("sequence", "fasta"))
            ]
            if not seq_producers:
                raise DagError(f"Tool '{nid}' needs a sequence-producing input (sequence, FASTA or another tool).")
        else:  # compute
            if n.get("pipeline") not in {p["name"] for p in nextflow.PIPELINES}:
                raise DagError(f"Unknown pipeline '{n.get('pipeline')}'.")
            if not preds[nid]:
                raise DagError(f"Pipeline '{nid}' needs at least one incoming edge.")
            params = n.get("params") or {}
            if not isinstance(params, dict) or len(params) > MAX_PARAMS:
                raise DagError(f"Pipeline '{nid}' params exceed the {MAX_PARAMS}-entry cap.")
            n["params"] = {str(k)[:60]: str(v)[:500] for k, v in params.items()}

    return by_id, preds, succ, levels


# ── Events ──────────────────────────────────────────────────────────────────

def _emit(run: dict, type_: str, message: str, node_id: str | None = None, data: dict | None = None) -> None:
    evt: dict = {"seq": len(run["events"]) + 1, "ts": _iso_now(), "type": type_, "message": message}
    if node_id is not None:
        evt["node_id"] = node_id
    if data:
        evt["data"] = data
    if len(run["events"]) >= MAX_EVENTS:
        run["events"] = run["events"][-(MAX_EVENTS - 1):]
    run["events"].append(evt)
    run["queue"].put_nowait(evt)


def _set_node(run: dict, node_id: str, status: str, note: str | None = None, results_count: int | None = None) -> None:
    node = run["nodes"][node_id]
    node["status"] = status
    if note is not None:
        node["note"] = note
    if results_count is not None:
        node["results_count"] = results_count


# ── Execution ───────────────────────────────────────────────────────────────

def submit_run(nodes: list[dict], edges: list[dict]) -> str:
    """Validate + start a DAG run; returns the run_id."""
    by_id, preds, succ, levels = validate_graph(nodes, edges)
    run_id = secrets.token_urlsafe(12)
    labels = {
        nid: n.get("name") or n.get("tool") or n.get("pipeline") or nid for nid, n in by_id.items()
    }
    run = {
        "run_id": run_id,
        "name": f"{len(by_id)}-node workflow",
        "source": "demo",  # honest label — real upstream adapters slot in later
        "status": "queued",
        "created_at": _iso_now(),
        "nodes": {
            nid: {"kind": n["kind"], "label": str(labels[nid])[:120], "status": "queued", "note": None, "results_count": None, "node": n}
            for nid, n in by_id.items()
        },
        "preds": preds,
        "succ": succ,
        "levels": levels,
        "edges": edges,
        "events": [],
        "queue": asyncio.Queue(),
        "cancelled": False,
    }
    # Prune: keep at most MAX_RUNS, oldest terminal first.
    terminal_runs = [r for r in _runs.values() if r["status"] in TERMINAL]
    if len(_runs) >= MAX_RUNS and terminal_runs:
        oldest = min(terminal_runs, key=lambda r: r["created_at"])
        _runs.pop(oldest["run_id"], None)
    _runs[run_id] = run
    # Schedule on the worker loop — request-scoped tasks die with the request.
    run["task"] = asyncio.run_coroutine_threadsafe(_execute(run), _ensure_worker())
    return run_id


def _upstream_sequence(run: dict, node_id: str) -> str:
    """Walk upstream (through tool nodes) to the nearest sequence input."""
    queue: list[str] = list(run["preds"][node_id])
    visited: set[str] = set()
    while queue:
        cur = queue.pop(0)
        if cur in visited:
            continue
        visited.add(cur)
        node = run["nodes"][cur]
        if node["kind"] == "input" and node["node"]["source_kind"] in ("sequence", "fasta"):
            return node["node"]["sequence"]
        queue.extend(run["preds"][cur])
    raise DagError(f"No sequence input reaches '{node_id}'.")


def _transitive_successors(run: dict, node_id: str) -> set[str]:
    out: set[str] = set()
    queue = list(run["succ"][node_id])
    while queue:
        cur = queue.pop(0)
        if cur in out:
            continue
        out.add(cur)
        queue.extend(run["succ"][cur])
    return out


async def _exec_node(run: dict, node_id: str) -> bool:
    """Execute one node; returns success. Never raises (node errors are
    emitted as node_failed and propagate downstream as skips)."""
    node = run["nodes"][node_id]
    kind = node["kind"]
    payload = node["node"]
    _set_node(run, node_id, "running")
    _emit(run, "node_started", f"{node['label']} started", node_id=node_id)
    try:
        if kind == "input":
            if payload["source_kind"] == "dataframe":
                rows = len(payload["dataframe"]["rows"])
                _set_node(run, node_id, "succeeded", results_count=rows)
                _emit(run, "node_succeeded", f"{rows:,} rows available", node_id=node_id, data={"rows": rows})
            else:
                bp = len(payload["sequence"])
                _set_node(run, node_id, "succeeded", results_count=bp)
                _emit(run, "node_succeeded", f"{bp:,} nt available", node_id=node_id, data={"bp": bp})
            return True

        if kind == "tool":
            seq = _upstream_sequence(run, node_id)
            guides = await asyncio.to_thread(
                crispr.scan_guides, seq, payload["tool"], payload.get("gene_label", ""), payload.get("organism", "")
            )
            _emit(
                run,
                "node_progress",
                f"{len(guides)} guides found — enriching off-targets",
                node_id=node_id,
                data={"done": 1, "total": 2, "note": "enriching off-targets"},
            )
            guides = await asyncio.to_thread(crispr.enrich_off_targets, guides, payload["tool"])
            node["results"] = {"guides": guides}
            _set_node(run, node_id, "succeeded", results_count=len(guides))
            _emit(run, "node_succeeded", f"{len(guides)} guides designed", node_id=node_id, data={"guides": len(guides)})
            return True

        # compute — drive the shared Nextflow simulator, forwarding steps.
        nf_id = nextflow.submit_run(payload["pipeline"], payload.get("params", {}))
        node["pipeline_run_id"] = nf_id
        _emit(run, "log", f"Nextflow run {nf_id} submitted ({payload['pipeline']})", node_id=node_id)
        seen_steps: dict[str, str] = {}
        while True:
            if run["cancelled"]:
                nextflow.cancel_run(nf_id)
                _set_node(run, node_id, "skipped", "cancelled")
                _emit(run, "node_skipped", "pipeline cancelled", node_id=node_id)
                return False
            await asyncio.sleep(1.0)
            try:
                nf = nextflow.get_run(nf_id)
            except nextflow.NextflowError:
                continue
            for step in nf.get("steps", []):
                if seen_steps.get(step["id"]) != step["status"]:
                    seen_steps[step["id"]] = step["status"]
                    _emit(
                        run,
                        "step_update",
                        f"{step['name']} — {step['status']}",
                        node_id=node_id,
                        data={
                            "pipeline_run_id": nf_id,
                            "step_id": step["id"],
                            "step_name": step["name"],
                            "step_status": step["status"],
                        },
                    )
            status = nf["run"]["status"]
            if status == "succeeded":
                _set_node(run, node_id, "succeeded", results_count=1)
                _emit(run, "node_succeeded", "pipeline finished", node_id=node_id, data={"pipeline_run_id": nf_id})
                return True
            if status == "failed":
                _set_node(run, node_id, "failed", "pipeline failed")
                _emit(run, "node_failed", "pipeline failed — see the step log", node_id=node_id, data={"pipeline_run_id": nf_id})
                return False
            if status == "cancelled":
                _set_node(run, node_id, "skipped", "pipeline cancelled")
                _emit(run, "node_skipped", "pipeline cancelled", node_id=node_id)
                return False
    except (crispr.CrisprError, nextflow.NextflowError, DagError) as exc:
        _set_node(run, node_id, "failed", str(exc)[:200])
        _emit(run, "node_failed", str(exc)[:200], node_id=node_id)
        return False
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # defensive: a node error never kills the run
        _set_node(run, node_id, "failed", str(exc)[:200])
        _emit(run, "node_failed", str(exc)[:200], node_id=node_id)
        return False


async def _execute(run: dict) -> None:
    """Topological execution: each level's nodes run concurrently; a failed
    node skips its transitive successors."""
    try:
        _emit(run, "run_started", f"workflow started — {len(run['nodes'])} nodes")
        run["status"] = "running"
        failed: set[str] = set()
        skipped: set[str] = set()

        for level in run["levels"]:
            for nid in level:
                if nid in skipped:
                    _set_node(run, nid, "skipped", "upstream node failed")
                    _emit(run, "node_skipped", "skipped — an upstream node failed", node_id=nid)
            active = [nid for nid in level if nid not in skipped]
            if not active:
                continue
            results = await asyncio.gather(*(_exec_node(run, nid) for nid in active))
            for nid, ok in zip(active, results):
                if not ok:
                    failed.add(nid)
                    skipped.update(_transitive_successors(run, nid))
            if run["cancelled"]:
                break

        if run["cancelled"]:
            run["status"] = "cancelled"
            _emit(run, "run_cancelled", "workflow cancelled")
        elif failed:
            run["status"] = "failed"
            _emit(run, "run_failed", f"{len(failed)} node(s) failed", data={"failed_nodes": sorted(failed)})
        else:
            run["status"] = "succeeded"
            _emit(run, "run_succeeded", "workflow complete")
    except asyncio.CancelledError:
        run["status"] = "cancelled"
        _emit(run, "run_cancelled", "workflow cancelled")
        raise
    except Exception as exc:  # the run must always reach a terminal state
        run["status"] = "failed"
        _emit(run, "run_failed", f"executor error: {str(exc)[:200]}")


# ── Status / listing / cancel ───────────────────────────────────────────────

def _require_run(run_id: str) -> dict:
    run = _runs.get(run_id)
    if run is None:
        raise DagError(f"Unknown DAG run {run_id}.")
    return run


def get_run(run_id: str) -> dict:
    run = _require_run(run_id)
    return {
        "run": {"run_id": run["run_id"], "status": run["status"], "created_at": run["created_at"]},
        "nodes": [
            {
                "id": nid,
                "kind": n["kind"],
                "label": n["label"],
                "status": n["status"],
                "note": n["note"],
                "results_count": n["results_count"],
            }
            for nid, n in run["nodes"].items()
        ],
    }


def list_runs() -> list[dict]:
    runs = [
        {
            "run_id": r["run_id"],
            "name": r["name"],
            "status": r["status"],
            "source": r["source"],
            "created_at": r["created_at"],
        }
        for r in _runs.values()
    ]
    runs.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return runs


def cancel_run(run_id: str) -> dict:
    run = _require_run(run_id)
    if run["status"] in ("queued", "running"):
        run["cancelled"] = True
    return get_run(run_id)


# ── SSE ─────────────────────────────────────────────────────────────────────

def _sse_frame(evt: dict) -> str:
    return f"id: {evt['seq']}\ndata: {json.dumps(evt)}\n\n"


async def stream_events(run_id: str, last_seq: int = 0):
    """Replay the retained log from `last_seq`, then drain the live queue.

    The terminal event closes the stream. Yields SSE comment lines as
    heartbeats so intermediaries never buffer the connection to death.
    """
    run = _require_run(run_id)
    sent = last_seq
    try:
        for evt in run["events"]:
            if evt["seq"] > sent:
                sent = evt["seq"]
                yield _sse_frame(evt)
        while True:
            if run["status"] in TERMINAL and run["queue"].empty():
                break
            try:
                evt = await asyncio.wait_for(run["queue"].get(), timeout=15.0)
            except asyncio.TimeoutError:
                if run["status"] in TERMINAL:
                    break
                yield ": hb\n\n"
                continue
            if evt["seq"] <= sent:
                continue
            sent = evt["seq"]
            yield _sse_frame(evt)
            if evt["type"].startswith("run_") and evt["type"] != "run_started":
                break
    except asyncio.CancelledError:
        return
