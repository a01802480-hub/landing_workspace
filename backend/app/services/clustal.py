"""Multi-sequence alignment (MSA) via the EBI Clustal Omega REST service.

Clustal Omega is keyless and public. The flow is deliberately stateless from
the client's point of view:

- `submit()` hands the FASTA payload to the EBI `/run` endpoint and returns an
  opaque, locally generated job id. Identical submissions are answered from a
  24 h content-hash cache without touching the upstream at all.
- `poll()` is meant to be called by the client on a timer. **One call makes at
  most one status request**; only a `FINISHED` status is followed by the
  alignment download, which is then parsed, stored and returned.

Security rules implemented here (see SECURITY_AUDIT.md):
- Every upstream response is treated as hostile: status bodies are upper-cased
  and matched against a fixed whitelist, alignment text goes through a strict
  block parser (whitelisted id shape, fixed-width columns, size caps), and no
  upstream bytes are ever echoed back to the client.
- The EBI job id is validated against `^[A-Za-z0-9_-]{1,80}$` before it is ever
  placed in a URL.
- The job table is a bounded FIFO (200 entries) — a client cannot grow server
  memory without bound by submitting alignments.
"""
from __future__ import annotations

import hashlib
import json
import re
import secrets
from collections import Counter

import httpx

from ..cache import TTLCache

_BASE_URL = "https://www.ebi.ac.uk/Tools/services/rest/clustalo"
_CONTACT_EMAIL = "protheon@example.com"
_TIMEOUT_S = 30.0
# One fixed, user-safe sentence covers every upstream failure — raw httpx
# errors embed the request URL and internals, so they never leave the server.
_UPSTREAM_DETAIL = "Clustal Omega unavailable (upstream error)."

# Job table: bounded FIFO. Results are already de-duplicated by the content
# cache below, so the table only needs to cover in-flight/polled jobs.
_MAX_JOBS = 200
_MAX_SEQUENCES = 200
_MAX_COLUMNS = 20_000

_HEADER_RE = re.compile(r"^CLUSTAL", re.IGNORECASE)
_EBI_JOB_RE = re.compile(r"^[A-Za-z0-9_-]{1,80}$")
_SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_.|:-]{1,60}$")
_DIGITS_RE = re.compile(r"\d")

# Identical submissions (same ids, same sequences, same order) reuse the
# parsed alignment for 24 h — the EBI queue is shared infrastructure.
_result_cache = TTLCache(ttl_s=86400, max_entries=200)
_jobs: dict[str, dict] = {}


class ClustalError(ValueError):
    """Unknown job or unusable upstream response. Messages are safe to show."""


def _content_key(sequences: list[dict]) -> str:
    payload = json.dumps(
        [[str(s.get("id", "")), str(s.get("sequence", ""))] for s in sequences],
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _remember(job: dict) -> str:
    """Store a job entry, evicting the oldest once the cap is exceeded."""
    job_id = secrets.token_urlsafe(16)
    _jobs[job_id] = job
    while len(_jobs) > _MAX_JOBS:
        _jobs.pop(next(iter(_jobs)), None)
    return job_id


async def submit(sequences: list[dict]) -> str:
    """Submit an MSA job; returns the local job id. Raises ClustalError."""
    key = _content_key(sequences)
    cached = _result_cache.get(key)
    if cached is not None:
        return _remember(
            {"status": "done", "result": cached, "detail": None, "ebi_id": None, "cache_key": key}
        )

    body = "\n".join(
        f">{str(s.get('id', ''))}\n{str(s.get('sequence', ''))}" for s in sequences
    )
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_S) as client:
            resp = await client.post(
                f"{_BASE_URL}/run",
                data={"email": _CONTACT_EMAIL, "sequence": body},
            )
    except Exception as exc:
        raise ClustalError(_UPSTREAM_DETAIL) from exc
    if resp.status_code != 200:
        raise ClustalError(_UPSTREAM_DETAIL)
    ebi_id = (resp.text or "").strip()
    # The upstream-supplied id goes straight into URL construction below —
    # it must match the known shape before it is trusted.
    if not _EBI_JOB_RE.fullmatch(ebi_id):
        raise ClustalError(_UPSTREAM_DETAIL)
    return _remember(
        {"status": "running", "result": None, "detail": None, "ebi_id": ebi_id, "cache_key": key}
    )


async def poll(job_id: str) -> dict:
    """Advance one job by at most one upstream status call.

    Returns {"status": "running"} / {"status": "done", "result": {...}} /
    {"status": "error", "detail": str}. Unknown jobs raise ClustalError so the
    route can answer 404. Transient upstream failures are reported as errors
    but leave the job pollable — only an explicit upstream ERROR/FAILURE (or
    an unparseable alignment) is sticky.
    """
    job = _jobs.get(job_id)
    if job is None:
        raise ClustalError("Unknown MSA job.")
    if job["status"] == "done":
        return {"status": "done", "result": job["result"]}
    if job["status"] == "error":
        return {"status": "error", "detail": job["detail"] or _UPSTREAM_DETAIL}

    ebi_id = job.get("ebi_id") or ""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_S) as client:
            status = await _remote_status(client, ebi_id)
            if status in {"ERROR", "FAILURE"}:
                job["status"] = "error"
                job["detail"] = _UPSTREAM_DETAIL
                return {"status": "error", "detail": _UPSTREAM_DETAIL}
            if status != "FINISHED":
                # RUNNING (or any unknown state) — let the client poll again.
                return {"status": "running"}
            text = await _remote_alignment(client, ebi_id)
    except Exception:
        return {"status": "error", "detail": _UPSTREAM_DETAIL}

    try:
        result = parse_clustal(text)
    except ClustalError:
        job["status"] = "error"
        job["detail"] = _UPSTREAM_DETAIL
        return {"status": "error", "detail": _UPSTREAM_DETAIL}
    job["status"] = "done"
    job["result"] = result
    if job.get("cache_key"):
        _result_cache.set(job["cache_key"], result)
    return {"status": "done", "result": result}


async def _remote_status(client: httpx.AsyncClient, ebi_id: str) -> str:
    if not _EBI_JOB_RE.fullmatch(ebi_id):
        raise ClustalError(_UPSTREAM_DETAIL)
    resp = await client.get(f"{_BASE_URL}/status/{ebi_id}")
    if resp.status_code != 200:
        raise ClustalError(_UPSTREAM_DETAIL)
    return (resp.text or "").strip().upper()


async def _remote_alignment(client: httpx.AsyncClient, ebi_id: str) -> str:
    if not _EBI_JOB_RE.fullmatch(ebi_id):
        raise ClustalError(_UPSTREAM_DETAIL)
    resp = await client.get(f"{_BASE_URL}/result/{ebi_id}/aln-clustal_num")
    if resp.status_code != 200:
        raise ClustalError(_UPSTREAM_DETAIL)
    return resp.text or ""


def parse_clustal(text: str) -> dict:
    """Strictly parse CLUSTAL-format alignment text into the client payload.

    Grammar (fail-closed): the id is the first whitespace-delimited token of a
    non-indented line — indented lines are consensus/annotation rows and are
    skipped. The aligned chunk is the remainder of the line with whitespace
    and residue numbers (the `clustal_num` variant appends them) removed; a
    later block repeating an id appends to that sequence. Every sequence must
    end up the same width, and the width is capped.

    Returns {"alignment", "conservation", "consensus", "identity_matrix"}.
    """
    order: list[str] = []
    parts: dict[str, list[str]] = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or raw[:1].isspace():
            continue
        if _HEADER_RE.match(line):
            continue
        fields = line.split(None, 1)
        if len(fields) != 2:
            continue
        seq_id = fields[0]
        chunk = _DIGITS_RE.sub("", "".join(fields[1].split()))
        if not chunk:
            continue
        if not _SAFE_ID_RE.fullmatch(seq_id):
            raise ClustalError("Clustal Omega returned an invalid alignment.")
        if seq_id not in parts:
            if len(order) >= _MAX_SEQUENCES:
                raise ClustalError("Clustal Omega returned an invalid alignment.")
            order.append(seq_id)
            parts[seq_id] = []
        parts[seq_id].append(chunk)

    if len(order) < 2:
        raise ClustalError("Clustal Omega returned an invalid alignment.")
    alignment = [{"id": seq_id, "sequence": "".join(parts[seq_id])} for seq_id in order]
    widths = {len(entry["sequence"]) for entry in alignment}
    if len(widths) != 1 or 0 in widths:
        raise ClustalError("Clustal Omega returned an invalid alignment.")
    width = widths.pop()
    if width > _MAX_COLUMNS:
        raise ClustalError("Clustal Omega returned an oversize alignment.")
    sequences = [entry["sequence"] for entry in alignment]
    conservation, consensus = _column_stats(sequences)
    return {
        "alignment": alignment,
        "conservation": conservation,
        "consensus": consensus,
        "identity_matrix": _identity_matrix(sequences),
    }


def _column_stats(sequences: list[str]) -> tuple[list[float], str]:
    """Per-column conservation (0..1) and the consensus string.

    Conservation is the fraction of sequences carrying the column's majority
    character (ties on the majority only affect the character, not the count);
    a column that is gaps in every sequence scores 0. The consensus is the
    majority non-gap character, or "-" when gaps tie or beat it.
    """
    n = len(sequences)
    conservation: list[float] = []
    consensus_chars: list[str] = []
    for column in range(len(sequences[0])):
        counts = Counter(seq[column] for seq in sequences)
        gap = counts.get("-", 0)
        non_gap = sorted(((char, cnt) for char, cnt in counts.items() if char != "-"))
        best_char, best_count = "-", 0
        for char, cnt in non_gap:
            if cnt > best_count:
                best_char, best_count = char, cnt
        if gap >= best_count:
            majority_count, consensus_char = gap, "-"
        else:
            majority_count, consensus_char = best_count, best_char
        conservation.append(0.0 if not non_gap else round(majority_count / n, 4))
        consensus_chars.append(consensus_char)
    return conservation, "".join(consensus_chars)


def _identity_matrix(sequences: list[str]) -> list[list[float]]:
    """n×n pairwise percent identity (1 decimal), symmetric, diagonal 100."""
    n = len(sequences)
    matrix: list[list[float]] = []
    for i in range(n):
        row: list[float] = []
        for j in range(n):
            if i == j:
                row.append(100.0)
                continue
            shared = same = 0
            for a, b in zip(sequences[i], sequences[j]):
                if a != "-" and b != "-":
                    shared += 1
                    if a == b:
                        same += 1
            row.append(100.0 if shared == 0 else round(same * 100.0 / shared, 1))
        matrix.append(row)
    return matrix
