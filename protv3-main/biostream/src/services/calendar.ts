/**
 * Calendar API service — communicates with the backend calendar router.
 * Supports both LOCAL mode (default, no Google setup needed) and
 * GOOGLE mode (real Google Calendar via OAuth2).
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

// Helper: get the current auth token for authorized requests
function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('access_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string;       // ISO datetime
  end: string;         // ISO datetime
  location: string;
  color: EventColor;
  all_day: boolean;
}

export type EventColor = 'indigo' | 'emerald' | 'blue' | 'amber' | 'purple' | 'rose';

export interface CalendarConfig {
  mode: 'local' | 'google';
  authorized: boolean;
  auth_url: string;
  calendar_id: string;
}

export interface EventsResponse {
  status: string;
  events: CalendarEvent[];
  mode: 'local' | 'google';
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function fetchCalendarConfig(): Promise<CalendarConfig> {
  const r = await fetch(`${BACKEND_URL}/calendar/config`, { headers: getAuthHeaders() });
  if (!r.ok) throw new Error(`Calendar config failed: ${r.statusText}`);
  return r.json();
}

export async function fetchAuthUrl(): Promise<{ auth_url: string; message: string }> {
  const r = await fetch(`${BACKEND_URL}/calendar/auth-url`, { headers: getAuthHeaders() });
  if (!r.ok) throw new Error(`Auth URL fetch failed: ${r.statusText}`);
  return r.json();
}

export async function fetchEvents(
  timeMin?: string,
  timeMax?: string,
  limit: number = 100,
): Promise<EventsResponse> {
  const params = new URLSearchParams();
  if (timeMin) params.set('time_min', timeMin);
  if (timeMax) params.set('time_max', timeMax);
  params.set('limit', String(limit));

  const r = await fetch(`${BACKEND_URL}/calendar/events?${params.toString()}`, { headers: getAuthHeaders() });
  if (!r.ok) throw new Error(`Fetch events failed: ${r.statusText}`);
  return r.json();
}

export async function createEvent(event: {
  title: string;
  description?: string;
  start: string;
  end?: string;
  location?: string;
  color?: EventColor;
  all_day?: boolean;
}): Promise<{ status: string; event: CalendarEvent }> {
  const r = await fetch(`${BACKEND_URL}/calendar/events`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(event),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail || 'Failed to create event');
  }
  return r.json();
}

export async function updateEvent(
  eventId: string,
  updates: Partial<Omit<CalendarEvent, 'id'>>,
): Promise<{ status: string; event: CalendarEvent }> {
  const r = await fetch(`${BACKEND_URL}/calendar/events/${eventId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail || 'Failed to update event');
  }
  return r.json();
}

export async function deleteEvent(eventId: string): Promise<{ status: string; message: string }> {
  const r = await fetch(`${BACKEND_URL}/calendar/events/${eventId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail || 'Failed to delete event');
  }
  return r.json();
}
