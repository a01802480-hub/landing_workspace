"""
Shared FastAPI dependencies (auth, rate limiting).
"""
import time
from collections import defaultdict
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .config import API_CONFIG

security = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# Rate limiter — simple token bucket per API name
# ---------------------------------------------------------------------------
_rate_state: dict[str, tuple[float, int]] = {}  # api_name -> (window_start, count)


def rate_limit(api_name: str, calls_per_second: int | None = None):
    """
    FastAPI dependency that rate-limits requests to a specific external API.
    """
    if calls_per_second is None:
        cfg = API_CONFIG.get(api_name, {})
        calls_per_second = cfg.get("rate_limit", 10)

    async def limiter(request: Request):
        now = time.time()
        window_start, count = _rate_state.get(api_name, (now, 0))

        # Reset window after 1 second
        if now - window_start > 1.0:
            window_start = now
            count = 0

        if count >= calls_per_second:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded for {api_name} ({calls_per_second} req/s). Try again shortly.",
            )

        _rate_state[api_name] = (window_start, count + 1)

    return limiter


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------
async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    """
    Optional auth — returns user dict or None if no token provided.
    Used for API routers that work both with and without auth.
    """
    if credentials is None:
        return None
    # Defer to the auth router's token validation
    from apis.auth.auth_router import get_current_user
    return await get_current_user(credentials)
