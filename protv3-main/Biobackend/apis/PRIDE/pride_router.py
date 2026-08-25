"""PRIDE / ProteomeXchange REST API proxy — mass spectrometry proteomics."""
from fastapi import APIRouter, HTTPException, Query
from core.http_client import api_get
from core.errors import make_discover_response

router = APIRouter(prefix="/pride", tags=["PRIDE"])
BASE = "https://www.ebi.ac.uk/pride/ws/archive"

ENDPOINTS = [
    {"path": "/projects", "method": "GET", "description": "List PRIDE proteomics projects/datasets", "query_hint": "limit: number of results | offset: pagination offset"},
    {"path": "/project/{accession}", "method": "GET", "description": "Get project details by PRIDE accession", "query_hint": "accession: PXD accession (e.g. PXD000001)"},
    {"path": "/search", "method": "GET", "description": "Search PRIDE by keyword, protein, or peptide", "query_hint": "q: protein ID, peptide sequence, or experiment keyword"},
]

@router.get("/discover")
async def discover():
    return make_discover_response(
        "pride",
        ENDPOINTS,
        description="PRIDE / ProteomeXchange — mass spectrometry proteomics data repository",
        query_hint="Enter dataset accession (e.g. PXD000001), protein ID, or experiment keyword",
    )

@router.get("/projects")
async def list_projects(
    limit: int = Query(10, ge=1, le=100),
    page: int = Query(0),
):
    try:
        r = await api_get(f"{BASE}/project/list", params={"page": page, "pageSize": limit})
        return {"status": "success", "api": "PRIDE", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/project/{accession}")
async def get_project(accession: str):
    try:
        r = await api_get(f"{BASE}/project/{accession}")
        return {"status": "success", "api": "PRIDE", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/search")
async def search(
    q: str = Query(...),
    limit: int = Query(10),
):
    try:
        r = await api_get(f"{BASE}/project/search", params={"q": q, "pageSize": limit})
        return {"status": "success", "api": "PRIDE", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
