"""All-substitutions variant scan — one async job per protein window.

The scan exploits how the upstream sources actually work:
- pLDDT: ONE AlphaFold model fetch covers every position (24 h cached).
- AlphaMissense: one hotspot row PER POSITION already carries the
  classification of all 19 substitution classes — one fetch per residue,
  under a semaphore, with per-position degradation when the upstream
  fails (positions never block the whole scan).
- VEP: only the positions with at least one pathogenic/ambiguous
  substitution get a SIFT/PolyPhen pass, capped at 20 HGVS notations in a
  SINGLE batched POST (the endpoint accepts arrays natively).

Jobs follow the established MSA submit/poll pattern: in-memory bounded
FIFO, partial results visible in every poll payload, progress fields so
the UI can render rows while the scan still runs.  All upstream contact
is delegated to the existing services (alphafold / alphamissense / vep /
uniprot) — nothing is re-implemented here.
"""
from __future__ import annotations

import asyncio
import secrets
import threading

from . import alphafold, uniprot, vep
from .alphamissense import _class_for, fetch_row

_worker_loop: asyncio.AbstractEventLoop | None = None
_worker_lock = threading.Lock()


def _ensure_worker() -> asyncio.AbstractEventLoop:
    """The scan runs on a module-level worker loop (daemon thread):
    tasks created inside a request scope are cancelled by Starlette the
    moment the response is sent."""
    global _worker_loop
    with _worker_lock:
        if _worker_loop is None or _worker_loop.is_closed():
            _worker_loop = asyncio.new_event_loop()
            threading.Thread(
                target=_worker_loop.run_forever, name="protheon-variant-scan", daemon=True
            ).start()
    return _worker_loop

MAX_POSITIONS = 500
VEP_MAX_NOTATIONS = 20
_MAX_JOBS = 10
_AM_SEMAPHORE = asyncio.Semaphore(4)

_AMINO_ACIDS = "ACDEFGHIKLMNPQRSTVWY"

_jobs: dict[str, dict] = {}


class VariantScanError(Exception):
    """Scan validation failure — surfaced as a designed 422."""


def _iso_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def submit(uniprot_id: str, start: int | None, end: int | None) -> str:
    """Validate + schedule a scan; returns the job id."""
    if len(_jobs) >= _MAX_JOBS:
        _jobs.pop(next(iter(_jobs)), None)
    job_id = secrets.token_urlsafe(16)
    job = {
        "job_id": job_id,
        "uniprot_id": uniprot_id,
        "status": "queued",
        "created_at": _iso_now(),
        "total": 0,
        "scanned": 0,
        "vep_applied": False,
        "positions": [],
        "detail": None,
        "start": start,
        "end": end,
    }
    _jobs[job_id] = job
    job["task"] = asyncio.run_coroutine_threadsafe(_run(job), _ensure_worker())
    return job_id


def poll(job_id: str) -> dict:
    job = _jobs.get(job_id)
    if job is None:
        raise VariantScanError(f"Unknown variant scan job {job_id}.")
    return {
        "status": job["status"],
        "job_id": job["job_id"],
        "uniprot_id": job["uniprot_id"],
        "progress": {"scanned": job["scanned"], "total": job["total"]},
        "vep_applied": job["vep_applied"],
        "positions": job["positions"],
        "detail": job["detail"],
    }


def _plddt_by_position(model: dict) -> dict[int, float]:
    out: dict[int, float] = {}
    for p in model.get("points", []) or []:
        out[p["resi"]] = p["plddt"]
    return out


async def _run(job: dict) -> None:
    try:
        entry = await uniprot.fetch_entry(job["uniprot_id"])
        gene = entry.get("gene")
        ensembl_gene = entry.get("ensembl_gene")
        length = int(entry.get("length") or 0)
        if length <= 0:
            raise VariantScanError("The entry has no sequence length.")
        start = max(1, min(job["start"] or 1, length))
        end = min(job["end"] or length, length)
        if start > end:
            raise VariantScanError("Start must be ≤ end.")
        if end - start + 1 > MAX_POSITIONS:
            raise VariantScanError(f"A scan covers at most {MAX_POSITIONS} positions.")
        job["status"] = "running"
        job["total"] = end - start + 1

        # pLDDT — one model fetch for every position.
        plddt: dict[int, dict] = {}
        try:
            model = await alphafold.fetch_model(job["uniprot_id"])
            plddt_by = _plddt_by_position(model)
            for pos in range(start, end + 1):
                if pos in plddt_by:
                    plddt[pos] = {"status": "ok", "plddt": plddt_by[pos], "mean_model_plddt": model.get("mean_plddt")}
                else:
                    plddt[pos] = {"status": "unavailable", "detail": "Residue not in the AlphaFold model."}
        except Exception:
            for pos in range(start, end + 1):
                plddt[pos] = {"status": "unavailable", "detail": "AlphaFold model unavailable."}

        # AlphaMissense — per-position row under a semaphore.
        async def scan_position(pos: int) -> dict:
            record = {
                "position": pos,
                "ref": None,
                "plddt": plddt.get(pos),
                "alphamissense": None,
                "sift": None,
            }
            try:
                async with _AM_SEMAPHORE:
                    row = await fetch_row(job["uniprot_id"], pos)
                if row is None:
                    record["alphamissense"] = {"status": "unavailable", "detail": "Position not in the AlphaMissense table."}
                else:
                    ref = row.get("aa") or entry.get("sequence")[pos - 1 : pos] or "X"
                    substitutions: list[dict] = []
                    for alt in _AMINO_ACIDS:
                        if alt == ref:
                            continue
                        cls = _class_for(row, alt)
                        if cls:
                            substitutions.append({"alt": alt, "class": cls})
                    record["ref"] = ref
                    record["alphamissense"] = {
                        "status": "ok",
                        "mean": row.get("mean"),
                        "substitutions": substitutions,
                    }
            except Exception:
                record["alphamissense"] = {"status": "unavailable", "detail": "AlphaMissense upstream error."}
            return record

        results = []
        for pos in range(start, end + 1):
            results.append(await scan_position(pos))
            job["scanned"] = len(results)
            job["positions"] = [r for r in results]

        # VEP pass — pathogenic/ambiguous positions only, one batched POST.
        flagged: list[tuple[int, str]] = []
        for r in results:
            am = r.get("alphamissense") or {}
            for sub in (am.get("substitutions") or []):
                if sub["class"] in ("pathogenic", "ambiguous") and r.get("ref"):
                    flagged.append((r["position"], r["ref"]))
                    break
        notations: list[str] = []
        notation_pos: dict[str, int] = {}
        for pos, ref in flagged[:VEP_MAX_NOTATIONS]:
            alt = next(
                s["alt"]
                for s in ((results[pos - start].get("alphamissense") or {}).get("substitutions") or [])
                if s["class"] in ("pathogenic", "ambiguous")
            )
            hgvs = f"p.{ref}{pos}{alt}"
            notations.append(hgvs)
            notation_pos[hgvs] = pos
        if notations:
            batch = await vep.predict_batch(gene, notations, ensembl_gene=ensembl_gene)
            job["vep_applied"] = batch.get("status") == "ok"
            if batch.get("status") == "ok":
                for hgvs, res in (batch.get("results") or {}).items():
                    pos = notation_pos.get(hgvs)
                    if pos is None:
                        continue
                    sift = res.get("sift")
                    polyphen = res.get("polyphen")
                    if sift is None and polyphen is None:
                        continue
                    results[pos - start]["sift"] = {
                        "status": "ok",
                        "sift": sift,
                        "polyphen": polyphen,
                    }
            else:
                for pos, _ in flagged[:VEP_MAX_NOTATIONS]:
                    results[pos - start]["sift"] = {"status": "unavailable", "detail": batch.get("detail", "VEP batch unavailable.")}
        job["positions"] = results
        job["status"] = "done"
    except VariantScanError as exc:
        job["status"] = "error"
        job["detail"] = str(exc)[:200]
    except Exception as exc:
        job["status"] = "error"
        job["detail"] = (str(exc) or type(exc).__name__)[:200]
