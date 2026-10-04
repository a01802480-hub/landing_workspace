"""AlphaFold DB client — model metadata, PDB download and PAE matrix.

The AlphaFold DB is keyless and public. Three pieces of data come back
from it, all rebuilt server-side before they reach the client:

- **Model PDB** — per-residue pLDDT travels in the B-factor column of the
  AlphaFold model file; the strict PDB parser picks it up as `bfactor`.
- **Model metadata** — entry ID, release date, latest version, organism,
  taxon, sequence window (from the `prediction` API, field-whitelisted).
- **PAE matrix** (`predicted_aligned_error`) — downloaded from the
  `paeDocUrl` the prediction API points at, then strictly validated and
  mean-pooled down to a display-size matrix.

Security rules implemented here (see SECURITY_AUDIT.md):
- Upstream JSON is never proxied through unvalidated — every field is
  shape-checked before it is returned.
- A byte cap is applied *before* JSON parsing so a hostile or bloated
  matrix file cannot exhaust memory.
- Only the whitelisted metadata fields are copied into responses.
"""
from __future__ import annotations

import json
import math
import re

import httpx

from ..cache import TTLCache
from ..config import get_settings
from ..parsers import ParseError, parse_pdb_text

_model_cache = TTLCache(ttl_s=86400, max_entries=100)
_pae_cache = TTLCache(ttl_s=86400, max_entries=100)
# Prediction metadata is small and is needed by both the model and the PAE
# fetch — caching it avoids a duplicate upstream round-trip per load.
_meta_cache = TTLCache(ttl_s=3600, max_entries=200)

# Hard byte cap applied BEFORE json.loads — a 3000×3000 matrix is ≈ 50–90 MB
# of JSON; anything bigger is refused outright (see PAE_MAX_RESIDUES note).
_MAX_PAE_BYTES = 100_000_000
# PAE values are Ångström-scale errors; refuse non-finite / absurd values.
_MAX_PAE_VALUE = 100.0
_ENTRY_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,40}$")


class PaeError(ValueError):
    """PAE matrix unavailable or invalid. Messages are safe to show."""


async def _metadata(uniprot_id: str) -> dict:
    """Fetch the AlphaFold DB prediction entry for a UniProt accession."""
    cached = _meta_cache.get(uniprot_id)
    if cached is not None:
        return cached
    s = get_settings()
    async with httpx.AsyncClient(timeout=s.alphafold_timeout_s) as client:
        resp = await client.get(f"{s.alphafold_base_url}/prediction/{uniprot_id}")
        if resp.status_code >= 400:
            # Never echo the raw httpx error — it embeds the full request URL
            # and internals. One fixed, user-safe message covers 400/404/5xx.
            raise ValueError(f"No AlphaFold model available for {uniprot_id}.")
        meta = resp.json()
    if not isinstance(meta, list) or not meta:
        raise ValueError(f"No AlphaFold model available for {uniprot_id}.")
    _meta_cache.set(uniprot_id, meta[0])
    return meta[0]


def _public_metadata(meta: dict) -> dict:
    """Field-whitelist the upstream metadata; sanitize what is kept.

    Upstream values are rendered as text by the client, but we still coerce
    them: identifiers must match their known shape, free text is truncated.
    """

    def clean_text(v: object, limit: int) -> str | None:
        if not isinstance(v, str):
            return None
        return v.strip()[:limit] or None

    entry_id = meta.get("entryId")
    if not isinstance(entry_id, str) or not _ENTRY_ID_RE.match(entry_id):
        entry_id = None
    return {
        "entry_id": entry_id,
        "model_created_date": clean_text(meta.get("modelCreatedDate"), 40),
        "latest_version": meta.get("latestVersion") if isinstance(meta.get("latestVersion"), int) else None,
        "uniprot_name": clean_text(meta.get("uniprotId"), 60),
        "description": clean_text(meta.get("uniprotDescription"), 300),
        "organism": clean_text(meta.get("organismScientificName"), 120),
        "tax_id": meta.get("taxId") if isinstance(meta.get("taxId"), int) else None,
        "sequence_start": meta.get("uniprotStart") if isinstance(meta.get("uniprotStart"), int) else None,
        "sequence_end": meta.get("uniprotEnd") if isinstance(meta.get("uniprotEnd"), int) else None,
    }


async def fetch_model(uniprot_id: str) -> dict:
    """Download the AlphaFold model for a UniProt accession.

    Returns the Cα trace + per-residue pLDDT (the viewer's input), the full
    per-residue list (the sequence track's input) and whitelisted metadata.
    """
    cached = _model_cache.get(uniprot_id)
    if cached is not None:
        return cached
    s = get_settings()
    meta = await _metadata(uniprot_id)
    pdb_url = meta.get("pdbUrl")
    if not isinstance(pdb_url, str) or not pdb_url:
        raise ValueError("AlphaFold metadata missing the model URL.")
    async with httpx.AsyncClient(timeout=s.alphafold_timeout_s) as client:
        resp = await client.get(pdb_url)
        resp.raise_for_status()
        parsed = parse_pdb_text(resp.text)
    if not parsed.points:
        raise ParseError("AlphaFold model contained no Cα atoms.")
    model = {
        "source": "alphafold",
        "uniprot": uniprot_id,
        "points": [
            {
                "resn": p.resname,
                "resi": p.resseq,
                "chain": p.chain,
                "x": p.x,
                "y": p.y,
                "z": p.z,
                "plddt": p.bfactor,
            }
            for p in parsed.points
        ],
        "mean_plddt": round(sum(p.bfactor for p in parsed.points) / len(parsed.points), 2),
        "model_metadata": _public_metadata(meta),
        "pae_available": isinstance(meta.get("paeDocUrl"), str) and bool(meta["paeDocUrl"]),
        "residues_full": [
            {"resi": p.resseq, "resn": p.resname, "plddt": p.bfactor}
            for p in parsed.points
        ],
    }
    _model_cache.set(uniprot_id, model)
    return model


def _strict_float(v: object) -> float:
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        raise PaeError("PAE matrix contains non-numeric values.")
    f = float(v)
    if not math.isfinite(f) or f < 0.0 or f > _MAX_PAE_VALUE:
        raise PaeError("PAE matrix contains out-of-range values.")
    return f


def _strict_int(v: object) -> int:
    if isinstance(v, bool) or not isinstance(v, int):
        raise PaeError("PAE residue index is not integral.")
    return v


def parse_pae_json(
    payload: object, max_residues: int, residue_start: int | None = None
) -> dict:
    """Strictly validate an AlphaFold PAE JSON document.

    Accepts the v1–v6 shapes:
    - v1–v5: ``{"predicted_aligned_error": [[…]], "residue_index": […],
      "max_predicted_aligned_error": …}`` — older files name the matrix
      ``distance``.
    - v6: a **list** of entity objects (one per chain) with no
      ``residue_index`` — the first entry is used and the index is derived
      from the sequence start (UniProt numbering).

    Anything malformed raises PaeError: upstream data is never trusted by
    shape. No coercion, no guessing.
    """
    if isinstance(payload, list):
        # v6: [{predicted_aligned_error, max_predicted_aligned_error}, …]
        if not payload or not isinstance(payload[0], dict):
            raise PaeError("PAE payload is not a JSON object.")
        payload = payload[0]
    if not isinstance(payload, dict):
        raise PaeError("PAE payload is not a JSON object.")
    matrix = payload.get("predicted_aligned_error", payload.get("distance"))
    if not isinstance(matrix, list) or not matrix:
        raise PaeError("PAE matrix missing.")
    n = len(matrix)
    if n > max_residues:
        raise PaeError(f"PAE matrix too large (limit {max_residues} residues).")
    residue_index = payload.get("residue_index")
    if residue_index is None:
        # v6 files carry no index — UniProt numbering starts at the model's
        # sequence start (1-based, same convention as the residue_index).
        if not isinstance(residue_start, int) or residue_start < 1:
            raise PaeError("PAE residue index missing and no sequence start available.")
        residue_index = list(range(residue_start, residue_start + n))
    if not isinstance(residue_index, list) or len(residue_index) != n:
        raise PaeError("PAE residue index does not match the matrix.")
    index = [_strict_int(v) for v in residue_index]
    rows: list[list[float]] = []
    for row in matrix:
        if not isinstance(row, list) or len(row) != n:
            raise PaeError("PAE matrix is not square.")
        rows.append([_strict_float(v) for v in row])
    max_pae = payload.get("max_predicted_aligned_error")
    if max_pae is None:
        max_pae = max((max(r) for r in rows), default=0.0)
    else:
        max_pae = _strict_float(max_pae)
    total = sum(sum(r) for r in rows)
    return {
        "residue_index": index,
        "pae": rows,
        "max_pae": round(max_pae, 3),
        "mean_pae": round(total / (n * n), 3),
    }


def downsample_pae(
    index: list[int], matrix: list[list[float]], target: int
) -> tuple[list[int], list[list[float]], int]:
    """Mean-pool the matrix to ≤ target×target for display.

    Returns (residue_index, matrix, stride). Mean-pooling preserves the
    local magnitude structure far better than stride-sampling for the
    heatmap; each pooled cell is the average PAE of its source block.
    """
    n = len(index)
    if n <= target:
        return index, matrix, 1
    stride = math.ceil(n / target)
    bins = math.ceil(n / stride)
    out: list[list[float]] = [[0.0] * bins for _ in range(bins)]
    counts: list[list[int]] = [[0] * bins for _ in range(bins)]
    for i, row in enumerate(matrix):
        bi = i // stride
        out_row = out[bi]
        cnt_row = counts[bi]
        for j, v in enumerate(row):
            bj = j // stride
            out_row[bj] += v
            cnt_row[bj] += 1
    for bi in range(bins):
        for bj in range(bins):
            out[bi][bj] = round(out[bi][bj] / counts[bi][bj], 3)
    idx_out = [index[min(b * stride + stride // 2, n - 1)] for b in range(bins)]
    return idx_out, out, stride


async def fetch_confidence(uniprot_id: str) -> dict:
    """Download, validate and mean-pool the PAE matrix for a UniProt accession."""
    cached = _pae_cache.get(uniprot_id)
    if cached is not None:
        return cached
    s = get_settings()
    meta = await _metadata(uniprot_id)
    pae_url = meta.get("paeDocUrl")
    if not isinstance(pae_url, str) or not pae_url:
        raise PaeError(f"No PAE matrix available for {uniprot_id}.")
    async with httpx.AsyncClient(timeout=s.alphafold_timeout_s) as client:
        resp = await client.get(pae_url)
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise PaeError("AlphaFold PAE matrix unavailable upstream.") from exc
        length = resp.headers.get("content-length")
        if length and length.isdigit() and int(length) > _MAX_PAE_BYTES:
            raise PaeError("PAE matrix file exceeds the size limit.")
        try:
            payload = resp.json()
        except ValueError as exc:  # json.JSONDecodeError ⊂ ValueError
            raise PaeError("PAE payload is not valid JSON.") from exc
    parsed = parse_pae_json(
        payload, s.pae_max_residues, residue_start=meta.get("uniprotStart")
    )
    index, matrix, stride = downsample_pae(
        parsed["residue_index"], parsed["pae"], s.pae_display_size
    )
    # Align per-residue pLDDT to the (downsampled) residue index so the
    # client can draw the confidence chart and the heatmap on one scale.
    model = await fetch_model(uniprot_id)
    plddt_by_resi = {r["resi"]: r["plddt"] for r in model["residues_full"]}
    out = {
        "uniprot": uniprot_id,
        "stride": stride,
        "residue_index": index,
        "pae": matrix,
        "max_pae": parsed["max_pae"],
        "mean_pae": parsed["mean_pae"],
        "plddt": [plddt_by_resi.get(r) for r in index],
    }
    _pae_cache.set(uniprot_id, out)
    return out
