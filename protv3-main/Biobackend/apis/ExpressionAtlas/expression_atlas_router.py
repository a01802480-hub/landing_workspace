"""Expression Atlas REST API proxy — gene expression across species and conditions."""
from fastapi import APIRouter, HTTPException, Query
from core.http_client import api_get
from core.errors import make_discover_response

router = APIRouter(prefix="/expression-atlas", tags=["Expression Atlas"])

ENDPOINTS = [
    {"path": "/search", "method": "GET", "description": "Search experiments and genes in Expression Atlas", "query_hint": "q: gene name (e.g. TP53), condition, or experiment keyword"},
    {"path": "/experiments", "method": "GET", "description": "List expression experiments", "query_hint": "species: species name | assay: assay type"},
    {"path": "/gene/{gene_id}", "method": "GET", "description": "Get gene expression across experiments", "query_hint": "gene_id: gene symbol (e.g. BRCA2, IL6)"},
    {"path": "/baseline/{gene_id}", "method": "GET", "description": "Get baseline gene expression across tissues", "query_hint": "gene_id: gene symbol for tissue expression profiles"},
]

@router.get("/discover")
async def discover():
    return make_discover_response(
        "expression_atlas",
        ENDPOINTS,
        description="Gene and protein expression across species, tissues, and experimental conditions",
        query_hint="Enter gene name (e.g. TP53) or condition (e.g. cancer) to see expression data",
    )

@router.get("/search")
async def search(
    q: str = Query(..., description="Gene name, species, or condition"),
    species: str = Query(None),
    limit: int = Query(10),
):
    base = "https://www.ebi.ac.uk/gxa/json/search"
    params = {"q": q, "maxResults": limit}
    if species:
        params["species"] = species
    try:
        r = await api_get(base, params=params)
        return {"status": "success", "api": "Expression Atlas", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/experiments")
async def list_experiments(
    species: str = Query(None),
    limit: int = Query(10),
):
    base = "https://www.ebi.ac.uk/gxa/json/experiments"
    try:
        r = await api_get(base, params={"species": species} if species else None)
        return {"status": "success", "api": "Expression Atlas", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/gene/{gene_id}")
async def get_gene_expression(gene_id: str):
    """Get expression data for a specific gene."""
    base = f"https://www.ebi.ac.uk/gxa/json/genes/{gene_id}"
    try:
        r = await api_get(base)
        return {"status": "success", "api": "Expression Atlas", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/baseline/{gene_id}")
async def baseline_expression(
    gene_id: str,
    species: str = Query("homo sapiens"),
):
    base = f"https://www.ebi.ac.uk/gxa/json/baselineExpression"
    try:
        r = await api_get(base, params={"geneId": gene_id, "species": species})
        return {"status": "success", "api": "Expression Atlas", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
