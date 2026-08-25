"""STRING database REST API proxy — protein-protein interaction networks."""
from fastapi import APIRouter, HTTPException, Query
from core.http_client import api_get
from core.errors import make_discover_response

router = APIRouter(prefix="/string", tags=["STRING"])
BASE = "https://string-db.org/api/tsv"

ENDPOINTS = [
    {"path": "/network", "method": "GET", "description": "Get PPI network image/TSV for a set of proteins", "query_hint": "identifiers: protein IDs (newline-separated) | species: NCBI taxon ID (e.g. 9606 for human) | required_score: 0-1000"},
    {"path": "/interaction_partners", "method": "GET", "description": "Find interaction partners for a set of proteins", "query_hint": "identifiers: protein ID(s) | species: NCBI taxon ID | required_score: 0-1000"},
    {"path": "/enrichment", "method": "GET", "description": "Functional enrichment analysis (GO, KEGG, etc.)", "query_hint": "identifiers: protein ID list | species: NCBI taxon ID"},
    {"path": "/ppi_enrichment", "method": "GET", "description": "PPI enrichment p-value for a set of proteins", "query_hint": "identifiers: protein ID list | species: NCBI taxon ID"},
    {"path": "/functional_annotation", "method": "GET", "description": "Retrieve functional annotations for proteins", "query_hint": "identifiers: protein IDs | species: NCBI taxon ID"},
    {"path": "/homology", "method": "GET", "description": "Find homologous proteins across species", "query_hint": "identifiers: protein IDs | species: NCBI taxon ID"},
]

@router.get("/discover")
async def discover():
    return make_discover_response(
        "string",
        ENDPOINTS,
        description="Protein-protein interaction networks — known and predicted interactions with functional enrichment",
        query_hint="Enter protein names, accessions, or a list of proteins for network analysis",
    )

@router.get("/network")
async def get_network(
    identifiers: str = Query(..., description="Protein identifiers (newline-separated)"),
    species: int = Query(9606, description="NCBI taxonomy ID"),
    required_score: int = Query(700, description="Confidence threshold 0-1000"),
    network_type: str = Query("functional", description="functional or physical"),
):
    try:
        r = await api_get(f"{BASE}/network", params={
            "identifiers": identifiers,
            "species": species,
            "required_score": required_score,
            "network_type": network_type,
        })
        return {"status": "success", "api": "STRING", "data": r.text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/interaction_partners")
async def interaction_partners(
    identifiers: str = Query(...),
    species: int = Query(9606),
    required_score: int = Query(700),
    limit: int = Query(10),
):
    try:
        r = await api_get(f"{BASE}/interaction_partners", params={
            "identifiers": identifiers,
            "species": species,
            "required_score": required_score,
            "limit": limit,
        })
        return {"status": "success", "api": "STRING", "data": r.text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/enrichment")
async def functional_enrichment(
    identifiers: str = Query(...),
    species: int = Query(9606),
):
    try:
        r = await api_get(f"{BASE}/enrichment", params={
            "identifiers": identifiers,
            "species": species,
        })
        return {"status": "success", "api": "STRING", "data": r.text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/ppi_enrichment")
async def ppi_enrichment(
    identifiers: str = Query(...),
    species: int = Query(9606),
):
    try:
        r = await api_get(f"{BASE}/ppi_enrichment", params={
            "identifiers": identifiers,
            "species": species,
        })
        return {"status": "success", "api": "STRING", "data": r.text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/functional_annotation")
async def functional_annotation(
    identifiers: str = Query(...),
    species: int = Query(9606),
):
    try:
        r = await api_get(f"{BASE}/functional_annotation", params={
            "identifiers": identifiers,
            "species": species,
        })
        return {"status": "success", "api": "STRING", "data": r.text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/homology")
async def homology(
    identifiers: str = Query(...),
    species: int = Query(9606),
):
    try:
        r = await api_get(f"{BASE}/homology", params={
            "identifiers": identifiers,
            "species": species,
        })
        return {"status": "success", "api": "STRING", "data": r.text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
