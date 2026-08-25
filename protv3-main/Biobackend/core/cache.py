"""
Simple in-memory TTL cache for API responses.
"""
import time
import hashlib
import json
from typing import Any


_cache: dict[str, tuple[float, Any]] = {}  # key -> (expires_at, value)


def _make_key(prefix: str, **kwargs) -> str:
    """Create a deterministic cache key from a prefix and kwargs."""
    raw = json.dumps(kwargs, sort_keys=True, default=str)
    digest = hashlib.md5(raw.encode()).hexdigest()
    return f"{prefix}:{digest}"


def get_cached(key: str) -> Any | None:
    """Retrieve a cached value if not expired."""
    entry = _cache.get(key)
    if entry is None:
        return None
    expires_at, value = entry
    if time.time() > expires_at:
        del _cache[key]
        return None
    return value


def set_cache(key: str, value: Any, ttl: int = 300):
    """Store a value in the cache with TTL in seconds."""
    _cache[key] = (time.time() + ttl, value)


def cache_result(prefix: str, ttl: int = 300):
    """Decorator for caching async function results."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Build cache key from function args
            cache_key = _make_key(prefix, args=args, kwargs=kwargs)
            cached = get_cached(cache_key)
            if cached is not None:
                return cached
            result = await func(*args, **kwargs)
            set_cache(cache_key, result, ttl)
            return result
        return wrapper
    return decorator


def clear_cache(prefix: str | None = None):
    """Clear all or prefix-matched cache entries."""
    global _cache
    if prefix is None:
        _cache.clear()
    else:
        keys_to_remove = [k for k in _cache if k.startswith(prefix)]
        for k in keys_to_remove:
            del _cache[k]


def cache_stats() -> dict:
    """Return cache statistics for monitoring."""
    now = time.time()
    total = len(_cache)
    expired = sum(1 for _, (expires, _) in _cache.items() if now > expires)
    return {"total_entries": total, "expired_entries": expired, "active_entries": total - expired}
