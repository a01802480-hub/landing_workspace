import requests
import time

BASE_URL = "https://www.ebi.ac.uk/Tools/services/rest/clustalo"

def submit_clustalo_job(email: str, fasta_content: str):
    """Submits sequences to Clustal Omega."""
    payload = {
        'email': email,
        'sequence': fasta_content,
        'stype': 'protein', # or 'dna'
        'outfmt': 'clustal_num', # This gives nice formatted output
        'order': 'aligned'
    }
    response = requests.post(f"{BASE_URL}/run/", data=payload)
    if response.status_code == 200:
        return response.text # Returns the Job ID
    raise Exception(f"ClustalO Submission Failed: {response.text}")

def check_clustalo_status(job_id: str):
    response = requests.get(f"{BASE_URL}/status/{job_id}")
    return response.text.strip().upper()

def get_clustalo_result(job_id: str):
    # 'aln-clustal_num' is the identifier for the alignment result
    response = requests.get(f"{BASE_URL}/result/{job_id}/aln-clustal_num")
    return response.text