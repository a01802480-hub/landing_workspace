"""IntAct molecular interaction REST API proxy."""
from fastapi import APIRouter, HTTPException, Query
from core.http_client import api_get
from core.errors import make_discover_response

router = APIRouter(prefix="/intact", tags=["IntAct"])
BASE = "https://www.ebi.ac.uk/intact/rest"

ENDPOINTS = [
    {"path": "/search", "method": "GET", "description": "Search molecular interactions by protein/gene name", "query_hint": "q: protein name/accession (e.g. TP53), gene name, or interaction keyword"},
    {"path": "/interaction/{id}", "method": "GET", "description": "Get interaction details by IntAct ID", "query_hint": "id: IntAct interaction accession (e.g. EBI-1234567)"},
    {"path": "/network/{query}", "method": "GET", "description": "Get interaction network for a protein", "query_hint": "query: protein identifier (UniProt, gene name, etc.)"},
]

@router.get("/discover")
async def discover():
    return make_discover_response(
        "intact",
        ENDPOINTS,
        description="Molecular interaction database — curated protein-protein, protein-DNA, and protein-small molecule interactions",
        query_hint="Enter protein accession, gene name, or interaction ID to find binding partners",
    )

@router.get("/search")
async def search(
    q: str = Query(..., description="Gene/protein name or UniProt accession"),
    limit: int = Query(10, ge=1, le=50),
):
    try:
        r = await api_get(f"{BASE}/search", params={"query": q, "format": "json", "maxResults": limit})
        return {"status": "success", "api": "IntAct", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/interaction/{interaction_id}")
async def get_interaction(interaction_id: str):
    try:
        r = await api_get(f"{BASE}/interaction/{interaction_id}", params={"format": "json"})
        return {"status": "success", "api": "IntAct", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/network")
async def network(
    query: str = Query(..., description="MIQL query for interaction network"),
    limit: int = Query(50),
):
    try:
        r = await api_get(f"{BASE}/network", params={"query": query, "format": "json", "maxResults": limit})
        return {"status": "success", "api": "IntAct", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
