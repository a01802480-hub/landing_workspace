/**
 * api.ts — CSRF-aware fetch client + Zod-gated fetch helper.
 *
 * Contract with the FastAPI backend:
 * - Every path is prefixed with `/api` (the backend mounts routers there).
 * - CSRF double-submit: the backend sets a `protheon_csrf` cookie on safe
 *   responses; state-changing requests must echo it in `X-CSRF-Token`.
 * - `apiValidated` parses JSON, runs it through a Zod schema and returns
 *   the validated data — a malformed payload becomes a thrown Error with
 *   a safe message, never an unvalidated object in a panel.
 */
import type { z } from "zod";

const CSRF_COOKIE = "protheon_csrf";
const CSRF_HEADER = "X-CSRF-Token";

export interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** Object → JSON, FormData/string → sent as-is. */
  body?: unknown;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/**
 * Base URL for the FastAPI backend. Defaults to the local dev backend so a
 * plain `npm run dev` reaches the API with no env setup; production builds
 * set NEXT_PUBLIC_API_BASE_URL at build time (start-all.bat sets it too).
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");

function readCsrfToken(): string {
  try {
    const match = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${CSRF_COOKIE}=`));
    return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : "";
  } catch {
    return "";
  }
}

/** Raw fetch against the FastAPI backend. Throws Error with a safe message. */
export async function apiRaw<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, timeoutMs = 30_000, headers = {} } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const init: RequestInit = {
    method,
    headers: { Accept: "application/json", ...headers },
    signal: controller.signal,
    // The backend is a different origin (localhost:8000 vs :3000) — without
    // credentials the CSRF cookie is neither planted by GETs nor echoed by
    // POSTs, and every state-changing call dies with a 403. SameSite=Lax is
    // fine here: both origins are the same site (localhost).
    credentials: "include",
  };

  // CSRF double-submit for state-changing requests.
  if (method !== "GET") {
    const token = readCsrfToken();
    if (token) (init.headers as Record<string, string>)[CSRF_HEADER] = token;
  }

  if (body instanceof FormData) {
    // Never set Content-Type manually for FormData — the browser adds the
    // multipart boundary.
    init.body = body;
  } else if (typeof body === "string") {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = body;
  } else if (body !== undefined) {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, init);
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(`The API did not answer within ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw new Error("The API is unreachable — is the backend running?");
  }
  clearTimeout(timer);

  if (!res.ok) {
    // Fail-closed: the backend's 422/error payload carries a safe `detail`.
    let detail = `${res.status} ${res.statusText}`;
    try {
      const data = (await res.json()) as { detail?: unknown };
      if (typeof data.detail === "string") detail = data.detail;
    } catch {
      /* non-JSON error body — keep the status text */
    }
    throw new Error(detail);
  }
  // JSON endpoints (everything FastAPI returns by default) parse as JSON;
  // raw-file endpoints (`/structure/*/file` → text/plain PDB) must come
  // back verbatim — `res.json()` on PDB text is the classic
  // "Unexpected token 'H'" failure.
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  return (await res.text()) as T;
}

/** Fetch + Zod-validate in one call. The schema is the render gate. */
export async function apiValidated<T>(
  path: string,
  schema: z.ZodType<T>,
  opts: ApiOptions = {},
): Promise<T> {
  const raw = await apiRaw<unknown>(path, opts);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `The API returned an unexpected payload for ${path} (${parsed.error.issues
        .slice(0, 3)
        .map((i) => i.path.join("."))
        .join(", ") || "shape mismatch"}).`,
    );
  }
  return parsed.data;
}
