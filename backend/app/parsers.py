"""Strict, fail-closed parsers for FASTA text and PDB coordinate files.

Security rules implemented here (see README "Security Audit" section):
- Fixed-width column slicing only — the PDB grammar is positional, not regex-based.
- Every numeric field goes through a bounded int()/float() inside try/except;
  malformed records are skipped, never guessed.
- FASTA uses a character whitelist; anything unexpected raises ParseError.
- Hard size caps are enforced before any parsing work happens.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

_MAX_FASTA_BYTES = 2_000_000
_MAX_SEQ_LEN = 20_000
_MAX_PDB_BYTES = 25_000_000
_MAX_ATOMS = 300_000
_MAX_GB_BYTES = 5_000_000
_MAX_GB_LEN = 100_000
_FASTA_HEADER_RE = re.compile(r"^>[^\r\n]*$")
_SEQ_CHARS = set("ABCDEFGHIKLMNPQRSTVWXYZUO*-_.")
_METAL_ELEMENTS = {"MG", "ZN", "MN", "FE", "CU", "K", "NA", "CA", "NI", "CO"}
_GB_BASES = set("ACGTN")


class ParseError(ValueError):
    """Raised on any input that fails validation. Messages are safe to show."""


@dataclass(frozen=True)
class FastaRecord:
    header: str
    sequence: str


@dataclass(frozen=True)
class ResiduePoint:
    resname: str
    chain: str
    resseq: int
    x: float
    y: float
    z: float
    bfactor: float = 0.0  # carries pLDDT in AlphaFold model files


@dataclass(frozen=True)
class MetalSite:
    element: str
    resname: str
    chain: str
    resseq: int
    x: float
    y: float
    z: float


@dataclass
class ActiveSite:
    site_id: str
    residues: list[tuple[str, str, int]] = field(default_factory=list)  # (resname, chain, resseq)


@dataclass(frozen=True)
class SecondarySpan:
    kind: str  # "helix" | "sheet"
    chain: str
    start: int
    end: int


@dataclass
class ParsedPdb:
    title: str = ""
    chains: list[str] = field(default_factory=list)
    points: list[ResiduePoint] = field(default_factory=list)
    metals: list[MetalSite] = field(default_factory=list)
    sites: list[ActiveSite] = field(default_factory=list)
    helices: list[SecondarySpan] = field(default_factory=list)
    sheets: list[SecondarySpan] = field(default_factory=list)


def parse_fasta(text: str) -> list[FastaRecord]:
    """Parse FASTA text into records. Raises ParseError on anything suspicious."""
    if len(text.encode("utf-8", errors="ignore")) > _MAX_FASTA_BYTES:
        raise ParseError("FASTA input too large (limit 2 MB).")
    records: list[FastaRecord] = []
    header: str | None = None
    parts: list[str] = []
    total = 0

    def flush() -> None:
        nonlocal header
        if header is not None:
            records.append(FastaRecord(header, "".join(parts)))
        parts.clear()

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith(">"):
            if not _FASTA_HEADER_RE.match(line):
                raise ParseError("Malformed FASTA header line.")
            flush()
            header = line[1:].strip()[:200]
            continue
        if header is None:
            raise ParseError("Sequence data found before any '>' header.")
        compact = "".join(line.split()).upper()
        bad = next((c for c in compact if c not in _SEQ_CHARS), None)
        if bad is not None:
            raise ParseError(f"Invalid character in sequence: {bad!r}. Allowed: letters, * - _ .")
        total += len(compact)
        if total > _MAX_SEQ_LEN:
            raise ParseError(f"Sequence too long (limit {_MAX_SEQ_LEN} residues).")
        parts.append(compact)
    flush()
    if not records:
        raise ParseError("No FASTA records found.")
    return records


def parse_fasta_single(text: str) -> FastaRecord:
    records = parse_fasta(text)
    if len(records) != 1:
        raise ParseError(f"Expected exactly one FASTA record, got {len(records)}.")
    return records[0]


def parse_pdb_text(text: str) -> ParsedPdb:
    """Extract Cα atoms, HETATM metals, SITE records and title from PDB text."""
    if len(text.encode("utf-8", errors="ignore")) > _MAX_PDB_BYTES:
        raise ParseError("PDB file too large (limit 25 MB).")
    result = ParsedPdb()
    ca: dict[tuple[str, int], ResiduePoint] = {}
    for line in text.splitlines():
        if not line:
            continue
        record = line[:6].strip()
        # TITLE, HELIX, SHEET and SITE records are typically shorter than 54
        # columns — handle them before the fixed-width gate below.
        if record == "TITLE" and not result.title:
            result.title = " ".join(line[10:].split())[:200]
            continue
        if record == "HELIX" and len(line) >= 40:
            try:
                chain = line[19:20].strip() or "A"
                start = int(line[21:25])
                end = int(line[33:37])
            except ValueError:
                continue
            result.helices.append(SecondarySpan("helix", chain, start, end))
            continue
        if record == "SHEET" and len(line) >= 40:
            try:
                chain = line[21:22].strip() or "A"
                start = int(line[22:26])
                end = int(line[33:37])
            except ValueError:
                continue
            result.sheets.append(SecondarySpan("sheet", chain, start, end))
            continue
        if record == "SITE":
            site = _parse_site_line(line)
            if site is not None:
                result.sites.append(site)
            continue
        if record not in {"ATOM", "HETATM"} or len(line) < 54:
            continue
        element = line[76:78].strip().upper() or _element_guess(line[12:16].strip())
        try:
            x = float(line[30:38])
            y = float(line[38:46])
            z = float(line[46:54])
            bfac = float(line[60:66])
            resseq = int(line[22:26])
        except ValueError:
            continue  # malformed numeric field — skip the record, never guess
        if not all(math.isfinite(v) for v in (x, y, z, bfac)):
            continue
        chain = line[21:22].strip() or "A"
        resname = line[17:20].strip()
        if record == "ATOM" and line[12:16].strip() == "CA":
            key = (chain, resseq)
            if key not in ca:
                ca[key] = ResiduePoint(resname, chain, resseq, x, y, z, bfac)
                if len(ca) > _MAX_ATOMS:
                    raise ParseError("Too many atoms (limit exceeded).")
        elif record == "HETATM" and element in _METAL_ELEMENTS:
            result.metals.append(MetalSite(element, resname, chain, resseq, x, y, z))
    result.points = [ca[k] for k in sorted(ca)]
    result.chains = sorted({p.chain for p in result.points})
    return result


def _element_guess(atom_name: str) -> str:
    """HETATM element column is unreliable in some legacy files; guess from atom name."""
    name = atom_name.upper()
    two = name[:2]
    if two in _METAL_ELEMENTS:
        return two
    one = name[:1]
    return one if one in _METAL_ELEMENTS else ""


def _parse_site_line(line: str) -> ActiveSite | None:
    """Parse a SITE record: up to 4 residues per line, 12-column group stride."""
    site_id = line[11:15].strip()
    if not site_id:
        return None
    residues: list[tuple[str, str, int]] = []
    for off in (0, 12, 24, 36):
        resname = line[18 + off : 21 + off].strip()
        chain = line[22 + off : 23 + off].strip() or "A"
        seq_s = line[23 + off : 27 + off].strip()
        if not resname or not seq_s:
            continue
        try:
            seq = int(seq_s)
        except ValueError:
            continue
        residues.append((resname, chain, seq))
    if not residues:
        return None
    return ActiveSite(site_id, residues)


# ── GenBank flat file ──────────────────────────────────────────────────────

_LOCUS_RE = re.compile(r"^LOCUS\s+\S+\s+(\d+)\s+bp\s+\S+\s+(circular|linear)", re.I)
_SPAN_RE = re.compile(r"(\d+)\.\.(\d+)")
_QUAL_RE = re.compile(r'^/(\w+)=?"?([^"]*)')


def parse_genbank_text(text: str) -> dict:
    """Parse a GenBank flat file (NCBI efetch `gbwithparts`) strictly.

    Security rules implemented here (see SECURITY_AUDIT.md):
    - Size cap before parsing; declared length cap.
    - The ORIGIN block is extracted character-by-character over a base
      whitelist; the count must equal the declared length — a truncated or
      hostile record raises ParseError, it is never guessed at.
    - FEATURES locations come from `(\d+)..(\d+)` spans only; qualifier
      values are truncated text, rendered as text nodes by the client.
    """
    if len(text.encode("utf-8", errors="ignore")) > _MAX_GB_BYTES:
        raise ParseError("GenBank record too large (limit 5 MB).")
    lines = text.splitlines()
    length: int | None = None
    topology = "linear"
    name = ""
    for line in lines:
        m = _LOCUS_RE.match(line)
        if m:
            length = int(m.group(1))
            topology = m.group(2).lower()
            name = line[12:28].strip()
            break
    if length is None:
        raise ParseError("Not a GenBank record (no LOCUS line).")
    if length > _MAX_GB_LEN:
        raise ParseError(f"GenBank sequence too long (limit {_MAX_GB_LEN} bp).")

    # ── FEATURES block ──────────────────────────────────────────────────────
    fi = next((i for i, l in enumerate(lines) if l.startswith("FEATURES")), None)
    oi = next((i for i, l in enumerate(lines) if l.startswith("ORIGIN")), fi)
    if fi is None or oi is None or oi <= fi:
        raise ParseError("Malformed GenBank record (missing FEATURES/ORIGIN).")
    features: list[dict] = []
    current: dict | None = None
    for line in lines[fi + 1 : oi]:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("/"):
            # Qualifier line — /gene, /product, /note, /label …
            if current is not None:
                qm = _QUAL_RE.match(stripped)
                if qm:
                    key, value = qm.group(1), qm.group(2).strip()
                    if key == "gene" and value:
                        current["label"] = value[:60]
                    elif key == "product" and value and not current.get("product"):
                        current["product"] = value[:120]
                    elif key in ("note", "label") and value and not current.get("label"):
                        current["label"] = value[:60]
        else:
            # Key line — "gene  complement(86..1271)" etc.
            parts = stripped.split(None, 1)
            if len(parts) != 2:
                continue
            current = {"type": parts[0], "label": "", "product": "", "strand": 1}
            spans = _SPAN_RE.findall(parts[1])
            if spans:
                current["start"] = min(int(a) for a, b in spans)
                current["end"] = max(int(b) for a, b in spans)
                current["strand"] = -1 if "complement" in parts[1] else 1
            features.append(current)
    features = [f for f in features if "start" in f]
    for f in features:
        if not f["label"]:
            f["label"] = f["product"] or f["type"]

    # ── ORIGIN sequence ─────────────────────────────────────────────────────
    chars: list[str] = []
    for line in lines[oi + 1 :]:
        if line.startswith("//"):
            break
        for c in line:
            if c.isalpha():
                chars.append(c.upper())
    sequence = "".join(chars)
    if len(sequence) != length:
        raise ParseError(
            f"GenBank sequence length mismatch (declared {length}, found {len(sequence)})."
        )
    bad = next((c for c in sequence if c not in _GB_BASES), None)
    if bad is not None:
        raise ParseError("GenBank sequence contains invalid characters.")

    return {
        "name": name,
        "length": length,
        "topology": topology,
        "sequence": sequence,
        "features": [
            {
                "type": f["type"],
                "label": f["label"],
                "product": f["product"],
                "start": f["start"],
                "end": f["end"],
                "strand": f["strand"],
            }
            for f in features
        ],
    }
