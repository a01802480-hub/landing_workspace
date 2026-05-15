from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
from pathlib import Path
from pydantic import BaseModel
from typing import Dict, Any, List
import requests
import logging
import os

# --- Auto-generated API imports from agent ---
from apis.AlphaFold import alphafold_router
from apis.BLAST import blast_router
from apis.Clustalo import clustalo_router
from apis.Ensembl import ensembl_router
from apis.GeneOntology import geneontology_router
from apis.HMMER import hmmer_router
from apis.InterPro import interpro_router
from apis.Jalview import jalview_router
from apis.MAFFT import mafft_router
from apis.Muscle import muscle_router
from apis.NCBI import ncbi_router
from apis.PDBe import pdbe_router
from apis.Reactome import reactome_router
from apis.SwissModel import swissmodel_router
from apis.TCoffee import tcoffee_router
from apis.SIFT.sift_router import router as sift_router
from apis.Uniprot.uniprot_router import router as uniprot_router

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Bioinformatics API Hub",
    description="An auto-discovered and generated API gateway for bioinformatics tools.",
    version="1.0.0"
)

# Configure CORS based on environment
# In production (Cloudflare), allow all origins
# In development, allow localhost origins
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
# If single "*" is provided, use it directly; otherwise use the list
if ALLOWED_ORIGINS == ["*"]:
    cors_origins = ["*"]
else:
    cors_origins = [origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()]

app.add_middleware(
    CORSMiddleware, 
    allow_origins=cors_origins, 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"]
)

app.include_router(alphafold_router)
app.include_router(blast_router)
app.include_router(clustalo_router)
app.include_router(ensembl_router)
app.include_router(geneontology_router)
app.include_router(hmmer_router)
app.include_router(interpro_router)
app.include_router(jalview_router)
app.include_router(mafft_router)
app.include_router(muscle_router)
app.include_router(ncbi_router)
app.include_router(pdbe_router)
app.include_router(reactome_router)
app.include_router(swissmodel_router)
app.include_router(tcoffee_router)
app.include_router(sift_router)
app.include_router(uniprot_router)

@app.get("/", include_in_schema=False)
async def root():
    return {"message": "Welcome to the Bioinformatics API Hub!"}


# --- Enhanced Alignment Endpoint with Multi-Engine Support ---
class AlignmentRequest(BaseModel):
    sequence1: str
    sequence2: str
    engine: str = "clustalo"  # clustalo, mafft, muscle, tcoffee
    run_uniprot: bool = False
    run_sift: bool = False

@app.post("/align", tags=["Alignment"])
async def align_sequences(request: AlignmentRequest):
    """
    Unified alignment endpoint supporting multiple engines.
    Can optionally run UniProt lookup and SIFT predictions.
    Returns alignment results with optional proteomics data.
    """
    try:
        logger.info(f"Alignment request: engine={request.engine}, seq1 length={len(request.sequence1)}, seq2 length={len(request.sequence2)}")
        
        # Validate sequences
        if not request.sequence1 or not request.sequence2:
            raise HTTPException(status_code=400, detail="Both sequences must be provided and non-empty")
        
        # Select alignment engine
        engine_map = {
            "clustalo": "https://www.ebi.ac.uk/Tools/services/rest/clustalo",
            "mafft": "https://www.ebi.ac.uk/Tools/services/rest/mafft",
            "muscle": "https://www.ebi.ac.uk/Tools/services/rest/muscle",
            "tcoffee": "https://www.ebi.ac.uk/Tools/services/rest/tcoffee"
        }
        
        base_url = engine_map.get(request.engine.lower())
        if not base_url:
            raise HTTPException(status_code=400, detail=f"Unsupported engine: {request.engine}. Use: clustalo, mafft, muscle, tcoffee")
        
        logger.info(f"Selected engine: {request.engine.upper()}")
        
        # Prepare the job submission as form data (EBI requires form-encoded data)
        job_data = {
            "sequence": f">seq1\n{request.sequence1}\n>seq2\n{request.sequence2}",
            "email": "user@example.com",  # Required by EBI
            "stype": "protein",  # Default to protein
            "outfmt": "clustal_num",
            "order": "aligned"
        }
        
        logger.info(f"Submitting job to {request.engine.upper()}...")
        
        # Submit job
        job_response = requests.post(f"{base_url}/run/", data=job_data, timeout=60)
        job_response.raise_for_status()
        
        job_id = job_response.text.strip()
        logger.info(f"Job submitted successfully. Job ID: {job_id}")
        
        # Poll for job completion
        import time
        max_attempts = 60  # 5 minutes max
        
        for attempt in range(max_attempts):
            time.sleep(5)
            
            status_response = requests.get(f"{base_url}/status/{job_id}", timeout=30)
            status_response.raise_for_status()
            status = status_response.text.strip()
            
            if status == "FINISHED":
                logger.info("Job finished! Retrieving results...")
                
                # Determine the appropriate result endpoint based on engine
                # Different engines have different output format parameters
                result_endpoint = f"{base_url}/result/{job_id}"
                
                # For Clustal Omega, use aln-clustal_num format
                if request.engine.lower() == "clustalo":
                    result_endpoint += "/aln-clustal_num"
                else:
                    # For other engines, try to get their native format
                    # MAFFT, MUSCLE, T-Coffee support various formats
                    # Use 'aln-fasta' as default for better parsing, or engine-specific
                    if request.engine.lower() == "mafft":
                        result_endpoint += "/aln-fasta"  # MAFFT's native FASTA format
                    elif request.engine.lower() == "muscle":
                        result_endpoint += "/aln-fasta"  # MUSCLE's native FASTA format
                    elif request.engine.lower() == "tcoffee":
                        result_endpoint += "/aln-clustalw"  # T-Coffee's ClustalW format
                    else:
                        result_endpoint += "/aln-clustal_num"  # Fallback
                
                result_response = requests.get(result_endpoint, timeout=30)
                result_response.raise_for_status()
                
                alignment_text = result_response.text
                logger.info(f"Alignment result retrieved: {len(alignment_text)} characters")
                
                # Build response object
                response_data = {
                    "status": "success",
                    "message": alignment_text,
                    "job_id": job_id,
                    "engine": request.engine,
                    "engine_used": request.engine.upper()
                }
                
                logger.info(f"Returning alignment result from {request.engine.upper()}")
                
                # Optionally run UniProt lookup
                if request.run_uniprot:
                    logger.info("Running UniProt lookup...")
                    uniprot_results = await lookup_uniprot_sequences([request.sequence1, request.sequence2])
                    response_data["uniprot"] = uniprot_results
                
                # Optionally run SIFT predictions
                if request.run_sift:
                    logger.info("Running SIFT predictions...")
                    sift_results = await run_sift_predictions(alignment_text, request.sequence1, request.sequence2)
                    response_data["sift"] = sift_results
                
                return response_data
                
            elif status in ["ERROR", "FAILURE"]:
                raise HTTPException(status_code=500, detail=f"{request.engine.upper()} job failed")
        
        raise HTTPException(status_code=504, detail=f"Alignment timed out after 5 minutes")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Alignment failed: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Alignment failed: {str(e)}")


async def lookup_uniprot_sequences(sequences: list[str]) -> list[dict]:
    """
    Look up protein information from UniProt based on sequences.
    Uses BLAST against UniProt database to find matches.
    """
    uniprot_results = []
    
    for idx, seq in enumerate(sequences):
        try:
            # Use UniProt BLAST API to find matching proteins
            blast_url = "https://www.uniprot.org/blast/run"
            blast_data = {
                "query": f">seq{idx+1}\n{seq}",
                "database": "uniprotkb",
                "format": "json"
            }
            
            response = requests.post(blast_url, data=blast_data, timeout=60)
            
            if response.status_code == 200:
                blast_result = response.json()
                job_id = blast_result.get("jobId")
                
                if job_id:
                    # Poll for BLAST results
                    import time
                    for _ in range(30):  # Wait up to 2.5 minutes
                        time.sleep(5)
                        status_resp = requests.get(f"https://www.uniprot.org/blast/status/{job_id}", timeout=30)
                        if status_resp.status_code == 200:
                            status_data = status_resp.json()
                            if status_data.get("status") == "COMPLETE":
                                results_resp = requests.get(f"https://www.uniprot.org/blast/results/{job_id}", timeout=30)
                                if results_resp.status_code == 200:
                                    hits = results_resp.json().get("results", [])[:3]  # Top 3 hits
                                    
                                    for hit in hits:
                                        accession = hit.get("targetAccession", "")
                                        if accession:
                                            # Get detailed protein info
                                            protein_info = await get_uniprot_protein_details(accession)
                                            uniprot_results.append({
                                                "sequence_index": idx,
                                                "accession": accession,
                                                "protein_name": protein_info.get("proteinName", "Unknown"),
                                                "organism": protein_info.get("organism", "Unknown"),
                                                "gene": protein_info.get("geneName", "Unknown"),
                                                "function": protein_info.get("function", "Unknown"),
                                                "score": hit.get("score", 0),
                                                "evalue": hit.get("evalue", 0)
                                            })
                                break
        except Exception as e:
            logger.error(f"UniProt lookup failed for sequence {idx}: {str(e)}")
            continue
    
    return uniprot_results


async def get_uniprot_protein_details(accession: str) -> dict:
    """Get detailed protein information from UniProt REST API"""
    try:
        url = f"https://rest.uniprot.org/uniprotkb/{accession}.json"
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            return {
                "proteinName": data.get("proteinDescription", {}).get("recommendedName", {}).get("fullName", {}).get("value", "Unknown"),
                "organism": data.get("organism", {}).get("scientificName", "Unknown"),
                "geneName": data.get("genes", [{}])[0].get("geneName", {}).get("value", "Unknown") if data.get("genes") else "Unknown",
                "function": "; ".join([f.get("texts", [{}])[0].get("value", "") for f in data.get("comments", []) if f.get("commentType") == "FUNCTION"][:1]) or "Unknown"
            }
    except Exception as e:
        logger.error(f"Failed to get UniProt details for {accession}: {str(e)}")
    
    return {"proteinName": "Unknown", "organism": "Unknown", "geneName": "Unknown", "function": "Unknown"}


async def run_sift_predictions(alignment_text: str, seq1: str, seq2: str) -> list[dict]:
    """
    Run SIFT predictions on mismatched positions from alignment.
    Returns predictions for each variant position.
    """
    try:
        # Parse alignment to find mismatches
        lines = alignment_text.split('\n')
        seq1_aligned = ""
        seq2_aligned = ""
        
        for line in lines:
            if line.startswith('seq1'):
                parts = line.split()
                if len(parts) >= 2:
                    seq1_aligned = parts[1]
            elif line.startswith('seq2'):
                parts = line.split()
                if len(parts) >= 2:
                    seq2_aligned = parts[1]
        
        if not seq1_aligned or not seq2_aligned:
            return []
        
        # Find mismatch positions
        sift_predictions = []
        for i, (aa1, aa2) in enumerate(zip(seq1_aligned, seq2_aligned)):
            if aa1 != '-' and aa2 != '-' and aa1 != aa2:
                # Found a mismatch - predict with SIFT
                prediction = await predict_sift_variant(seq1, i, aa1, aa2)
                if prediction:
                    sift_predictions.append(prediction)
        
        return sift_predictions
        
    except Exception as e:
        logger.error(f"SIFT prediction failed: {str(e)}")
        return []


async def predict_sift_variant(sequence: str, position: int, ref_aa: str, var_aa: str) -> dict | None:
    """Predict effect of a single variant using SIFT"""
    try:
        # Call SIFT API
        sift_url = "https://sift.bii.a-star.edu.sg/www/predict"
        payload = {
            "sequence": f">protein\n{sequence}",
            "position": f"{ref_aa}{position+1}{var_aa}",
            "matrix": "BLOSUM62"
        }
        
        response = requests.post(sift_url, json=payload, timeout=60)
        
        if response.status_code == 200:
            result = response.json()
            return {
                "position": position + 1,
                "reference_aa": ref_aa,
                "variant_aa": var_aa,
                "sift_score": result.get("data", {}).get("predictions", [{}])[0].get("sift_score", 0.5),
                "prediction": result.get("data", {}).get("predictions", [{}])[0].get("prediction", "UNKNOWN"),
                "blosum62_score": get_blosum62_score(ref_aa, var_aa)
            }
    except Exception as e:
        logger.error(f"SIFT variant prediction failed at position {position}: {str(e)}")
    
    return None


def get_blosum62_score(aa1: str, aa2: str) -> int:
    """Get BLOSUM62 score for amino acid pair"""
    blosum62 = {
        'A': {'A': 4, 'R': -1, 'N': -2, 'D': -2, 'C': 0, 'Q': -1, 'E': -1, 'G': 0, 'H': -2, 'I': -1, 'L': -1, 'K': -1, 'M': -1, 'F': -2, 'P': -1, 'S': 1, 'T': 0, 'W': -3, 'Y': -2, 'V': 0},
        'R': {'A': -1, 'R': 5, 'N': 0, 'D': -2, 'C': -3, 'Q': 1, 'E': 0, 'G': -2, 'H': 0, 'I': -3, 'L': -2, 'K': 2, 'M': -1, 'F': -3, 'P': -2, 'S': -1, 'T': -1, 'W': -3, 'Y': -2, 'V': -3},
        'N': {'A': -2, 'R': 0, 'N': 6, 'D': 1, 'C': -3, 'Q': 0, 'E': 0, 'G': 0, 'H': 1, 'I': -3, 'L': -3, 'K': 0, 'M': -2, 'F': -3, 'P': -2, 'S': 1, 'T': 0, 'W': -4, 'Y': -2, 'V': -3},
        'D': {'A': -2, 'R': -2, 'N': 1, 'D': 6, 'C': -3, 'Q': 0, 'E': 2, 'G': -1, 'H': -1, 'I': -3, 'L': -4, 'K': -1, 'M': -3, 'F': -3, 'P': -1, 'S': 0, 'T': -1, 'W': -4, 'Y': -3, 'V': -3},
        'C': {'A': 0, 'R': -3, 'N': -3, 'D': -3, 'C': 9, 'Q': -3, 'E': -4, 'G': -3, 'H': -3, 'I': -1, 'L': -1, 'K': -3, 'M': -1, 'F': -2, 'P': -3, 'S': -1, 'T': -1, 'W': -2, 'Y': -2, 'V': -1},
        'Q': {'A': -1, 'R': 1, 'N': 0, 'D': 0, 'C': -3, 'Q': 5, 'E': 2, 'G': -2, 'H': 0, 'I': -3, 'L': -2, 'K': 1, 'M': 0, 'F': -3, 'P': -1, 'S': 0, 'T': -1, 'W': -2, 'Y': -1, 'V': -2},
        'E': {'A': -1, 'R': 0, 'N': 0, 'D': 2, 'C': -4, 'Q': 2, 'E': 5, 'G': -2, 'H': 0, 'I': -3, 'L': -3, 'K': 1, 'M': -2, 'F': -3, 'P': -1, 'S': 0, 'T': -1, 'W': -3, 'Y': -2, 'V': -2},
        'G': {'A': 0, 'R': -2, 'N': 0, 'D': -1, 'C': -3, 'Q': -2, 'E': -2, 'G': 6, 'H': -2, 'I': -4, 'L': -4, 'K': -2, 'M': -3, 'F': -3, 'P': -2, 'S': 0, 'T': -2, 'W': -2, 'Y': -3, 'V': -3},
        'H': {'A': -2, 'R': 0, 'N': 1, 'D': -1, 'C': -3, 'Q': 0, 'E': 0, 'G': -2, 'H': 8, 'I': -3, 'L': -3, 'K': -1, 'M': -2, 'F': -1, 'P': -2, 'S': -1, 'T': -2, 'W': -2, 'Y': 2, 'V': -3},
        'I': {'A': -1, 'R': -3, 'N': -3, 'D': -3, 'C': -1, 'Q': -3, 'E': -3, 'G': -4, 'H': -3, 'I': 4, 'L': 2, 'K': -3, 'M': 1, 'F': 0, 'P': -3, 'S': -2, 'T': -1, 'W': -3, 'Y': -1, 'V': 3},
        'L': {'A': -1, 'R': -2, 'N': -3, 'D': -4, 'C': -1, 'Q': -2, 'E': -3, 'G': -4, 'H': -3, 'I': 2, 'L': 4, 'K': -2, 'M': 2, 'F': 0, 'P': -3, 'S': -2, 'T': -1, 'W': -2, 'Y': -1, 'V': 1},
        'K': {'A': -1, 'R': 2, 'N': 0, 'D': -1, 'C': -3, 'Q': 1, 'E': 1, 'G': -2, 'H': -1, 'I': -3, 'L': -2, 'K': 5, 'M': -1, 'F': -3, 'P': -1, 'S': 0, 'T': -1, 'W': -3, 'Y': -2, 'V': -2},
        'M': {'A': -1, 'R': -1, 'N': -2, 'D': -3, 'C': -1, 'Q': 0, 'E': -2, 'G': -3, 'H': -2, 'I': 1, 'L': 2, 'K': -1, 'M': 5, 'F': 0, 'P': -2, 'S': -1, 'T': -1, 'W': -1, 'Y': -1, 'V': 1},
        'F': {'A': -2, 'R': -3, 'N': -3, 'D': -3, 'C': -2, 'Q': -3, 'E': -3, 'G': -3, 'H': -1, 'I': 0, 'L': 0, 'K': -3, 'M': 0, 'F': 6, 'P': -4, 'S': -2, 'T': -2, 'W': 1, 'Y': 3, 'V': -1},
        'P': {'A': -1, 'R': -2, 'N': -2, 'D': -1, 'C': -3, 'Q': -1, 'E': -1, 'G': -2, 'H': -2, 'I': -3, 'L': -3, 'K': -1, 'M': -2, 'F': -4, 'P': 7, 'S': -1, 'T': -1, 'W': -4, 'Y': -3, 'V': -2},
        'S': {'A': 1, 'R': -1, 'N': 1, 'D': 0, 'C': -1, 'Q': 0, 'E': 0, 'G': 0, 'H': -1, 'I': -2, 'L': -2, 'K': 0, 'M': -1, 'F': -2, 'P': -1, 'S': 4, 'T': 1, 'W': -3, 'Y': -2, 'V': -2},
        'T': {'A': 0, 'R': -1, 'N': 0, 'D': -1, 'C': -1, 'Q': -1, 'E': -1, 'G': -2, 'H': -2, 'I': -1, 'L': -1, 'K': -1, 'M': -1, 'F': -2, 'P': -1, 'S': 1, 'T': 5, 'W': -2, 'Y': -2, 'V': 0},
        'W': {'A': -3, 'R': -3, 'N': -4, 'D': -4, 'C': -2, 'Q': -2, 'E': -3, 'G': -2, 'H': -2, 'I': -3, 'L': -2, 'K': -3, 'M': -1, 'F': 1, 'P': -4, 'S': -3, 'T': -2, 'W': 11, 'Y': 2, 'V': -3},
        'Y': {'A': -2, 'R': -2, 'N': -2, 'D': -3, 'C': -2, 'Q': -1, 'E': -2, 'G': -3, 'H': 2, 'I': -1, 'L': -1, 'K': -2, 'M': -1, 'F': 3, 'P': -3, 'S': -2, 'T': -2, 'W': 2, 'Y': 7, 'V': -1},
        'V': {'A': 0, 'R': -3, 'N': -3, 'D': -3, 'C': -1, 'Q': -2, 'E': -2, 'G': -3, 'H': -3, 'I': 3, 'L': 1, 'K': -2, 'M': 1, 'F': -1, 'P': -2, 'S': -2, 'T': 0, 'W': -3, 'Y': -1, 'V': 4}
    }
    
    return blosum62.get(aa1.upper(), {}).get(aa2.upper(), -4)


# --- Post-Alignment Analysis Endpoints ---
class PostAlignmentAnalysisRequest(BaseModel):
    aligned_query: str
    aligned_subject: str
    original_query: str
    original_subject: str
    run_sift: bool = False
    run_uniprot: bool = False
    matrix: str = "BLOSUM62"

@app.post("/analyze-alignment", tags=["Post-Alignment Analysis"])
async def analyze_alignment(request: PostAlignmentAnalysisRequest):
    """
    Run post-alignment analysis (SIFT predictions, UniProt lookup) on existing alignments.
    This allows users to run these analyses after alignment in the worksheet.
    """
    try:
        logger.info(f"🔬 Received post-alignment analysis request")
        
        response_data = {
            "status": "success",
            "message": "Analysis completed"
        }
        
        # Run SIFT predictions if requested
        if request.run_sift:
            logger.info("🧬 Running SIFT predictions...")
            sift_results = await run_sift_predictions(
                f">seq1\n{request.aligned_query}\n>seq2\n{request.aligned_subject}",
                request.original_query,
                request.original_subject
            )
            response_data["sift"] = sift_results
        
        # Run UniProt lookup if requested
        if request.run_uniprot:
            logger.info("🔍 Running UniProt lookup...")
            uniprot_results = await lookup_uniprot_sequences([
                request.original_query,
                request.original_subject
            ])
            response_data["uniprot"] = uniprot_results
        
        return response_data
        
    except Exception as e:
        logger.error(f"❌ Post-alignment analysis failed: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
