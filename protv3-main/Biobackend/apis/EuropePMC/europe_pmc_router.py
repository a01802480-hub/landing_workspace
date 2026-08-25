"""Europe PMC REST API proxy — biomedical literature search."""
from fastapi import APIRouter, HTTPException, Query
from core.http_client import api_get
from core.errors import make_discover_response

router = APIRouter(prefix="/europe-pmc", tags=["Europe PMC"])
BASE = "https://www.ebi.ac.uk/europepmc/webservices/rest"

ENDPOINTS = [
    {"path": "/search", "method": "GET", "description": "Search biomedical literature (42M+ articles)", "query_hint": "q: keywords, author, DOI, or PMID | limit: 1-100"},
    {"path": "/article/{pmid}", "method": "GET", "description": "Get full article metadata by PMID", "query_hint": "pmid: PubMed ID (e.g. 30000001)"},
    {"path": "/citations/{pmid}", "method": "GET", "description": "Get articles that cite this PMID", "query_hint": "pmid: PubMed ID to find citing articles"},
    {"path": "/references/{pmid}", "method": "GET", "description": "Get references cited by this article", "query_hint": "pmid: PubMed ID of the article"},
    {"path": "/datalinks/{pmid}", "method": "GET", "description": "Get linked datasets and supplementary data", "query_hint": "pmid: PubMed ID to find linked data"},
]

@router.get("/discover")
async def discover():
    return make_discover_response(
        "europe_pmc",
        ENDPOINTS,
        description="42M+ biomedical research articles, abstracts, citations, and text-mined annotations",
        query_hint="Enter keywords, author name, DOI, or PMID to search biomedical literature",
    )

@router.get("/search")
async def search(
    query: str = Query(..., description="Search query (supports full query syntax)"),
    result_type: str = Query("core", description="core, lite, or idlist"),
    limit: int = Query(10, ge=1, le=100),
    page: int = Query(1, ge=1),
):
    try:
        r = await api_get(f"{BASE}/search", params={
            "query": query, "resultType": result_type, "pageSize": limit, "page": page, "format": "json",
        })
        return {"status": "success", "api": "Europe PMC", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/article/{pmid}")
async def get_article(pmid: str):
    try:
        r = await api_get(f"{BASE}/article/PMC/{pmid}", params={"format": "json"})
        return {"status": "success", "api": "Europe PMC", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/citations/{pmid}")
async def get_citations(pmid: str, limit: int = Query(10)):
    try:
        r = await api_get(f"{BASE}/citations/MED/{pmid}", params={"format": "json", "pageSize": limit})
        return {"status": "success", "api": "Europe PMC", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/references/{pmid}")
async def get_references(pmid: str, limit: int = Query(10)):
    try:
        r = await api_get(f"{BASE}/references/MED/{pmid}", params={"format": "json", "pageSize": limit})
        return {"status": "success", "api": "Europe PMC", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/datalinks/{pmid}")
async def get_datalinks(pmid: str):
    try:
        r = await api_get(f"{BASE}/MED/{pmid}/datalinks", params={"format": "json"})
        return {"status": "success", "api": "Europe PMC", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
