"""PubChem PUG-REST API proxy — chemical compounds, substances, bioassays."""
from fastapi import APIRouter, HTTPException, Query
from core.http_client import api_get
from core.errors import make_discover_response

router = APIRouter(prefix="/pubchem", tags=["PubChem"])
PUG_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"

ENDPOINTS = [
    {"path": "/compound/search", "method": "GET", "description": "Search compounds by name, CID, SMILES, or InChI", "query_hint": "q: compound name (e.g. aspirin), CID, SMILES, or InChI | limit: 1-100"},
    {"path": "/compound/{cid}", "method": "GET", "description": "Get full compound record by PubChem CID", "query_hint": "cid: PubChem compound ID (e.g. 2244 for aspirin)"},
    {"path": "/compound/{cid}/property", "method": "GET", "description": "Get computed compound properties", "query_hint": "cid: PubChem CID | properties: comma-separated property names"},
    {"path": "/assay/search", "method": "GET", "description": "Search bioassays by keyword", "query_hint": "q: assay name or keyword | limit: 1-50"},
    {"path": "/assay/{aid}", "method": "GET", "description": "Get assay details by PubChem AID", "query_hint": "aid: PubChem assay ID"},
    {"path": "/target/compound/{cid}", "method": "GET", "description": "Get protein/gene targets associated with a compound", "query_hint": "cid: PubChem compound ID"},
]

@router.get("/discover")
async def discover():
    return make_discover_response(
        "pubchem",
        ENDPOINTS,
        description="Chemical compounds, substances, bioassays, and patents — the largest public chemistry database",
        query_hint="Enter compound name (e.g. aspirin), CID, SMILES, or InChI key to search",
    )

@router.get("/compound/search")
async def search_compounds(
    q: str = Query(..., description="Search term (name, CID, SMILES, InChI)"),
    limit: int = Query(10, ge=1, le=100),
):
    try:
        # Try name lookup first
        r = await api_get(f"{PUG_BASE}/compound/name/{q}/cids/JSON", params={"MaxRecords": limit})
        return {"status": "success", "api": "PubChem", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/compound/{cid}")
async def get_compound(cid: str):
    try:
        r = await api_get(f"{PUG_BASE}/compound/cid/{cid}/JSON")
        return {"status": "success", "api": "PubChem", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/compound/{cid}/property")
async def get_compound_properties(
    cid: str,
    properties: str = Query("MolecularFormula,MolecularWeight,CanonicalSMILES,IUPACName"),
):
    try:
        r = await api_get(f"{PUG_BASE}/compound/cid/{cid}/property/{properties}/JSON")
        return {"status": "success", "api": "PubChem", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/assay/search")
async def search_assays(
    q: str = Query(...),
    limit: int = Query(10, ge=1, le=50),
):
    try:
        r = await api_get(f"{PUG_BASE}/assay/name/{q}/aids/JSON", params={"MaxRecords": limit})
        return {"status": "success", "api": "PubChem", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/assay/{aid}")
async def get_assay(aid: str):
    try:
        r = await api_get(f"{PUG_BASE}/assay/aid/{aid}/JSON")
        return {"status": "success", "api": "PubChem", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/target/compound/{cid}")
async def compound_targets(cid: str):
    """Get protein/gene targets associated with a compound."""
    try:
        r = await api_get(f"{PUG_BASE}/compound/cid/{cid}/xrefs/ProteinGI,GeneID/JSON")
        return {"status": "success", "api": "PubChem", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
