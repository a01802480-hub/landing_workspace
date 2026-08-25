"""DrugBank API proxy — drug data, interactions, targets."""
from fastapi import APIRouter, HTTPException, Query
from core.http_client import api_get
from core.errors import make_discover_response
from core.config import get_api_config

router = APIRouter(prefix="/drugbank", tags=["DrugBank"])

ENDPOINTS = [
    {"path": "/search", "method": "GET", "description": "Search drugs by name, indication, or mechanism", "query_hint": "q: drug name (e.g. imatinib, metformin) | limit: 1-100"},
    {"path": "/drug/{drug_id}", "method": "GET", "description": "Get detailed drug information", "query_hint": "drug_id: DrugBank ID (e.g. DB00619)"},
    {"path": "/target/{target_id}", "method": "GET", "description": "Get drug target information", "query_hint": "target_id: DrugBank target ID"},
]

def _headers():
    cfg = get_api_config("drugbank")
    h = {"Accept": "application/json"}
    if cfg.get("api_key"):
        h["Authorization"] = f"Bearer {cfg['api_key']}"
    return h

@router.get("/discover")
async def discover():
    return make_discover_response(
        "drugbank",
        ENDPOINTS,
        description="Comprehensive drug database — mechanisms, targets, pharmacokinetics, and drug interactions",
        query_hint="Enter drug name (e.g. imatinib), DrugBank ID (e.g. DB00619), or target protein",
    )

@router.get("/search")
async def search(
    q: str = Query(...),
    limit: int = Query(10),
):
    try:
        cfg = get_api_config("drugbank")
        r = await api_get(f"{cfg['base_url']}/drugs/search", params={"q": q, "limit": limit}, headers=_headers())
        return {"status": "success", "api": "DrugBank", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/drug/{drug_id}")
async def get_drug(drug_id: str):
    try:
        cfg = get_api_config("drugbank")
        r = await api_get(f"{cfg['base_url']}/drugs/{drug_id}", headers=_headers())
        return {"status": "success", "api": "DrugBank", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/target/{target_id}")
async def get_target(target_id: str):
    try:
        cfg = get_api_config("drugbank")
        r = await api_get(f"{cfg['base_url']}/targets/{target_id}", headers=_headers())
        return {"status": "success", "api": "DrugBank", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
