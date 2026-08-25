"""GWAS Catalog REST API proxy — genome-wide association studies."""
from fastapi import APIRouter, HTTPException, Query
from core.http_client import api_get
from core.errors import make_discover_response

router = APIRouter(prefix="/gwas", tags=["GWAS Catalog"])
BASE = "https://www.ebi.ac.uk/gwas/rest/api"

ENDPOINTS = [
    {"path": "/studies/search", "method": "GET", "description": "Search GWAS studies by trait, disease, or PubMed ID", "query_hint": "q: search term | trait: EFO URI | pubmed_id: PubMed ID | limit: 1-100"},
    {"path": "/studies/{study_id}", "method": "GET", "description": "Get full details of a GWAS study", "query_hint": "study_id: e.g. GCST000001"},
    {"path": "/associations/search", "method": "GET", "description": "Search SNP-trait associations from GWAS", "query_hint": "variant_id: rsID | study_id: GCST ID | trait: EFO URI | limit: 1-100"},
    {"path": "/variants/search", "method": "GET", "description": "Search variants by rsID or genomic region", "query_hint": "q: rsID (e.g. rs334) or genomic region | limit: 1-100"},
    {"path": "/traits/search", "method": "GET", "description": "Search traits studied in GWAS", "query_hint": "q: trait name (e.g. diabetes) | limit: 1-50"},
]

@router.get("/discover")
async def discover():
    return make_discover_response(
        "gwas_catalog",
        ENDPOINTS,
        description="Genome-Wide Association Studies catalog — SNP-trait associations from published studies",
        query_hint="Enter trait/disease name (e.g. diabetes), gene, or SNP rsID (e.g. rs334)",
    )

@router.get("/studies/search")
async def search_studies(
    q: str = Query(None),
    trait: str = Query(None),
    pubmed_id: str = Query(None),
    limit: int = Query(10, ge=1, le=100),
):
    """Search GWAS studies by trait, disease, or PubMed ID."""
    params = {"size": limit}
    query_parts = []
    if q:
        query_parts.append(q)
    if trait:
        params["efoUri"] = trait
    if pubmed_id:
        params["pubmedId"] = pubmed_id
    try:
        r = await api_get(f"{BASE}/studies/search", params=params)
        return {"status": "success", "api": "GWAS Catalog", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/studies/{study_id}")
async def get_study(study_id: str):
    try:
        r = await api_get(f"{BASE}/studies/{study_id}")
        return {"status": "success", "api": "GWAS Catalog", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/associations/search")
async def search_associations(
    variant_id: str = Query(None),
    study_id: str = Query(None),
    trait: str = Query(None),
    limit: int = Query(10, ge=1, le=100),
):
    params = {"size": limit}
    if variant_id:
        params["variantId"] = variant_id
    if study_id:
        params["studyId"] = study_id
    if trait:
        params["efoUri"] = trait
    try:
        r = await api_get(f"{BASE}/associations/search", params=params)
        return {"status": "success", "api": "GWAS Catalog", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/variants/search")
async def search_variants(
    q: str = Query(None, description="rsID or genomic region"),
    limit: int = Query(10, ge=1, le=100),
):
    try:
        r = await api_get(f"{BASE}/variants/search", params={"q": q, "size": limit} if q else {"size": limit})
        return {"status": "success", "api": "GWAS Catalog", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/traits/search")
async def search_traits(
    q: str = Query(...),
    limit: int = Query(10, ge=1, le=50),
):
    try:
        r = await api_get(f"{BASE}/traits/search", params={"q": q, "size": limit})
        return {"status": "success", "api": "GWAS Catalog", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
