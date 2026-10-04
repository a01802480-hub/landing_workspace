#!/bin/bash
# Protheon — start the backend API and the Next.js workspace together.

set -e
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================"
echo "  Protheon - Starting All Services"
echo "========================================"
echo ""

# --- Prerequisites ---
command -v node >/dev/null 2>&1 || { echo "[ERROR] Node.js is not installed or not in PATH."; exit 1; }
command -v python >/dev/null 2>&1 || echo "[WARNING] Python not found — the backend API will NOT start."

# --- Dependencies (first run only) ---
if [ ! -d "$ROOT_DIR/node_modules" ]; then
    echo "[INSTALL] Frontend dependencies (npm install — first run only)..."
    (cd "$ROOT_DIR" && npm install)
fi
if command -v python >/dev/null 2>&1; then
    python -c "import fastapi, uvicorn, pydantic_settings, httpx" 2>/dev/null \
        || { echo "[INSTALL] Backend Python dependencies..."; pip install -r "$ROOT_DIR/backend/requirements.txt"; }
fi

# --- Backend first so the frontend can reach it ---
echo ""
BACKEND_PID=""
if command -v python >/dev/null 2>&1; then
    echo "[1/2] Starting Backend API on http://localhost:8000..."
    (cd "$ROOT_DIR/backend" && python -m uvicorn app.main:app --reload --port 8000) &
    BACKEND_PID=$!
    sleep 3
else
    echo "[1/2] SKIPPED — Backend API (Python not found)."
fi

echo "[2/2] Starting Protheon Workspace on http://localhost:3000..."
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm --prefix "$ROOT_DIR" run dev &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "  All Services Started!"
echo "========================================"
echo ""
echo "Workspace:    http://localhost:3000"
if [ -n "$BACKEND_PID" ]; then
    echo "Backend API:  http://localhost:8000/api"
    echo "API Docs:     http://localhost:8000/api/docs"
fi
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for either service to exit, then stop the other.
if [ -n "$BACKEND_PID" ]; then
    wait -n "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
else
    wait "$FRONTEND_PID" 2>/dev/null || true
fi
exit 0
