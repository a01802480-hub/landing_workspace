"""ChEMBL REST API proxy — bioactivity data for drug discovery."""
from fastapi import APIRouter, HTTPException, Query
from core.http_client import api_get
from core.errors import make_discover_response

router = APIRouter(prefix="/chembl", tags=["ChEMBL"])
BASE = "https://www.ebi.ac.uk/chembl/api/data"

ENDPOINTS = [
    {"path": "/molecule/search", "method": "GET", "description": "Search molecules by keyword (name, synonym, SMILES)", "query_hint": "q: search term (e.g. aspirin, imatinib) | limit: 1-100"},
    {"path": "/molecule/{chembl_id}", "method": "GET", "description": "Get detailed molecule info by ChEMBL ID", "query_hint": "chembl_id: e.g. CHEMBL25 (aspirin)"},
    {"path": "/target/search", "method": "GET", "description": "Search drug targets by name or keyword", "query_hint": "q: target name (e.g. EGFR, kinase) | limit: 1-100"},
    {"path": "/target/{chembl_id}", "method": "GET", "description": "Get target details by ChEMBL ID", "query_hint": "chembl_id: e.g. CHEMBL203 (EGFR)"},
    {"path": "/activity/search", "method": "GET", "description": "Search bioactivity data for molecules/targets", "query_hint": "molecule_chembl_id: molecule ID | target_chembl_id: target ID | limit: 1-100"},
    {"path": "/drug/search", "method": "GET", "description": "Search drug indications by keyword", "query_hint": "q: disease or drug name | limit: 1-50"},
]

@router.get("/discover")
async def discover():
    return make_discover_response(
        "chembl",
        ENDPOINTS,
        description="Bioactivity data for drug discovery — compounds, targets, assays, and drug mechanisms",
        query_hint="Enter ChEMBL ID (e.g. CHEMBL25), target name (e.g. EGFR), or compound keyword",
    )

@router.get("/molecule/search")
async def search_molecules(
    q: str = Query(..., description="Search query"),
    limit: int = Query(10, ge=1, le=100),
):
    try:
        r = await api_get(f"{BASE}/molecule.json", params={"q": q, "limit": limit})
        return {"status": "success", "api": "ChEMBL", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/molecule/{chembl_id}")
async def get_molecule(chembl_id: str):
    try:
        r = await api_get(f"{BASE}/molecule/{chembl_id}.json")
        return {"status": "success", "api": "ChEMBL", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/target/search")
async def search_targets(
    q: str = Query(...),
    limit: int = Query(10, ge=1, le=100),
):
    try:
        r = await api_get(f"{BASE}/target.json", params={"q": q, "limit": limit})
        return {"status": "success", "api": "ChEMBL", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/target/{chembl_id}")
async def get_target(chembl_id: str):
    try:
        r = await api_get(f"{BASE}/target/{chembl_id}.json")
        return {"status": "success", "api": "ChEMBL", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/activity/search")
async def search_activities(
    molecule_chembl_id: str = Query(None),
    target_chembl_id: str = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    try:
        params = {"limit": limit}
        if molecule_chembl_id:
            params["molecule_chembl_id"] = molecule_chembl_id
        if target_chembl_id:
            params["target_chembl_id"] = target_chembl_id
        r = await api_get(f"{BASE}/activity.json", params=params)
        return {"status": "success", "api": "ChEMBL", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/drug/search")
async def search_drugs(
    q: str = Query(...),
    limit: int = Query(10, ge=1, le=50),
):
    try:
        r = await api_get(f"{BASE}/drug_indication.json", params={"q": q, "limit": limit})
        return {"status": "success", "api": "ChEMBL", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
