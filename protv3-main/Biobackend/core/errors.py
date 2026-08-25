"""
Standardized error responses and base router utilities.
"""
from fastapi import APIRouter, HTTPException
from .config import get_api_config
from .http_client import api_get
from .cache import get_cached, set_cache

# Cache TTL constant
CACHE_TTL = 300


def create_api_router(api_name: str, prefix: str, tags: list[str]) -> APIRouter:
    """Create a standardized APIRouter for a bioinformatics API proxy."""
    return APIRouter(prefix=prefix, tags=tags)


def make_discover_response(api_name: str, endpoints: list[dict], description: str = "", query_hint: str = "") -> dict:
    """
    Standard discover endpoint response.

    Args:
        api_name: Display name of the API
        endpoints: List of endpoint dicts with keys: path, method, description, and optionally query_hint
        description: Human-readable description of what the API does
        query_hint: Hint for what users should put in the query
    """
    cfg = get_api_config(api_name)
    return {
        "status": "success",
        "api": api_name,
        "base_url": cfg["base_url"],
        "category": cfg.get("category", "unknown"),
        "description": description,
        "query_hint": query_hint,
        "endpoints": endpoints,
        "rate_limit": cfg.get("rate_limit", "unknown"),
    }


async def cached_api_call(api_name: str, url: str, params: dict | None = None, ttl: int = CACHE_TTL) -> dict:
    """Make a cached GET call to an external API and return standardized response."""
    cache_key = f"{api_name}:{url}:{str(params)}"

    # Check cache
    from hashlib import md5
    key_hash = md5(cache_key.encode()).hexdigest()
    cached = get_cached(key_hash)
    if cached is not None:
        return {"status": "success", "api": api_name, "data": cached, "cached": True}

    try:
        response = await api_get(url, params=params, timeout=get_api_config(api_name).get("timeout", 30))
        data = response.json()
        set_cache(key_hash, data, ttl)
        return {"status": "success", "api": api_name, "data": data}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"{api_name} API error: {str(e)}")
