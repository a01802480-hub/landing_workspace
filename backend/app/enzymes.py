"""Restriction enzyme recognition sites + digest fragment math.

Type-II palindromic enzymes only (exact fragment computation for the in
silico digest / gel simulation). Recognition motifs are the canonical
5′→3′ sequences; `cut` is the top-strand cleavage offset within the motif
(used for marker placement on the maps).
"""
from __future__ import annotations

ENZYMES: dict[str, dict] = {
    "EcoRI": {"motif": "GAATTC", "cut": 1},
    "HindIII": {"motif": "AAGCTT", "cut": 1},
    "BamHI": {"motif": "GGATCC", "cut": 1},
    "SalI": {"motif": "GTCGAC", "cut": 1},
    "XbaI": {"motif": "TCTAGA", "cut": 1},
    "NcoI": {"motif": "CCATGG", "cut": 1},
    "NdeI": {"motif": "CATATG", "cut": 2},
    "PvuII": {"motif": "CAGCTG", "cut": 3},
    "ScaI": {"motif": "AGTACT", "cut": 3},
    "PstI": {"motif": "CTGCAG", "cut": 5},
    "SphI": {"motif": "GCATGC", "cut": 5},
    "KpnI": {"motif": "GGTACC", "cut": 5},
}

# Fixed categorical order for map markers (validated palette, see frontend).
ENZYME_ORDER = ["EcoRI", "HindIII", "BamHI", "SalI", "XbaI", "NcoI", "NdeI", "PvuII", "ScaI", "PstI", "SphI", "KpnI"]


def find_sites(sequence: str, enzyme: str) -> list[int]:
    """0-based start positions of every recognition motif in `sequence`."""
    motif = ENZYMES[enzyme]["motif"]
    seq = sequence.upper()
    return [i for i in range(len(seq) - len(motif) + 1) if seq.startswith(motif, i)]


def all_sites(sequence: str, topology: str, enzyme_names: list[str]) -> list[dict]:
    """Every recognition site, circular-junction aware.

    A motif like pBR322's EcoRI GAATTC that straddles the circular
    junction (positions 4360→1) is invisible to a plain linear scan —
    the scan string therefore wraps by (longest motif − 1) bases for
    circular topology, and positions are mapped modulo the length.
    """
    longest = max(len(ENZYMES[name]["motif"]) for name in enzyme_names)
    scan = sequence.upper() + (sequence[: longest - 1].upper() if topology == "circular" else "")
    length = len(sequence)
    out: list[dict] = []
    for name in enzyme_names:
        seen: set[int] = set()
        for pos in find_sites(scan, name):
            start = pos % length
            if start in seen:
                continue
            seen.add(start)
            out.append(
                {
                    "enzyme": name,
                    "start": start,
                    "cut": (start + ENZYMES[name]["cut"]) % length,
                    "motif": ENZYMES[name]["motif"],
                }
            )
    return out


def digest_fragments(length: int, cut_positions: list[int], topology: str) -> list[int]:
    """Fragment sizes (bp) for a set of 0-based cut positions.

    Circular topology: fragments span consecutive cuts around the circle.
    Linear: from the start to the first cut, between cuts, and to the end.
    """
    cuts = sorted({p % length for p in cut_positions if 0 <= p < length})
    if not cuts:
        return [length]
    if topology == "circular":
        frags: list[int] = []
        prev = cuts[-1]
        for c in cuts:
            frags.append((c - prev) % length)
            prev = c
        frags = [f for f in frags if f > 0] or [length]
        return frags
    frags = [cuts[0]]
    frags += [cuts[i] - cuts[i - 1] for i in range(1, len(cuts))]
    frags.append(length - cuts[-1])
    return [f for f in frags if f > 0]
