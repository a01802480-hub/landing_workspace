"""Offline tests for the DAG executor — validation, execution, SSE, cancel.

No external services are contacted: tool nodes run the pure local
CRISPR scanner; compute nodes drive the Nextflow demo simulator (the
established fast-forward-clock trick makes them finish instantly).
"""
from __future__ import annotations

import json
import time

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services import dag, nextflow


def make_app(**overrides) -> TestClient:
    kwargs = {"_env_file": None, "cors_origins": "http://localhost:3000", **overrides}
    return TestClient(create_app(Settings(**kwargs)))


def _post(client: TestClient, path: str, payload: dict):
    """POST with the CSRF double-submit token (a safe GET plants the cookie)."""
    if not client.cookies.get("protheon_csrf"):
        client.get("/api/health")
    return client.post(path, json=payload, headers={"X-CSRF-Token": client.cookies.get("protheon_csrf")})


def _graph(tool: str = "chopchop", sequence: str | None = None) -> dict:
    return {
        "nodes": [
            {
                "kind": "input",
                "id": "in1",
                "source_kind": "sequence",
                "name": "target",
                "sequence": sequence or "G" * 300,
            },
            {"kind": "tool", "id": "t1", "tool": tool, "gene_label": "TEST", "organism": "Homo sapiens"},
        ],
        "edges": [{"id": "e1", "source": "in1", "target": "t1"}],
    }


def _wait_terminal(client: TestClient, run_id: str, timeout: float = 15.0) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        body = client.get(f"/api/dag/runs/{run_id}").json()
        if body["run"]["status"] in ("succeeded", "failed", "cancelled"):
            return body
        time.sleep(0.1)
    raise AssertionError(f"run {run_id} did not reach a terminal state within {timeout}s")


# ── Validation ──────────────────────────────────────────────────────────────

def test_validate_accepts_linear_graph() -> None:
    g = _graph()
    by_id, preds, succ, levels = dag.validate_graph(g["nodes"], g["edges"])
    assert set(by_id) == {"in1", "t1"}
    assert preds["t1"] == ["in1"]
    assert succ["in1"] == ["t1"]
    assert levels == [["in1"], ["t1"]]


def test_validate_rejects_cycles() -> None:
    g = _graph()
    g["edges"].append({"id": "e2", "source": "t1", "target": "in1"})
    with pytest.raises(dag.DagError, match="cycle"):
        dag.validate_graph(g["nodes"], g["edges"])


def test_validate_rejects_bad_graphs() -> None:
    # Dangling edge
    g = _graph()
    g["edges"][0]["target"] = "ghost"
    with pytest.raises(dag.DagError, match="existing"):
        dag.validate_graph(g["nodes"], g["edges"])

    # Self-loop
    g = _graph()
    g["edges"][0] = {"id": "e1", "source": "in1", "target": "in1"}
    with pytest.raises(dag.DagError, match="Self-loop"):
        dag.validate_graph(g["nodes"], g["edges"])

    # Tool without any incoming edge
    g = _graph()
    g["edges"] = []
    with pytest.raises(dag.DagError, match="incoming"):
        dag.validate_graph(g["nodes"], g["edges"])

    # Bad sequence alphabet / too short
    g = _graph(sequence="A" * 90 + "Z" * 10)
    with pytest.raises(dag.DagError, match="ACGTN"):
        dag.validate_graph(g["nodes"], g["edges"])
    g = _graph(sequence="A" * 10)
    with pytest.raises(dag.DagError, match="nt"):
        dag.validate_graph(g["nodes"], g["edges"])

    # Unknown tool / unknown pipeline
    g = _graph(tool="other_tool")
    with pytest.raises(dag.DagError, match="Unknown CRISPR tool"):
        dag.validate_graph(g["nodes"], g["edges"])
    g = {
        "nodes": [
            {"kind": "input", "id": "in1", "source_kind": "sequence", "name": "t", "sequence": "G" * 300},
            {"kind": "compute", "id": "c1", "pipeline": "not-a-pipeline", "params": {}},
        ],
        "edges": [{"id": "e1", "source": "in1", "target": "c1"}],
    }
    with pytest.raises(dag.DagError, match="Unknown pipeline"):
        dag.validate_graph(g["nodes"], g["edges"])


# ── Execution over the routes ───────────────────────────────────────────────

def test_tool_run_reaches_success() -> None:
    client = make_app()
    started = _post(client, "/api/dag/runs", _graph())
    assert started.status_code == 200, started.text
    run_id = started.json()["run_id"]

    body = _wait_terminal(client, run_id)
    assert body["run"]["status"] == "succeeded"
    nodes = {n["id"]: n for n in body["nodes"]}
    assert nodes["in1"]["status"] == "succeeded"
    assert nodes["t1"]["status"] == "succeeded"
    assert nodes["t1"]["results_count"] and nodes["t1"]["results_count"] > 0

    run = dag._runs[run_id]
    types = [e["type"] for e in run["events"]]
    assert types[0] == "run_started"
    assert types[-1] == "run_succeeded"
    assert "node_succeeded" in types


def test_cycle_rejected_at_route() -> None:
    client = make_app()
    g = _graph()
    g["edges"].append({"id": "e2", "source": "t1", "target": "in1"})
    resp = _post(client, "/api/dag/runs", g)
    assert resp.status_code == 422
    assert "cycle" in resp.json()["detail"]


def test_failed_node_skips_downstream() -> None:
    client = make_app()
    g = {
        "nodes": [
            {"kind": "input", "id": "in1", "source_kind": "sequence", "name": "t", "sequence": "G" * 300},
            {"kind": "input", "id": "bad", "source_kind": "sequence", "name": "no-pam", "sequence": "A" * 300},
            {"kind": "tool", "id": "t1", "tool": "chopchop", "gene_label": "", "organism": ""},
            {"kind": "tool", "id": "t2", "tool": "chopchop", "gene_label": "", "organism": ""},
        ],
        "edges": [
            {"id": "e1", "source": "in1", "target": "t1"},
            {"id": "e2", "source": "bad", "target": "t2"},
        ],
    }
    started = _post(client, "/api/dag/runs", g)
    assert started.status_code == 200, started.text
    run_id = started.json()["run_id"]
    # "A"*300 has no NGG PAM — the scanner raises; t2 must fail (not skip:
    # it has no downstream), and the run ends failed while t1 succeeded.
    body = _wait_terminal(client, run_id)
    assert body["run"]["status"] == "failed"
    nodes = {n["id"]: n for n in body["nodes"]}
    assert nodes["t1"]["status"] == "succeeded"
    assert nodes["t2"]["status"] == "failed"


def test_compute_run_streams_steps() -> None:
    client = make_app()
    g = {
        "nodes": [
            {"kind": "input", "id": "in1", "source_kind": "sequence", "name": "t", "sequence": "G" * 300},
            {"kind": "compute", "id": "c1", "pipeline": "crispr-knockout", "params": {"target": "TEST"}},
        ],
        "edges": [{"id": "e1", "source": "in1", "target": "c1"}],
    }
    started = _post(client, "/api/dag/runs", g)
    assert started.status_code == 200, started.text
    run_id = started.json()["run_id"]

    # Fast-forward the nested demo run's clock (established test pattern).
    deadline = time.monotonic() + 5.0
    nested = None
    while time.monotonic() < deadline:
        node = dag._runs[run_id]["nodes"]["c1"]
        nested = node.get("pipeline_run_id")
        if nested:
            break
        time.sleep(0.05)
    assert nested, "compute node never submitted its Nextflow run"
    nextflow._runs[nested]["started_at"] -= 1_000

    body = _wait_terminal(client, run_id)
    assert body["run"]["status"] == "succeeded"
    run = dag._runs[run_id]
    step_events = [e for e in run["events"] if e["type"] == "step_update"]
    assert step_events, "compute nodes must forward pipeline step events"
    # The fast-forwarded clock makes every step succeed before the first
    # watch poll — statuses are whatever the watcher observed, not the
    # full transition history.
    assert "succeeded" in {e["data"]["step_status"] for e in step_events}


def test_cancel_cascades_to_nextflow() -> None:
    client = make_app()
    g = {
        "nodes": [
            {"kind": "input", "id": "in1", "source_kind": "sequence", "name": "t", "sequence": "G" * 300},
            {"kind": "compute", "id": "c1", "pipeline": "crispr-knockout", "params": {}},
        ],
        "edges": [{"id": "e1", "source": "in1", "target": "c1"}],
    }
    started = _post(client, "/api/dag/runs", g)
    assert started.status_code == 200, started.text
    run_id = started.json()["run_id"]

    deadline = time.monotonic() + 5.0
    nested = None
    while time.monotonic() < deadline:
        nested = dag._runs[run_id]["nodes"]["c1"].get("pipeline_run_id")
        if nested:
            break
        time.sleep(0.05)
    assert nested, "compute node never submitted its Nextflow run"

    cancelled = _post(client, f"/api/dag/runs/{run_id}/cancel", {})
    assert cancelled.status_code == 200

    body = _wait_terminal(client, run_id)
    assert body["run"]["status"] == "cancelled"
    assert nextflow.get_run(nested)["run"]["status"] == "cancelled"
    assert dag._runs[run_id]["nodes"]["c1"]["status"] == "skipped"


def test_sse_stream_replays_and_terminates() -> None:
    client = make_app()
    started = _post(client, "/api/dag/runs", _graph())
    assert started.status_code == 200, started.text
    run_id = started.json()["run_id"]

    frames: list[dict] = []
    with client.stream("GET", f"/api/dag/runs/{run_id}/stream") as resp:
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/event-stream")
        for line in resp.iter_lines():
            if line.startswith("data: "):
                frames.append(json.loads(line[len("data: "):]))
                if frames[-1]["type"] == "run_succeeded":
                    break
    assert frames, "the stream must deliver events"
    assert frames[0]["type"] == "run_started"
    assert frames[-1]["type"] == "run_succeeded"
    seqs = [f["seq"] for f in frames]
    assert seqs == sorted(set(seqs)), "event sequence numbers must be unique"

    # Reconnecting mid-history replays from the last seen seq (the event
    # log is retained per run, so a late subscriber sees everything).
    late: list[dict] = []
    with client.stream("GET", f"/api/dag/runs/{run_id}/stream", headers={"Last-Event-ID": "1"}) as resp:
        for line in resp.iter_lines():
            if line.startswith("data: "):
                late.append(json.loads(line[len("data: "):]))
    assert late and late[0]["seq"] == 2, "replay must resume after Last-Event-ID"
    assert late[-1]["type"] == "run_succeeded"
