"""
Google Calendar API router — calendar events and OAuth2 integration.

Supports two modes:
  - GOOGLE_CALENDAR mode: Uses real Google Calendar API via OAuth2 credentials
  - LOCAL mode (default): Stores events in a local JSON file for development

Environment variables:
  - GOOGLE_CALENDAR_CREDENTIALS: Path to Google OAuth2 client secret JSON file
  - GOOGLE_CALENDAR_TOKEN: Path to stored OAuth2 token (default: calendar_token.json)
  - CALENDAR_MODE: "google" or "local" (default: local)
"""
from __future__ import annotations

import json
import os
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel

# Auth dependency — calendar events are user-private
from apis.auth.auth_router import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calendar", tags=["Google Calendar"])

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
CALENDAR_MODE = os.getenv("CALENDAR_MODE", "local")
GOOGLE_CREDENTIALS_PATH = os.getenv("GOOGLE_CALENDAR_CREDENTIALS", "")
GOOGLE_TOKEN_PATH = os.getenv("GOOGLE_CALENDAR_TOKEN", "calendar_token.json")

# Local event store (file-based JSON for LOCAL mode)
EVENTS_STORE: Path = Path(__file__).parent / "calendar_events.json"

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class CalendarEvent(BaseModel):
    id: str
    title: str
    description: str = ""
    start: str          # ISO datetime string
    end: str            # ISO datetime string
    location: str = ""
    color: str = "indigo"
    all_day: bool = False


class CreateEventRequest(BaseModel):
    title: str
    description: str = ""
    start: str          # ISO datetime or date string
    end: str = ""       # Optional — defaults to start + 1 hour
    location: str = ""
    color: str = "indigo"
    all_day: bool = False


class UpdateEventRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    start: str | None = None
    end: str | None = None
    location: str | None = None
    color: str | None = None
    all_day: bool | None = None


class OAuthConfig(BaseModel):
    """OAuth configuration info returned to the frontend."""
    mode: str
    authorized: bool
    auth_url: str = ""
    calendar_id: str = ""


# ---------------------------------------------------------------------------
# Helpers — Local event store
# ---------------------------------------------------------------------------
def _load_local_events() -> list[dict]:
    if not EVENTS_STORE.exists():
        return _seed_events()
    try:
        data = json.loads(EVENTS_STORE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return _seed_events()


def _save_local_events(events: list[dict]) -> None:
    EVENTS_STORE.write_text(json.dumps(events, indent=2, default=str), encoding="utf-8")


def _seed_events() -> list[dict]:
    """Seed initial demo events so the calendar isn't empty."""
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    next_week = (now + timedelta(days=7)).strftime("%Y-%m-%d")

    events = [
        {
            "id": "evt_001",
            "title": "Sequence alignment review",
            "description": "Review Clustal Omega results for the hemoglobin project",
            "start": f"{today}T10:00:00",
            "end": f"{today}T11:00:00",
            "location": "Lab Meeting Room",
            "color": "indigo",
            "all_day": False,
        },
        {
            "id": "evt_002",
            "title": "UniProt database search",
            "description": "Search for homologous sequences using BLAST",
            "start": f"{today}T14:00:00",
            "end": f"{today}T15:30:00",
            "location": "",
            "color": "emerald",
            "all_day": False,
        },
        {
            "id": "evt_003",
            "title": "BLAST query batch run",
            "description": "Run batch BLAST queries for 50 sequences",
            "start": f"{(now + timedelta(days=1)).strftime('%Y-%m-%d')}T09:00:00",
            "end": f"{(now + timedelta(days=1)).strftime('%Y-%m-%d')}T12:00:00",
            "location": "",
            "color": "blue",
            "all_day": False,
        },
        {
            "id": "evt_004",
            "title": "Protein structure analysis",
            "description": "Analyze AlphaFold predictions for target proteins",
            "start": f"{(now + timedelta(days=2)).strftime('%Y-%m-%d')}T14:00:00",
            "end": f"{(now + timedelta(days=2)).strftime('%Y-%m-%d')}T16:00:00",
            "location": "Bioinformatics Lab",
            "color": "amber",
            "all_day": False,
        },
        {
            "id": "evt_005",
            "title": "Weekly lab meeting",
            "description": "Present GWAS results and discuss next steps",
            "start": f"{(now + timedelta(days=3)).strftime('%Y-%m-%d')}T11:00:00",
            "end": f"{(now + timedelta(days=3)).strftime('%Y-%m-%d')}T12:00:00",
            "location": "Conference Room A",
            "color": "purple",
            "all_day": False,
        },
        {
            "id": "evt_006",
            "title": "GWAS results review",
            "description": "Review genome-wide association study findings",
            "start": f"{(now + timedelta(days=5)).strftime('%Y-%m-%d')}T15:30:00",
            "end": f"{(now + timedelta(days=5)).strftime('%Y-%m-%d')}T17:00:00",
            "location": "",
            "color": "rose",
            "all_day": False,
        },
    ]
    _save_local_events(events)
    return events


# ---------------------------------------------------------------------------
# Google Calendar helpers
# ---------------------------------------------------------------------------
def _get_google_service():
    """Build and return a Google Calendar API service instance."""
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build

        SCOPES = ["https://www.googleapis.com/auth/calendar.readonly",
                   "https://www.googleapis.com/auth/calendar.events"]

        creds: Credentials | None = None

        # Load token if it exists
        token_path = Path(GOOGLE_TOKEN_PATH)
        if token_path.exists():
            creds = Credentials.from_authorized_user_file(
                str(token_path), SCOPES
            )

        # Refresh or re-auth if needed
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not GOOGLE_CREDENTIALS_PATH:
                    raise HTTPException(
                        status_code=401,
                        detail="Google Calendar credentials not configured. "
                               "Set GOOGLE_CALENDAR_CREDENTIALS env var or use CALENDAR_MODE=local.",
                    )
                flow = InstalledAppFlow.from_client_secrets_file(
                    GOOGLE_CREDENTIALS_PATH, SCOPES
                )
                creds = flow.run_local_server(port=0)

            # Save token for next time
            token_path.write_text(creds.to_json(), encoding="utf-8")

        return build("calendar", "v3", credentials=creds)

    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Google Calendar libraries not installed: {e}. "
                   "Run: pip install google-api-python-client google-auth-oauthlib",
        )


def _google_event_to_dict(event: dict) -> dict:
    """Convert a Google Calendar event to our standard dict format."""
    start_info = event.get("start", {})
    end_info = event.get("end", {})

    # Determine if all-day event (date-only fields)
    all_day = "date" in start_info

    start_str = start_info.get("dateTime", start_info.get("date", ""))
    end_str = end_info.get("dateTime", end_info.get("date", ""))

    # Map Google's colorId to our color names
    color_map = {
        "1": "indigo", "2": "emerald", "3": "purple",
        "4": "rose", "5": "amber", "6": "blue",
        "7": "indigo", "8": "emerald", "9": "purple",
        "10": "rose", "11": "amber",
    }
    color_id = event.get("colorId", "1")

    return {
        "id": event.get("id", ""),
        "title": event.get("summary", "Untitled"),
        "description": event.get("description", ""),
        "start": start_str,
        "end": end_str,
        "location": event.get("location", ""),
        "color": color_map.get(color_id, "indigo"),
        "all_day": all_day,
    }


# ---------------------------------------------------------------------------
# Endpoints — Configuration / OAuth
# ---------------------------------------------------------------------------
@router.get("/config", response_model=OAuthConfig)
async def get_config(current_user: dict = Depends(get_current_user)):
    """Return the current calendar configuration and auth status."""
    config = OAuthConfig(mode=CALENDAR_MODE, authorized=False)

    if CALENDAR_MODE == "google":
        try:
            service = _get_google_service()
            config.authorized = True
            # Get primary calendar ID
            calendar_list = service.calendarList().list().execute()
            primary = next(
                (c for c in calendar_list.get("items", []) if c.get("primary")),
                None,
            )
            config.calendar_id = primary.get("id", "primary") if primary else "primary"
        except HTTPException:
            config.authorized = False
        except Exception:
            config.authorized = False
    else:
        config.authorized = True
        config.calendar_id = "local"

    return config


@router.get("/auth-url")
async def get_auth_url(current_user: dict = Depends(get_current_user)):
    """Get the Google OAuth2 authorization URL for manual auth."""
    if CALENDAR_MODE != "google":
        return {"auth_url": "", "message": "Not in Google mode. Set CALENDAR_MODE=google."}

    try:
        from google_auth_oauthlib.flow import InstalledAppFlow

        SCOPES = ["https://www.googleapis.com/auth/calendar.readonly",
                   "https://www.googleapis.com/auth/calendar.events"]

        if not GOOGLE_CREDENTIALS_PATH:
            raise HTTPException(
                status_code=400,
                detail="Set GOOGLE_CALENDAR_CREDENTIALS to the path of your OAuth client secret JSON file.",
            )

        flow = InstalledAppFlow.from_client_secrets_file(
            GOOGLE_CREDENTIALS_PATH, SCOPES
        )
        auth_url, _ = flow.authorization_url(
            access_type="offline",
            prompt="consent",
            include_granted_scopes="true",
        )
        return {"auth_url": auth_url, "message": "Open this URL to authorize."}

    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="Need google-auth-oauthlib. Run: pip install google-auth-oauthlib",
        )


# ---------------------------------------------------------------------------
# Endpoints — Events
# ---------------------------------------------------------------------------
@router.get("/events")
async def list_events(
    time_min: str = Query(None, description="Start of time range (ISO format)"),
    time_max: str = Query(None, description="End of time range (ISO format)"),
    limit: int = Query(100, ge=1, le=2500),
    current_user: dict = Depends(get_current_user),
):
    """
    List calendar events in a time range.

    Query examples:
      - time_min=2026-06-01T00:00:00&time_max=2026-07-01T00:00:00  (June events)
      - No params → returns upcoming events from now
    """
    if CALENDAR_MODE == "google":
        try:
            service = _get_google_service()
            now = datetime.now(timezone.utc)

            t_min = time_min or now.isoformat()
            t_max = time_max or (now + timedelta(days=30)).isoformat()

            events_result = (
                service.events()
                .list(
                    calendarId="primary",
                    timeMin=t_min,
                    timeMax=t_max,
                    maxResults=limit,
                    singleEvents=True,
                    orderBy="startTime",
                )
                .execute()
            )
            items = events_result.get("items", [])
            events = [_google_event_to_dict(e) for e in items]
            return {"status": "success", "events": events, "mode": "google"}

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Google Calendar error: {e}")
            raise HTTPException(status_code=502, detail=f"Google Calendar API error: {str(e)}")

    # LOCAL mode
    events = _load_local_events()

    # Filter by time range if provided
    if time_min:
        events = [e for e in events if e.get("start", "") >= time_min]
    if time_max:
        events = [e for e in events if e.get("start", "") <= time_max]

    # Default: return upcoming events
    if not time_min and not time_max:
        now_str = datetime.now(timezone.utc).isoformat()
        events = [e for e in events if e.get("start", "") >= now_str[:19]]

    events.sort(key=lambda e: e.get("start", ""))
    return {"status": "success", "events": events[:limit], "mode": "local"}


@router.post("/events", status_code=201)
async def create_event(body: CreateEventRequest, current_user: dict = Depends(get_current_user)):
    """Create a new calendar event."""
    import uuid

    event_id = f"evt_{uuid.uuid4().hex[:12]}"

    # Parse start/end
    start = body.start
    if body.end:
        end = body.end
    else:
        # Default: start + 1 hour
        try:
            start_dt = datetime.fromisoformat(start)
            end = (start_dt + timedelta(hours=1)).isoformat()
        except ValueError:
            end = start

    new_event = {
        "id": event_id,
        "title": body.title,
        "description": body.description,
        "start": start,
        "end": end,
        "location": body.location,
        "color": body.color,
        "all_day": body.all_day,
    }

    if CALENDAR_MODE == "google":
        try:
            service = _get_google_service()

            # Build Google Calendar event body
            google_event = {
                "summary": body.title,
                "description": body.description,
                "location": body.location,
            }
            if body.all_day:
                # Parse date only
                date_str = start[:10] if "T" in start else start
                google_event["start"] = {"date": date_str}
                google_event["end"] = {"date": (datetime.fromisoformat(date_str) + timedelta(days=1)).strftime("%Y-%m-%d")}
            else:
                google_event["start"] = {"dateTime": start, "timeZone": "UTC"}
                google_event["end"] = {"dateTime": end, "timeZone": "UTC"}

            created = (
                service.events()
                .insert(calendarId="primary", body=google_event)
                .execute()
            )
            new_event = _google_event_to_dict(created)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Google Calendar error: {str(e)}")
    else:
        events = _load_local_events()
        events.append(new_event)
        _save_local_events(events)

    return {"status": "success", "event": new_event}


@router.put("/events/{event_id}")
async def update_event(event_id: str, body: UpdateEventRequest, current_user: dict = Depends(get_current_user)):
    """Update an existing calendar event."""
    if CALENDAR_MODE == "google":
        try:
            service = _get_google_service()
            existing = service.events().get(calendarId="primary", eventId=event_id).execute()

            updates = {}
            if body.title is not None:
                updates["summary"] = body.title
            if body.description is not None:
                updates["description"] = body.description
            if body.location is not None:
                updates["location"] = body.location

            if body.start is not None or body.end is not None:
                if body.all_day or existing.get("start", {}).get("date"):
                    if body.start:
                        updates["start"] = {"date": body.start[:10]}
                    if body.end:
                        updates["end"] = {"date": body.end[:10]}
                else:
                    if body.start:
                        updates["start"] = {"dateTime": body.start, "timeZone": "UTC"}
                    if body.end:
                        updates["end"] = {"dateTime": body.end, "timeZone": "UTC"}

            existing.update(updates)
            updated = service.events().update(
                calendarId="primary", eventId=event_id, body=existing
            ).execute()
            return {"status": "success", "event": _google_event_to_dict(updated)}

        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Google Calendar error: {str(e)}")

    # LOCAL mode
    events = _load_local_events()
    for i, evt in enumerate(events):
        if evt.get("id") == event_id:
            if body.title is not None:
                evt["title"] = body.title
            if body.description is not None:
                evt["description"] = body.description
            if body.start is not None:
                evt["start"] = body.start
            if body.end is not None:
                evt["end"] = body.end
            if body.location is not None:
                evt["location"] = body.location
            if body.color is not None:
                evt["color"] = body.color
            if body.all_day is not None:
                evt["all_day"] = body.all_day
            _save_local_events(events)
            return {"status": "success", "event": evt}

    raise HTTPException(status_code=404, detail=f"Event {event_id} not found")


@router.delete("/events/{event_id}", status_code=200)
async def delete_event(event_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a calendar event."""
    if CALENDAR_MODE == "google":
        try:
            service = _get_google_service()
            service.events().delete(calendarId="primary", eventId=event_id).execute()
            return {"status": "success", "message": f"Event {event_id} deleted"}
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Google Calendar error: {str(e)}")

    # LOCAL mode
    events = _load_local_events()
    new_events = [e for e in events if e.get("id") != event_id]
    if len(new_events) == len(events):
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    _save_local_events(new_events)
    return {"status": "success", "message": f"Event {event_id} deleted"}


@router.get("/discover")
async def discover(current_user: dict = Depends(get_current_user)):
    """List available calendar endpoints."""
    return {
        "status": "success",
        "api": "Google Calendar",
        "prefix": "/calendar",
        "mode": CALENDAR_MODE,
        "endpoints": [
            {"path": "/config", "method": "GET", "description": "Get calendar config and OAuth status"},
            {"path": "/auth-url", "method": "GET", "description": "Get Google OAuth2 authorization URL"},
            {"path": "/events", "method": "GET", "description": "List events (optional time_min, time_max query params)", "query_hint": "time_min: 2026-06-01T00:00:00 | time_max: 2026-07-01T00:00:00"},
            {"path": "/events", "method": "POST", "description": "Create a new event", "query_hint": "Send JSON body with title, start, end, color, description"},
            {"path": "/events/{event_id}", "method": "PUT", "description": "Update an existing event", "query_hint": "event_id: event UUID | Send JSON body with fields to update"},
            {"path": "/events/{event_id}", "method": "DELETE", "description": "Delete an event", "query_hint": "event_id: event UUID to delete"},
        ],
    }
