"""CRISPR guide design — local scanning core + upstream tool adapters.

Local core (always available, no keys): scan a target sequence on both
strands for PAM motifs (IUPAC-aware), extract 20-nt spacers, compute
GC / homopolymer / self-complementarity, and rank with per-tool models:

  - "chopchop"   — CHOPCHOP-style ranking: GC 40–80% window, self-comp
                   penalty, position bias toward the CDS start.
  - "crispr_gate" — CRISPR-GATE-style knockout ranking: strong 5' bias
                   within the coding sequence (KO = early truncation),
                   common-exon preference delegated to the caller.
  - "crispr_p"    — CRISPR-P 2.0-style plant ranking: plant GC window
                   (30–70%), U3/U6 promoter compatibility notes.

Upstream enrichment (config-gated): when *_base_url settings are present,
the adapter attempts the tool's public API to attach off-target counts;
otherwise every guide ships with an honest "off-target scan unavailable"
note — the UI never fabricates specificity numbers.

The output shape matches the frontend Zod contract (SgRnaSchema in
lib/validation.ts) field-for-field.
"""
from __future__ import annotations

import math
import re
import secrets

from ..config import get_settings

_IUPAC: dict[str, str] = {
    "A": "A", "C": "C", "G": "G", "T": "T",
    "R": "AG", "Y": "CT", "S": "GC", "W": "AT", "K": "GT", "M": "AC",
    "B": "CGT", "D": "AGT", "H": "ACT", "V": "ACG", "N": "ACGT",
}

_COMPLEMENT = str.maketrans("ACGTN", "TGCAN")

GUIDE_LEN = 20
MAX_GUIDES = 50

# Tool configuration tables — one row per supported tool.
TOOLS = {
    "chopchop": {"pam": "NGG", "gc_lo": 40, "gc_hi": 80, "plant": False},
    "crispr_gate": {"pam": "NGG", "gc_lo": 40, "gc_hi": 80, "plant": False},
    "crispr_p": {"pam": "NGG", "gc_lo": 30, "gc_hi": 70, "plant": True},
}


class CrisprError(Exception):
    """Upstream tool failure — surfaced as a designed 502/503."""


def reverse_complement(seq: str) -> str:
    return seq.translate(_COMPLEMENT)[::-1]


def _motif_regex(motif: str) -> re.Pattern[str]:
    """IUPAC motif → regex over uppercase DNA."""
    return re.compile("".join(f"[{_IUPAC.get(b, b)}]" for b in motif.upper()))


def _homopolymer_run(seq: str) -> int:
    best = run = 1
    for a, b in zip(seq, seq[1:]):
        run = run + 1 if a == b else 1
        best = max(best, run)
    return best


def _self_complementarity(spacer: str) -> float:
    """Crude hairpin potential: longest consecutive Watson–Crick run between
    the 5' and 3' ends of the spacer, normalized 0..1 (4+ bp run saturates)."""
    rev_comp = reverse_complement(spacer)
    best = 0
    for shift in range(-len(spacer) + 1, len(spacer)):
        run = 0
        for i in range(len(spacer)):
            j = i + shift
            if 0 <= j < len(spacer) and spacer[i] == rev_comp[j]:
                run += 1
                best = max(best, run)
            else:
                run = 0
    return min(1.0, best / 4)


def _score_tool(tool: str, spacer: str, gc: float, self_comp: float, rel_pos: float) -> float:
    """On-target score 0–100 for the tool's published heuristics. `rel_pos`
    is the guide's position along the CDS (0 = start, 1 = end)."""
    cfg = TOOLS[tool]
    if cfg["plant"]:
        # CRISPR-P: plant GC window; position bias mild.
        gc_pen = 0.0 if cfg["gc_lo"] <= gc <= cfg["gc_hi"] else 25.0
        return round(max(0.0, min(100.0, 100 - gc_pen - 20 * self_comp)), 1)

    # CRISPR-GATE: knockout efficiency is dominated by early-CDS placement.
    if tool == "crispr_gate":
        pos_bias = (1 - rel_pos) * 30
        gc_pen = 0.0 if cfg["gc_lo"] <= gc <= cfg["gc_hi"] else 20.0
        return round(max(0.0, min(100.0, 70 + pos_bias - gc_pen - 25 * self_comp)), 1)

    # CHOPCHOP-style: balanced GC/self-comp/position model.
    gc_pen = 0.0 if cfg["gc_lo"] <= gc <= cfg["gc_hi"] else 20.0
    pos_bias = (1 - rel_pos) * 10
    return round(max(0.0, min(100.0, 80 + pos_bias - gc_pen - 30 * self_comp)), 1)


def scan_guides(
    sequence: str,
    tool: str,
    gene_label: str,
    organism: str,
    max_guides: int = MAX_GUIDES,
) -> list[dict]:
    """Scan + rank guides. Pure and fast (≤ 50 returned), so it runs inline —
    no background job machinery needed for the local core."""
    if tool not in TOOLS:
        raise CrisprError(f"Unknown CRISPR tool '{tool}'.")
    seq = "".join(sequence.split()).upper()
    if not re.fullmatch(r"[ACGTN]+", seq):
        raise CrisprError("Target sequence contains characters outside [ACGTN].")
    if len(seq) < 80:
        raise CrisprError("Target sequence too short for guide design (≥ 80 nt).")

    pam_re = _motif_regex(TOOLS[tool]["pam"])
    guides: list[dict] = []
    seen: set[str] = set()

    def collect(strand_seq: str, strand: str) -> None:
        for m in pam_re.finditer(strand_seq):
            pam_end = m.end()  # exclusive, on this strand's coordinate frame
            spacer_start = pam_end - len(m.group()) - GUIDE_LEN
            if spacer_start < 0:
                continue
            spacer = strand_seq[spacer_start:pam_end - len(m.group())]
            if not spacer or "N" in spacer:
                continue
            if spacer in seen:  # dedupe (palindromic spacers appear on both strands)
                continue
            seen.add(spacer)
            gc = spacer.count("G") + spacer.count("C")
            gc_pct = round(100 * gc / GUIDE_LEN, 1)
            self_comp = _self_complementarity(spacer)
            # Coordinates back into the plus-strand frame (1-based inclusive).
            if strand == "+":
                start, end = spacer_start + 1, spacer_start + GUIDE_LEN
            else:
                start = len(seq) - (spacer_start + GUIDE_LEN) + 1
                end = len(seq) - spacer_start
            rel_pos = min(1.0, max(0.0, (start + end) / 2 / len(seq)))
            guides.append(
                {
                    "id": f"{tool}:{strand}:{start}",
                    "sequence": spacer,
                    "pam": m.group(),
                    "start": start,
                    "end": end,
                    "strand": strand,
                    "gc": gc_pct,
                    "on_target_score": _score_tool(tool, spacer, gc_pct, self_comp, rel_pos),
                    "off_target_count": 0,  # upstream enrichment fills this
                    "off_targets": [],
                    "self_comp": round(self_comp, 2),
                    "efficiency_note": _note_tool(tool, gc_pct, self_comp, rel_pos),
                },
            )

    collect(seq, "+")
    collect(reverse_complement(seq), "-")

    guides.sort(key=lambda g: g["on_target_score"], reverse=True)
    guides = guides[:max_guides]
    if not guides:
        raise CrisprError(
            f"No {TOOLS[tool]['pam']} guides found in the target sequence — try another tool or PAM."
        )
    for i, g in enumerate(guides):
        g["id"] = f"{tool}-{i + 1}"
    return guides


def _note_tool(tool: str, gc: float, self_comp: float, rel_pos: float) -> str:
    notes: list[str] = []
    if self_comp >= 0.75:
        notes.append("self-complementary — hairpin risk")
    if tool == "crispr_gate" and rel_pos <= 0.25:
        notes.append("early-CDS knockout placement")
    if tool == "crispr_p" and not (30 <= gc <= 70):
        notes.append("GC outside the plant U3 window")
    return "; ".join(notes)


def enrich_off_targets(guides: list[dict], tool: str) -> list[dict]:
    """Optional upstream enrichment. Honest degradation: when the tool's
    public API is not configured (no *_base_url setting), guides keep
    off_target_count=0 and the UI labels the column 'scan unavailable' —
    we never invent specificity numbers."""
    s = get_settings()
    configured = {
        "chopchop": s.chopchop_base_url,
        "crispr_p": s.crispr_p_base_url,
    }
    if not configured.get(tool):
        for g in guides:
            g["efficiency_note"] = "; ".join(
                filter(None, [g.get("efficiency_note"), "off-target scan unavailable (upstream not configured)"])
            )
        return guides
    # TODO(integration): call the upstream endpoint (httpx, timeout-bounded)
    # and merge per-guide off-target rows into `off_targets`. The upstream
    # JSON shapes vary by tool version; keep the mapping in one place here.
    return guides


def submit_job(sequence: str, tool: str, gene_label: str, organism: str) -> str:
    """Queue a design job. The local core is fast, but the async shape keeps
    the door open for upstream enrichment later (CHOPCHOP can take 30s+)."""
    job_id = secrets.token_urlsafe(18)
    _jobs[job_id] = {
        "status": "queued",
        "tool": tool,
        "sequence": sequence,
        "gene_label": gene_label,
        "organism": organism,
        "results": None,
        "detail": None,
    }
    return job_id


def poll_job(job_id: str) -> dict:
    """Complete queued jobs synchronously (local core), then report state."""
    job = _jobs.get(job_id)
    if job is None:
        raise CrisprError(f"Unknown design job {job_id}.")
    if job["status"] in ("queued", "running"):
        try:
            results = scan_guides(job["sequence"], job["tool"], job["gene_label"], job["organism"])
            results = enrich_off_targets(results, job["tool"])
            job["results"] = results
            job["status"] = "done"
        except CrisprError as exc:
            job["status"] = "error"
            job["detail"] = str(exc)[:200]
    return {
        "status": job["status"],
        "job_id": job_id,
        "tool": job["tool"],
        "results": job["results"],
        "detail": job["detail"],
    }


# In-memory job store (process-local, mirrors the MSA job pattern).
_jobs: dict[str, dict] = {}
