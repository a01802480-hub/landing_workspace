"""Open Targets Platform GraphQL API proxy — target-disease associations."""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from core.http_client import api_post
from core.errors import make_discover_response

router = APIRouter(prefix="/open-targets", tags=["Open Targets"])
BASE = "https://api.platform.opentargets.org/api/v4/graphql"

ENDPOINTS = [
    {"path": "/graphql", "method": "POST", "description": "Run arbitrary GraphQL queries against Open Targets", "query_hint": "Send JSON body with query string and optional variables"},
    {"path": "/search", "method": "GET", "description": "Search targets and diseases by keyword", "query_hint": "q: gene name (e.g. EGFR) or disease name"},
    {"path": "/target/{ensembl_id}", "method": "GET", "description": "Get target details by Ensembl gene ID", "query_hint": "ensembl_id: e.g. ENSG00000146648 (EGFR)"},
    {"path": "/disease/{efo_id}", "method": "GET", "description": "Get disease information by EFO ID", "query_hint": "efo_id: e.g. EFO_0000319 (cardiovascular disease)"},
    {"path": "/association", "method": "GET", "description": "Get target-disease association scores", "query_hint": "target: Ensembl gene ID | disease: EFO ID"},
]

class GraphQLRequest(BaseModel):
    query: str
    variables: dict | None = None

@router.get("/discover")
async def discover():
    return make_discover_response(
        "open_targets",
        ENDPOINTS,
        description="Target-disease associations for drug target prioritization using genetics, omics, and literature evidence",
        query_hint="Enter target gene (e.g. EGFR) or disease name to explore target-disease evidence",
    )

@router.post("/graphql")
async def graphql_query(req: GraphQLRequest):
    try:
        r = await api_post(BASE, json={"query": req.query, "variables": req.variables or {}})
        return {"status": "success", "api": "Open Targets", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/search")
async def search(
    q: str = Query(..., description="Search term (gene or disease)"),
    entity: str = Query("target", description="target or disease"),
    limit: int = Query(10),
):
    query = """
    query search($q: String!, $entity: String!, $size: Int!) {
      search(queryString: $q, entityNames: [$entity], page: {size: $size}) {
        hits { id name description score }
        total
      }
    }
    """
    try:
        r = await api_post(BASE, json={"query": query, "variables": {"q": q, "entity": entity, "size": limit}})
        return {"status": "success", "api": "Open Targets", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/target/{ensembl_id}")
async def get_target(ensembl_id: str):
    query = """
    query target($ensemblId: String!) {
      target(ensemblId: $ensemblId) {
        id approvedSymbol approvedName
        tractability { smallmolecule { topCategory } antibody { topCategory } }
        knownDrugs { rows { drug { name type } phase status } }
      }
    }
    """
    try:
        r = await api_post(BASE, json={"query": query, "variables": {"ensemblId": ensembl_id}})
        return {"status": "success", "api": "Open Targets", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/disease/{efo_id}")
async def get_disease(efo_id: str):
    query = """
    query disease($efoId: String!) {
      disease(efoId: $efoId) {
        id name description
        knownDrugs { rows { drug { name type } phase status } }
        associatedTargets { rows { target { id approvedSymbol } score } }
      }
    }
    """
    try:
        r = await api_post(BASE, json={"query": query, "variables": {"efoId": efo_id}})
        return {"status": "success", "api": "Open Targets", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
