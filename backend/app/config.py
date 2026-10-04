"""Protheon backend configuration.

Every secret lives here and is injected from `backend/.env` at boot time.
Nothing in this module is ever returned to the client — `/api/health`
reports only *which* integrations are configured, never key material.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── Public data services (keyless, safe URLs) ──────────────────────────
    uniprot_base_url: str = "https://rest.uniprot.org"
    ensembl_base_url: str = "https://rest.ensembl.org"
    interpro_base_url: str = "https://www.ebi.ac.uk/interpro/api"
    alphamissense_base_url: str = "https://alphamissense.hegelab.org"
    alphafold_base_url: str = "https://alphafold.ebi.ac.uk/api"
    entrez_base_url: str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    # CRISPR tool APIs — optional; the local scoring core runs without them
    # and the off-target column degrades to an honest "scan unavailable".
    chopchop_base_url: str | None = None
    crispr_p_base_url: str | None = None
    # Nextflow Tower — optional; unset runs the in-process demo simulator
    # (payloads are badged source:"demo" so it can never masquerade as compute).
    nextflow_tower_url: str | None = None
    nextflow_tower_token: str | None = None

    # ── Optional credentials (server-side only — NEVER send to the client) ──
    ensembl_api_key: str | None = None
    # NCBI E-utilities is keyless at ≤3 req/s; a key raises the limit. The
    # key is appended to upstream requests here — never exposed downstream.
    entrez_api_key: str | None = None
    anthropic_api_key: str | None = None
    pinecone_api_key: str | None = None
    pinecone_environment: str | None = None

    # ── Application behaviour ───────────────────────────────────────────────
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    ortholog_species: str = "balaenoptera_musculus,balaenoptera_acutorostrata,physeter_catodon"
    rate_limit_per_minute: int = 120
    request_timeout_s: float = 25.0
    # The legacy Ensembl REST hosts currently answer healthy requests in
    # 60–200 s (verified 2026-09-30); ortholog/ENSP/VEP calls get their own,
    # longer window. Successes are cached for 24 h so only the first call pays.
    ensembl_timeout_s: float = 120.0
    variant_timeout_s: float = 180.0
    # AlphaFold model downloads (PDB + PAE matrix) get their own window.
    alphafold_timeout_s: float = 120.0
    # Upstream PAE matrices are strictly validated: refuse before parsing
    # anything beyond this residue count, and mean-pool down to this size
    # for the client heatmap.
    pae_max_residues: int = 3000
    pae_display_size: int = 200
    trust_proxy: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def ortholog_species_list(self) -> list[str]:
        return [o.strip() for o in self.ortholog_species.split(",") if o.strip()]

    @property
    def configured_services(self) -> dict[str, bool]:
        """Which integrations are usable. Booleans only — never key values."""
        return {
            "uniprot": True,
            "ensembl": True,
            "interpro": True,
            "alphamissense": True,
            "alphafold": True,
            "vep_sift": True,
            "entrez": True,
            "agentic_llm": self.anthropic_api_key is not None,
            "vector_store": self.pinecone_api_key is not None,
            "chopchop": self.chopchop_base_url is not None,
            "crispr_p": self.crispr_p_base_url is not None,
            "nextflow_tower": bool(self.nextflow_tower_url and self.nextflow_tower_token),
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
