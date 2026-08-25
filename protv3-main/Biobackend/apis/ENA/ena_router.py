"""ENA (European Nucleotide Archive) REST API proxy."""
from fastapi import APIRouter, HTTPException, Query
from core.http_client import api_get
from core.errors import make_discover_response

router = APIRouter(prefix="/ena", tags=["ENA"])
PORTAL_BASE = "https://www.ebi.ac.uk/ena/portal/api"
BROWSER_BASE = "https://www.ebi.ac.uk/ena/browser/api"

ENDPOINTS = [
    {"path": "/search", "method": "GET", "description": "Search ENA for studies, samples, and sequencing runs", "query_hint": "q: accession, organism, or keyword | limit: 1-100"},
    {"path": "/fetch/{accession}", "method": "GET", "description": "Fetch nucleotide sequence by accession", "query_hint": "accession: ENA accession (e.g. PRJEB12345, ERR000001)"},
    {"path": "/filereport", "method": "GET", "description": "Get file report for sequencing data downloads", "query_hint": "accession: study or run accession"},
    {"path": "/taxonomy/{tax_id}", "method": "GET", "description": "Get ENA records by NCBI taxonomy ID", "query_hint": "tax_id: NCBI taxonomy ID (e.g. 9606 for human)"},
]

@router.get("/discover")
async def discover():
    return make_discover_response(
        "ena",
        ENDPOINTS,
        description="European Nucleotide Archive — raw sequencing reads, assemblies, and annotations from all platforms",
        query_hint="Enter study accession (e.g. PRJEB12345), sample ID, or taxon name to search",
    )

@router.get("/search")
async def search(
    result: str = Query("study", description="Result type: study, sample, run, analysis"),
    query: str = Query(..., description="Search query (e.g. 'tax_eq(9606)')"),
    limit: int = Query(10, ge=1, le=1000),
    format: str = Query("json"),
):
    try:
        r = await api_get(f"{PORTAL_BASE}/search", params={
            "result": result, "query": query, "limit": limit, "format": format,
        })
        return {"status": "success", "api": "ENA", "data": r.json() if format == "json" else r.text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/fetch/{accession}")
async def fetch(accession: str, format: str = Query("json")):
    try:
        r = await api_get(f"{BROWSER_BASE}/{format}/{accession}")
        return {"status": "success", "api": "ENA", "data": r.json() if format == "json" else r.text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/filereport")
async def filereport(
    accession: str = Query(...),
    result: str = Query("read_run"),
    fields: str = Query("study_accession,run_accession,fastq_ftp"),
    format: str = Query("tsv"),
):
    try:
        r = await api_get(f"{PORTAL_BASE}/filereport", params={
            "accession": accession, "result": result, "fields": fields, "format": format,
        })
        return {"status": "success", "api": "ENA", "data": r.text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/taxonomy/{tax_id}")
async def taxonomy(tax_id: str):
    try:
        r = await api_get(f"https://www.ebi.ac.uk/ena/taxonomy/rest/tax-id/{tax_id}")
        return {"status": "success", "api": "ENA", "data": r.text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
