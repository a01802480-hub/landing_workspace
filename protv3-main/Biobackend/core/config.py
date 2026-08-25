"""
Centralized API configuration.
Base URLs, rate limits, and credentials for all external services.
"""
import os

# ---------------------------------------------------------------------------
# API endpoints and rate limits
# ---------------------------------------------------------------------------

API_CONFIG: dict[str, dict] = {
    # --- Existing APIs ---
    "alphafold": {
        "base_url": "https://alphafold.ebi.ac.uk/api",
        "rate_limit": 5,       # calls per second
        "timeout": 30,
        "category": "structure",
    },
    "blast": {
        "base_url": "https://blast.ncbi.nlm.nih.gov",
        "rate_limit": 3,
        "timeout": 60,
        "category": "search",
    },
    "clustalo": {
        "base_url": "https://www.ebi.ac.uk/Tools/services/rest/clustalo",
        "rate_limit": 5,
        "timeout": 60,
        "category": "alignment",
    },
    "ensembl": {
        "base_url": "https://rest.ensembl.org",
        "rate_limit": 15,
        "timeout": 30,
        "category": "genomics",
    },
    "geneontology": {
        "base_url": "http://api.geneontology.org/api",
        "rate_limit": 10,
        "timeout": 30,
        "category": "annotation",
    },
    "hmmer": {
        "base_url": "https://www.ebi.ac.uk/Tools/services/rest/hmmer",
        "rate_limit": 5,
        "timeout": 60,
        "category": "search",
    },
    "interpro": {
        "base_url": "https://www.ebi.ac.uk/interpro",
        "rate_limit": 10,
        "timeout": 30,
        "category": "annotation",
    },
    "jalview": {
        "base_url": "https://www.ebi.ac.uk/Tools/services/rest",
        "rate_limit": 5,
        "timeout": 30,
        "category": "alignment",
    },
    "mafft": {
        "base_url": "https://www.ebi.ac.uk/Tools/services/rest/mafft",
        "rate_limit": 5,
        "timeout": 60,
        "category": "alignment",
    },
    "muscle": {
        "base_url": "https://www.ebi.ac.uk/Tools/services/rest/muscle",
        "rate_limit": 5,
        "timeout": 60,
        "category": "alignment",
    },
    "ncbi": {
        "base_url": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
        "rate_limit": 10,
        "timeout": 30,
        "category": "search",
    },
    "pdbe": {
        "base_url": "https://www.ebi.ac.uk/pdbe/api",
        "rate_limit": 10,
        "timeout": 30,
        "category": "structure",
    },
    "reactome": {
        "base_url": "https://reactome.org/ContentService",
        "rate_limit": 10,
        "timeout": 30,
        "category": "pathway",
    },
    "sift": {
        "base_url": "https://sift.bii.a-star.edu.sg/www/",
        "rate_limit": 3,
        "timeout": 60,
        "category": "variant",
    },
    "swissmodel": {
        "base_url": "https://swissmodel.expasy.org/api",
        "rate_limit": 5,
        "timeout": 60,
        "category": "structure",
    },
    "tcoffee": {
        "base_url": "https://www.ebi.ac.uk/Tools/services/rest/tcoffee",
        "rate_limit": 5,
        "timeout": 60,
        "category": "alignment",
    },
    "uniprot": {
        "base_url": "https://rest.uniprot.org/uniprotkb",
        "rate_limit": 10,
        "timeout": 30,
        "category": "protein-data",
    },

    # --- NEW APIs (Phase 4) ---
    "kegg": {
        "base_url": "https://rest.kegg.jp",
        "rate_limit": 3,
        "timeout": 30,
        "category": "pathway",
    },
    "string": {
        "base_url": "https://string-db.org/api",
        "rate_limit": 1,
        "timeout": 30,
        "category": "pathway",
    },
    "chembl": {
        "base_url": "https://www.ebi.ac.uk/chembl/api/data",
        "rate_limit": 5,
        "timeout": 30,
        "category": "chemical",
    },
    "pubchem": {
        "base_url": "https://pubchem.ncbi.nlm.nih.gov/rest/pug",
        "rate_limit": 5,
        "timeout": 30,
        "category": "chemical",
    },
    "ena": {
        "base_url": "https://www.ebi.ac.uk/ena/portal/api",
        "rate_limit": 30,
        "timeout": 30,
        "category": "genomics",
    },
    "gwas_catalog": {
        "base_url": "https://www.ebi.ac.uk/gwas/rest",
        "rate_limit": 10,
        "timeout": 30,
        "category": "genomics",
    },
    "open_targets": {
        "base_url": "https://api.platform.opentargets.org/api/v4/graphql",
        "rate_limit": 10,
        "timeout": 30,
        "category": "target",
    },
    "europe_pmc": {
        "base_url": "https://www.ebi.ac.uk/europepmc/webservices/rest",
        "rate_limit": 10,
        "timeout": 30,
        "category": "literature",
    },
    "clinvar": {
        "base_url": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
        "rate_limit": 10,
        "timeout": 30,
        "category": "genomics",
    },
    "intact": {
        "base_url": "https://www.ebi.ac.uk/intact/rest",
        "rate_limit": 10,
        "timeout": 30,
        "category": "interaction",
    },
    "drugbank": {
        "base_url": "https://dev.drugbank.com/api/v1",
        "rate_limit": 5,
        "timeout": 30,
        "category": "chemical",
        "api_key": os.getenv("DRUGBANK_API_KEY", ""),
    },
    "expression_atlas": {
        "base_url": "https://www.ebi.ac.uk/gxa",
        "rate_limit": 10,
        "timeout": 30,
        "category": "genomics",
    },
    "pride": {
        "base_url": "https://www.ebi.ac.uk/pride/ws/archive",
        "rate_limit": 10,
        "timeout": 30,
        "category": "proteomics",
    },
    "gnomad": {
        "base_url": "https://gnomad.broadinstitute.org/api",
        "rate_limit": 10,
        "timeout": 30,
        "category": "genomics",
    },
}


def get_api_config(api_name: str) -> dict:
    """Get configuration for a specific API."""
    cfg = API_CONFIG.get(api_name)
    if not cfg:
        raise ValueError(f"Unknown API: {api_name}")
    return cfg


JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "*")
EBI_CONTACT_EMAIL: str = os.getenv("EBI_CONTACT_EMAIL", "dev@yourdomain.com")

# Cache TTL in seconds
CACHE_TTL_DEFAULT = 300          # 5 minutes
CACHE_TTL_LONG = 3600            # 1 hour
CACHE_TTL_SHORT = 60             # 1 minute
