"""Comparative genomics dashboard endpoint.

Aggregates, for one gene (e.g. LIG1 or PNKP from the blue-whale BER pathway):
- the reviewed human UniProtKB entry,
- the best available whale ortholog from Ensembl (blue whale first),
- InterPro domain architecture of the human protein.

Pipeline rule: after the human entry resolves, the slow Ensembl call and the
InterPro call run CONCURRENTLY under per-part deadlines, and each degrades
independently (`ortholog: {available: false, detail}` / `domains: []`) — the
dashboard can never hang on one upstream source.
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import BaseModel, Field

from ..config import get_settings
from ..services import clustal, ensembl, interpro, uniprot

router = APIRouter(tags=["comparative"])


@router.get("/comparative/gene/{symbol}")
async def gene_dashboard(symbol: str = Path(pattern=r"^[A-Za-z0-9]{1,20}$")) -> dict:
    gene = symbol.upper()
    try:
        human = await uniprot.fetch_by_symbol(gene)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail="UniProtKB upstream error.")

    s = get_settings()

    async def guard_ortholog() -> dict:
        try:
            return await asyncio.wait_for(
                ensembl.find_ortholog(
                    gene, s.ortholog_species_list, ensembl_gene=human.get("ensembl_gene")
                ),
                timeout=s.ensembl_timeout_s + 15,
            )
        except Exception:
            # Degrade, never hang: the dashboard still shows the human entry
            # and domains; the ortholog card carries its own detail.
            return {"available": False, "detail": "Ensembl homology unavailable (timeout or upstream error)."}

    async def guard_domains() -> list[dict]:
        try:
            return await asyncio.wait_for(
                interpro.fetch_domains(human["accession"]), timeout=s.request_timeout_s
            )
        except Exception:
            return []

    ortholog, domains = await asyncio.gather(guard_ortholog(), guard_domains())
    return {"gene": gene, "human": human, "ortholog": ortholog, "domains": domains}


# ── Multi-sequence alignment (Clustal Omega) ───────────────────────────────
# Everything the client sends is constrained by pattern/length BEFORE it is
# used to build the FASTA payload, and the job id path param is constrained
# before it reaches the service's URL construction.
_MSA_ID_RE = r"^[A-Za-z0-9_.-]{1,40}$"
_MSA_SEQ_RE = r"^[A-Z*\-_.]{1,2000}$"
_MSA_JOB_RE = r"^[A-Za-z0-9_-]{1,80}$"
_MSA_UPSTREAM_DETAIL = "Clustal Omega unavailable (upstream error)."


class MsaSequence(BaseModel):
    id: str = Field(pattern=_MSA_ID_RE)
    sequence: str = Field(pattern=_MSA_SEQ_RE)


class MsaRequest(BaseModel):
    sequences: list[MsaSequence] = Field(min_length=2, max_length=50)


@router.post("/comparative/msa")
async def msa_submit(req: MsaRequest) -> dict:
    """Queue a Clustal Omega MSA job; the client polls the returned job id."""
    try:
        job_id = await clustal.submit([s.model_dump() for s in req.sequences])
    except clustal.ClustalError:
        raise HTTPException(status_code=502, detail=_MSA_UPSTREAM_DETAIL)
    return {"job_id": job_id, "status": "running"}


@router.get("/comparative/msa/{job_id}")
async def msa_status(job_id: str = Path(pattern=_MSA_JOB_RE)) -> dict:
    try:
        return await clustal.poll(job_id)
    except clustal.ClustalError:
        raise HTTPException(status_code=404, detail="Unknown MSA job.")


_UNIPROT_RE = r"^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2})$"

_SEARCH_SEQ_CAP = 2000


@router.get("/comparative/search")
async def search(q: str = Query(min_length=2, max_length=20), limit: int = Query(default=10, ge=1, le=20)) -> dict:
    """Sequence search for the redesigned comparative workbench.

    `q` is either a UniProt accession (exact) or a gene symbol (first
    reviewed entry).  Sequences are truncated server-side at
    _SEARCH_SEQ_CAP residues with an honest `truncated` flag.
    """
    import re

    clean = q.strip()
    try:
        if re.fullmatch(_UNIPROT_RE, clean.upper()):
            entries = [await uniprot.fetch_entry(clean.upper())]
        else:
            entries = [await uniprot.fetch_by_symbol(clean.upper())]
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)[:200])
    except Exception:
        raise HTTPException(status_code=502, detail="UniProtKB upstream error.")

    out = []
    for entry in entries[:limit]:
        seq = entry.get("sequence") or ""
        out.append({
            "accession": entry.get("accession"),
            "gene": entry.get("gene"),
            "name": entry.get("name"),
            "organism": entry.get("organism"),
            "length": entry.get("length"),
            "sequence": seq[:_SEARCH_SEQ_CAP],
            "truncated": len(seq) > _SEARCH_SEQ_CAP,
        })
    return {"entries": out}
