"""NCBI Entrez client — GenBank flat-file fetch for the DNA workspace.

E-utilities is public and keyless at ≤3 req/s. If `ENTREZ_API_KEY` is set
it is appended to the upstream query — server-side only, never exposed to
the client. Accessions are pattern-validated by the route before they get
here; the response is raw GenBank text, parsed strictly in `parsers.py`.
"""
from __future__ import annotations

import httpx

from ..cache import TTLCache
from ..config import get_settings

_cache = TTLCache(ttl_s=86400, max_entries=50)


async def fetch_genbank(accession: str) -> str:
    """Fetch the `gbwithparts` flat file for a GenBank accession."""
    cached = _cache.get(accession)
    if cached is not None:
        return cached
    s = get_settings()
    params: dict[str, str] = {
        "db": "nuccore",
        "id": accession,
        "rettype": "gbwithparts",
        "retmode": "text",
    }
    if s.entrez_api_key:
        params["api_key"] = s.entrez_api_key
    async with httpx.AsyncClient(timeout=s.request_timeout_s) as client:
        resp = await client.get(f"{s.entrez_base_url}/efetch.fcgi", params=params)
        if resp.status_code >= 400:
            raise ValueError(f"No GenBank record available for {accession}.")
        text = resp.text
    # Basic sanity before caching — a 200 with a login page must not cache.
    if "LOCUS" not in text[:5000]:
        raise ValueError(f"No GenBank record available for {accession}.")
    _cache.set(accession, text)
    return text
