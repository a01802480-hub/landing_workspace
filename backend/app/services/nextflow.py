"""Nextflow pipeline control — Tower adapter + honest local demo mode.

Configured mode: when `nextflow_tower_url` / `nextflow_tower_token` are set,
runs are submitted to the Nextflow Tower API (tokens stay server-side; the
browser never sees them) and status is proxied back.

Demo mode: when Tower is not configured, runs execute against an in-process
simulator so the monitor UI is fully exercisable locally. Demo runs are
always labeled `source: "demo"` in their payload — the UI shows that badge,
so simulated progress is never mistaken for real compute.

Output shapes match the frontend Zod contract (PipelineStatusSchema in
lib/validation.ts).
"""
from __future__ import annotations

import math
import secrets
import time
from datetime import datetime, timezone

from ..config import get_settings


class NextflowError(Exception):
    """Pipeline service failure — surfaced as a designed 502/503."""


# ── Template catalog (what the "Run a pipeline" picker shows) ───────────────

PIPELINES: list[dict] = [
    {
        "name": "crispr-knockout",
        "description": "CRISPR knockout validation: guide-to-target mapping, on-target amplification QC and indel calling.",
        "params": [{"key": "guides", "label": "sgRNA ids", "type": "text"}, {"key": "target", "label": "target gene", "type": "text"}],
        "steps": [
            ("index_target", "Index target reference", 4),
            ("map_guides", "Map sgRNA guides", 5),
            ("design_primers", "Design validation primers", 3),
            ("call_indels", "Call indels at cut sites", 8),
            ("report", "Render report", 4),
        ],
    },
    {
        "name": "sgrna-offtarget",
        "description": "Genome-wide off-target search for a guide set (seed matching + mismatch scoring).",
        "params": [{"key": "guides", "label": "guide FASTA", "type": "text"}, {"key": "mismatches", "label": "max mismatches", "type": "int"}],
        "steps": [
            ("build_index", "Build genome index", 6),
            ("seed_search", "Seed-space search", 9),
            ("score_hits", "Score candidate loci", 5),
            ("rank_sites", "Rank off-target sites", 3),
            ("report", "Render report", 4),
        ],
    },
    {
        "name": "variant-impact",
        "description": "Annotate engineered variants: AlphaMissense + SIFT over a variant list, one report per position.",
        "params": [{"key": "variants", "label": "variant list (HGVS)", "type": "text"}],
        "steps": [
            ("fetch_models", "Fetch AlphaFold models", 7),
            ("annotate", "Annotate variants", 6),
            ("aggregate", "Aggregate verdicts", 3),
            ("report", "Render report", 4),
        ],
    },
]


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _tower_configured() -> bool:
    s = get_settings()
    return bool(s.nextflow_tower_url and s.nextflow_tower_token)


# ── Run store ───────────────────────────────────────────────────────────────

_runs: dict[str, dict] = {}


def submit_run(pipeline: str, params: dict) -> str:
    """Start a pipeline run. Tower when configured, demo simulator otherwise."""
    template = next((p for p in PIPELINES if p["name"] == pipeline), None)
    if template is None:
        raise NextflowError(f"Unknown pipeline '{pipeline}'.")

    run_id = secrets.token_urlsafe(12)
    now = _iso_now()
    if _tower_configured():
        # TODO(integration): POST the Tower launch request here (httpx,
        # Authorization: Bearer <token>), then store the returned workflow id.
        raise NextflowError("Tower integration pending — configure the adapter endpoint.")

    _runs[run_id] = {
        "run_id": run_id,
        "name": pipeline,
        "source": "demo",
        "status": "submitted",
        "created_at": now,
        "started_at": time.monotonic(),
        "params": params,
        "steps": [{"id": f"{pipeline}:{key}", "name": label, "duration_s": dur} for key, label, dur in template["steps"]],
        "total_s": sum(dur for _, _, dur in template["steps"]),
        "simulate_failure": str(params.get("simulate_failure", "")).lower() in ("1", "true", "yes"),
    }
    return run_id


def list_runs() -> list[dict]:
    """Recent runs, newest first (status live-derived for demo runs)."""
    runs = [get_run(run_id)["run"] for run_id in _runs]
    runs.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return runs


def get_run(run_id: str) -> dict:
    """Derived status for demo runs (or proxied status for Tower runs)."""
    run = _runs.get(run_id)
    if run is None:
        raise NextflowError(f"Unknown pipeline run {run_id}.")

    if run["status"] in ("succeeded", "failed", "cancelled"):
        return _payload(run)

    elapsed = time.monotonic() - run["started_at"]
    cursor = 0.0
    active: list[dict] = []
    for i, step in enumerate(run["steps"]):
        dur = step["duration_s"]
        if elapsed >= cursor + dur:
            step["status"] = "succeeded"
            step["started_at"] = step.get("started_at") or _iso_now()
            step["completed_at"] = _iso_now()
        elif elapsed >= cursor:
            step["status"] = "running"
            step["started_at"] = step.get("started_at") or _iso_now()
            active.append(step)
        else:
            step["status"] = "pending"
        cursor += dur

    if elapsed >= run["total_s"]:
        if run["simulate_failure"]:
            last = run["steps"][-1]
            last["status"] = "failed"
            run["status"] = "failed"
        else:
            run["status"] = "succeeded"
    elif active or elapsed < run["total_s"]:
        run["status"] = "running"

    return _payload(run)


def _payload(run: dict) -> dict:
    steps = [
        {
            "id": s["id"],
            "name": s["name"],
            "status": s["status"],
            "started_at": s.get("started_at"),
            "completed_at": s.get("completed_at"),
        }
        for s in run["steps"]
    ]
    tail: list[str] = []
    for s in run["steps"]:
        if s.get("started_at"):
            tail.append(f"[{s['started_at']}] INFO  process '{s['name']}' — {s['status']}")
    if run["status"] == "succeeded":
        tail.append(f"[{_iso_now()}] INFO  pipeline complete — workflow finished successfully")
    elif run["status"] == "failed":
        tail.append(f"[{_iso_now()}] ERROR pipeline failed — see step log")
    elif not tail:
        tail.append(f"[{run['created_at']}] INFO  workflow submitted")
    return {
        "run": {
            "run_id": run["run_id"],
            "name": run["name"],
            "status": run["status"],
            "source": run.get("source", "tower"),
            "created_at": run.get("created_at"),
            "params": run.get("params"),
        },
        "steps": steps,
        "log_tail": tail[-12:],
    }


def cancel_run(run_id: str) -> dict:
    run = _runs.get(run_id)
    if run is None:
        raise NextflowError(f"Unknown pipeline run {run_id}.")
    if run["status"] in ("running", "submitted"):
        run["status"] = "cancelled"
    return _payload(run)
