# bio_router.py
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from apis.Uniprot.ebi_uniprot_client import EBIProteinsClient
import os
import requests

router = APIRouter(prefix="/proteogenomics", tags=["Bioinformatics"])

# Initialize client (use env vars in production)
client = EBIProteinsClient(email=os.getenv("EBI_CONTACT_EMAIL", "dev@yourdomain.com"))

class ProteinQuery(BaseModel):
    gene_names: List[str]
    include_xml: bool = False

@router.post("/fetch-and-map")
async def fetch_and_map_proteins(query: ProteinQuery):
    try:
        all_isoforms = []
        for gene in query.gene_names:
            isoforms = client.fetch_standard(
                "/proteins", 
                params={"gene": gene, "organism": "human"},
                fmt="xml" if query.include_xml else "json"
            )
            all_isoforms.extend(isoforms)
        
        accessions = [i.get("accession") for i in all_isoforms if isinstance(i, dict)]
        coords = client.map_coordinates(accessions)
        
        return {
            "isoforms": all_isoforms,
            "genomic_coordinates": coords,
            "cc_by_40_attribution": client.get_attribution_report()
        }
    except requests.exceptions.HTTPError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)}")