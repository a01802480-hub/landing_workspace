"""ClinVar proxy via NCBI E-utilities — clinical variant interpretation."""
from fastapi import APIRouter, HTTPException, Query
from core.http_client import api_get
from core.errors import make_discover_response

router = APIRouter(prefix="/clinvar", tags=["ClinVar"])
BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

ENDPOINTS = [
    {"path": "/search", "method": "GET", "description": "Search ClinVar by gene, variant, or condition", "query_hint": "term: gene symbol (e.g. BRCA2), rsID (e.g. rs334), or condition | limit: 1-100"},
    {"path": "/fetch/{uid}", "method": "GET", "description": "Fetch full ClinVar record by UID", "query_hint": "uid: ClinVar variation ID | rettype: variation (default)"},
    {"path": "/summary/{uid}", "method": "GET", "description": "Get summary of a ClinVar variant record", "query_hint": "uid: ClinVar variation ID"},
]

@router.get("/discover")
async def discover():
    return make_discover_response(
        "clinvar",
        ENDPOINTS,
        description="Clinical variant interpretation — germline and somatic classifications with clinical significance",
        query_hint="Enter gene symbol (e.g. CFTR), rsID variant, or condition name to find clinical variants",
    )

@router.get("/search")
async def search(
    term: str = Query(..., description="Search term (gene, variant, condition)"),
    limit: int = Query(10, ge=1, le=100),
    retmode: str = Query("json"),
):
    try:
        r = await api_get(f"{BASE}/esearch.fcgi", params={
            "db": "clinvar", "term": term, "retmax": limit, "retmode": retmode,
        })
        return {"status": "success", "api": "ClinVar", "data": r.json() if retmode == "json" else r.text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/fetch/{uid}")
async def fetch(uid: str, rettype: str = Query("variation")):
    try:
        r = await api_get(f"{BASE}/efetch.fcgi", params={
            "db": "clinvar", "id": uid, "rettype": rettype, "retmode": "xml",
        })
        return {"status": "success", "api": "ClinVar", "data": r.text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/summary/{uid}")
async def summary(uid: str):
    try:
        r = await api_get(f"{BASE}/esummary.fcgi", params={
            "db": "clinvar", "id": uid, "retmode": "json",
        })
        return {"status": "success", "api": "ClinVar", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
