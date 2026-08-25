"""gnomAD REST API proxy — population variant frequencies and gene constraint."""
from fastapi import APIRouter, HTTPException, Query
from core.http_client import api_get
from core.errors import make_discover_response

router = APIRouter(prefix="/gnomad", tags=["gnomAD"])
BASE = "https://gnomad.broadinstitute.org/api"

ENDPOINTS = [
    {"path": "/gene/{gene_symbol}", "method": "GET", "description": "Get gene constraint and coverage metrics", "query_hint": "gene_symbol: gene symbol (e.g. BRCA2, TP53, CFTR)"},
    {"path": "/variant/{variant_id}", "method": "GET", "description": "Get population frequencies for a variant", "query_hint": "variant_id: variant ID (e.g. 1-55516888-G-A) or rsID"},
    {"path": "/region/{chr}:{start}-{stop}", "method": "GET", "description": "Get variants in a genomic region", "query_hint": "chr: chromosome | start: start position | stop: end position"},
]

@router.get("/discover")
async def discover():
    return make_discover_response(
        "gnomad",
        ENDPOINTS,
        description="Genome Aggregation Database — population variant frequencies across diverse ancestries",
        query_hint="Enter gene symbol (e.g. BRCA2) or variant ID to get population frequencies and constraint metrics",
    )

@router.get("/gene/{gene_symbol}")
async def get_gene(
    gene_symbol: str,
    dataset: str = Query("gnomad_r4", description="Dataset: gnomad_r4, gnomad_r2_1"),
):
    """Get gene constraint metrics and summary."""
    query = """
    query genePage($geneSymbol: String!, $dataset: DatasetId!) {
      gene(geneSymbol: $geneSymbol, referenceGenome: GRCh38) {
        geneId
        symbol
        name
        omimId
        constraints { exp_lof exp_mis exp_syn obs_lof obs_mis obs_syn oe_lof oe_mis }
        variants(dataset: $dataset, first: 20) { variantId rsid pos ref alt }
      }
    }
    """
    try:
        r = await api_get(BASE, params={"query": query, "variables": f'{{"geneSymbol":"{gene_symbol}","dataset":"{dataset}"}}'})
        return {"status": "success", "api": "gnomAD", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/variant/{variant_id}")
async def get_variant(variant_id: str, dataset: str = Query("gnomad_r4")):
    """Get variant frequencies and annotations. Format: chr-pos-ref-alt (e.g., 1-55516888-G-A)."""
    query = """
    query variantPage($variantId: String!, $dataset: DatasetId!) {
      variant(variantId: $variantId, dataset: $dataset) {
        variantId
        rsid
        referenceGenome
        populations { id ac an ac_hemi ac_hom }
        faf95 { popmax popmax_population }
      }
    }
    """
    try:
        r = await api_get(BASE, params={"query": query, "variables": f'{{"variantId":"{variant_id}","dataset":"{dataset}"}}'})
        return {"status": "success", "api": "gnomAD", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/region")
async def get_region(
    chrom: str = Query(...),
    start: int = Query(...),
    stop: int = Query(...),
    dataset: str = Query("gnomad_r4"),
):
    """Get variants in a genomic region."""
    try:
        # gnomAD uses a different endpoint for region queries
        url = f"https://gnomad.broadinstitute.org/api/region/{chrom}-{start}-{stop}/variants"
        r = await api_get(url, params={"dataset": dataset})
        return {"status": "success", "api": "gnomAD", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/coverage/{gene_symbol}")
async def gene_coverage(gene_symbol: str, dataset: str = Query("gnomad_r4")):
    """Get per-exon coverage for a gene."""
    query = """
    query geneCoverage($geneSymbol: String!, $dataset: DatasetId!) {
      gene(geneSymbol: $geneSymbol, referenceGenome: GRCh38) {
        geneId
        symbol
        coverage(dataset: $dataset) { exon { exonNumber start stop } mean median over_1 over_5 over_10 over_15 over_20 over_25 over_30 over_50 over_100 }
      }
    }
    """
    try:
        r = await api_get(BASE, params={"query": query, "variables": f'{{"geneSymbol":"{gene_symbol}","dataset":"{dataset}"}}'})
        return {"status": "success", "api": "gnomAD", "data": r.json()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
