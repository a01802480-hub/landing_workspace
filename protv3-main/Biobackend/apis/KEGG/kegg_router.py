"""KEGG REST API proxy — pathways, metabolism, drugs, diseases."""
from fastapi import APIRouter, HTTPException
from core.http_client import api_get, api_post
from core.errors import make_discover_response

router = APIRouter(prefix="/kegg", tags=["KEGG"])
BASE = "https://rest.kegg.jp"

ENDPOINTS = [
    {"path": "/list/{db}", "method": "GET", "description": "List entries in a KEGG database", "query_hint": "db: pathway, module, disease, drug, compound, genes, genome, enzyme, reaction"},
    {"path": "/get/{ids}", "method": "GET", "description": "Retrieve specific KEGG entries by ID", "query_hint": "ids: comma-separated KEGG IDs (e.g. hsa:10458,map00010)"},
    {"path": "/find/{db}/{query}", "method": "GET", "description": "Search KEGG database by keyword", "query_hint": "db: database name | query: search term (e.g. insulin)"},
    {"path": "/conv/{db1}/{db2}/{ids}", "method": "GET", "description": "Convert identifiers between KEGG databases", "query_hint": "db1/db2: source/target database | ids: comma-separated IDs"},
    {"path": "/link/{db1}/{db2}/{ids}", "method": "GET", "description": "Find cross-references between KEGG databases", "query_hint": "db1/db2: source/target database | ids: entry identifiers"},
]

@router.get("/discover")
async def discover():
    return make_discover_response(
        "kegg",
        ENDPOINTS,
        description="Kyoto Encyclopedia of Genes and Genomes — pathways, metabolism, drugs, and diseases",
        query_hint="Use pathway IDs (e.g. hsa00010), gene IDs, disease names, or drug names",
    )

@router.get("/list/{db}")
async def list_entries(db: str):
    try:
        r = await api_get(f"{BASE}/list/{db}")
        return {"status": "success", "api": "KEGG", "data": r.text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/get/{ids:path}")
async def get_entries(ids: str):
    try:
        r = await api_get(f"{BASE}/get/{ids}")
        return {"status": "success", "api": "KEGG", "data": r.text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/find/{db}/{query:path}")
async def find_entries(db: str, query: str):
    try:
        r = await api_get(f"{BASE}/find/{db}/{query}")
        return {"status": "success", "api": "KEGG", "data": r.text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/conv/{db1}/{db2}/{ids:path}")
async def convert_ids(db1: str, db2: str, ids: str):
    try:
        r = await api_get(f"{BASE}/conv/{db1}/{db2}/{ids}")
        return {"status": "success", "api": "KEGG", "data": r.text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/link/{db1}/{db2}/{ids:path}")
async def link_entries(db1: str, db2: str, ids: str):
    try:
        r = await api_get(f"{BASE}/link/{db1}/{db2}/{ids}")
        return {"status": "success", "api": "KEGG", "data": r.text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
