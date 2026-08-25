"""
Async HTTP client with retry, timeout, and user-agent headers.
Uses httpx for non-blocking I/O in FastAPI async handlers.
"""
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from .config import EBI_CONTACT_EMAIL

# Global client instance (lazily initialized per-request for connection pooling)
_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    """Get or create the shared httpx AsyncClient."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0),
            headers={
                "User-Agent": f"BioStream/3.0 ({EBI_CONTACT_EMAIL})",
                "Accept": "application/json",
            },
            follow_redirects=True,
        )
    return _client


async def close_client():
    """Close the shared client (call on app shutdown)."""
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.ConnectError, httpx.TimeoutException)),
    reraise=True,
)
async def api_get(url: str, params: dict | None = None, headers: dict | None = None, timeout: float = 30.0) -> httpx.Response:
    """GET request with retry logic."""
    client = get_client()
    merged_headers = {**client.headers, **(headers or {})}
    response = await client.get(url, params=params, headers=merged_headers, timeout=timeout)
    response.raise_for_status()
    return response


@retry(
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=1, max=5),
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.ConnectError)),
    reraise=True,
)
async def api_post(url: str, data: dict | None = None, json: dict | None = None, headers: dict | None = None, timeout: float = 60.0) -> httpx.Response:
    """POST request with retry logic."""
    client = get_client()
    merged_headers = {**client.headers, **(headers or {})}
    response = await client.post(url, data=data, json=json, headers=merged_headers, timeout=timeout)
    response.raise_for_status()
    return response
