"""DNA workspace endpoints: GenBank registry (via NCBI Entrez), digests and
file ingestion.

The registry returns the full record — sequence, feature annotations and
every computed restriction site — so the linear/circular maps and the
in silico lab all share one strictly-parsed payload.
"""
from __future__ import annotations

import re

from fastapi import APIRouter, File, Form, HTTPException, Path, UploadFile

from ..enzymes import ENZYMES, ENZYME_ORDER, all_sites, digest_fragments
from ..parsers import ParseError, parse_fasta_single, parse_genbank_text
from ..services import entrez

router = APIRouter(tags=["dna"])

# Note: no route-level result cache here on purpose — site computation
# evolves (circular-junction fixes, new enzymes) and a stale cached payload
# would silently lie. The upstream GenBank text is cached 24 h in the
# Entrez service; parsing + scanning a few-kb record is microseconds.

# GenBank accession grammar (e.g. J01749, NC_002013, M77789.2) — validated
# before the value is interpolated into any upstream URL.
_ACCESSION_RE = r"^[A-Z]{1,4}_?\d{1,6}(\.\d+)?$"


@router.get("/dna/enzymes")
async def enzyme_catalog() -> dict:
    """Recognition-site dictionary (public data — powers map legends)."""
    return {
        "enzymes": [
            {"name": name, "motif": ENZYMES[name]["motif"], "cut": ENZYMES[name]["cut"]}
            for name in ENZYME_ORDER
        ]
    }


@router.get("/dna/registry/{accession}")
async def dna_registry(accession: str = Path(pattern=_ACCESSION_RE)) -> dict:
    try:
        text = await entrez.fetch_genbank(accession.upper())
        record = parse_genbank_text(text)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail="NCBI Entrez upstream error.")
    return {
        "accession": accession.upper(),
        "name": record["name"],
        "length": record["length"],
        "topology": record["topology"],
        "sequence": record["sequence"],
        "features": record["features"],
        "sites": all_sites(record["sequence"], record["topology"], ENZYME_ORDER),
    }


@router.get("/dna/digest/{accession}")
async def dna_digest(accession: str = Path(pattern=_ACCESSION_RE), enzymes: str = "EcoRI") -> dict:
    """Fragment sizes for a digest — enzymes is a comma-separated list."""
    wanted = [e.strip() for e in enzymes.split(",") if e.strip()]
    unknown = [e for e in wanted if e not in ENZYMES]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown enzyme(s): {', '.join(unknown[:5])}")
    registry = await dna_registry(accession.upper())
    cuts = sorted({site["cut"] for site in registry["sites"] if site["enzyme"] in wanted})
    return {
        "accession": registry["accession"],
        "length": registry["length"],
        "topology": registry["topology"],
        "enzymes": wanted,
        "cuts": cuts,
        "fragments": digest_fragments(registry["length"], cuts, registry["topology"]),
    }


# IUPAC DNA alphabet accepted for uploaded FASTA — ambiguous codes render
# gray in the map (the map's BASE_COLORS handles anything outside ACGT).
_IUPAC_DNA = set("ACGTNRYKMSWBDHV")
_NAME_RE = re.compile(r"^[A-Za-z0-9_.-]{1,60}$")
_INGEST_CAP = 5_000_000  # bytes — matches the global body cap


@router.post("/dna/ingest")
async def dna_ingest(
    file: UploadFile = File(..., description="GenBank (.gb/.gbk) or FASTA (.fa/.fasta) file"),
    name: str | None = Form(default=None, description="Optional display accession"),
) -> dict:
    """Parse an uploaded GenBank or FASTA file into the registry shape.

    CSRF-protected (POST). The file goes through the same strict parsers as
    upstream records — GenBank features and sites, or a bare linear FASTA
    sequence — and the same payload shape drives the maps dynamically.
    """
    raw = await file.read(_INGEST_CAP + 1)
    if len(raw) > _INGEST_CAP:
        raise HTTPException(status_code=413, detail="File too large (limit 5 MB).")
    text = raw.decode("utf-8", errors="ignore")
    label = (name or (file.filename or "ingest").rsplit(".", 1)[0]).strip()
    if not _NAME_RE.match(label):
        raise HTTPException(status_code=422, detail="Invalid record name.")

    try:
        if "LOCUS" in text[:5000] and "ORIGIN" in text[:20000]:
            record = parse_genbank_text(text)
            return {
                "accession": label.upper(),
                "name": record["name"] or label,
                "length": record["length"],
                "topology": record["topology"],
                "sequence": record["sequence"],
                "features": record["features"],
                "sites": all_sites(record["sequence"], record["topology"], ENZYME_ORDER),
            }
        if text.lstrip().startswith(">"):
            fasta = parse_fasta_single(text)
            seq = fasta.sequence
            bad = next((c for c in seq if c not in _IUPAC_DNA), None)
            if bad is not None:
                raise ParseError(
                    f"Not a DNA sequence (character {bad!r}). GenBank/FASTA DNA records only."
                )
            return {
                "accession": label.upper(),
                "name": fasta.header[:120],
                "length": len(seq),
                "topology": "linear",
                "sequence": seq,
                "features": [],
                "sites": all_sites(seq, "linear", ENZYME_ORDER),
            }
    except ParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    raise HTTPException(
        status_code=422, detail="Unrecognized file — expected a GenBank (.gb) or FASTA (.fa) record."
    )
