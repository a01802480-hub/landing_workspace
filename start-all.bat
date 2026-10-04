@echo off
setlocal enabledelayedexpansion
echo ========================================
echo   Protheon - Starting All Services
echo ========================================
echo.

REM Get the directory where this script lives
set "ROOT_DIR=%~dp0"
set "ROOT_DIR=%ROOT_DIR:~0,-1%"

:: ============================================
:: Check prerequisites
:: ============================================

echo [CHECK] Verifying prerequisites...
echo.

REM --- Node.js ---
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Install from: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo   Node.js: %%v

REM --- npm ---
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not installed or not in PATH.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('npm -v') do echo   npm: v%%v

REM --- Python ---
set "NO_BACKEND=0"
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Python is not installed or not in PATH.
    echo   The backend API will NOT start. The workspace will run with limited features.
    echo   Install from: https://python.org/
    set "NO_BACKEND=1"
) else (
    for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo   Python: %%v

    REM --- pip ---
    where pip >nul 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo [WARNING] pip is not available — cannot install backend dependencies.
        set "NO_BACKEND=1"
    )
)

echo.

:: ============================================
:: Install dependencies
:: ============================================

echo [SETUP] Checking and installing dependencies...
echo.

REM --- Frontend (Next.js workspace at the repo root) ---
if not exist "%ROOT_DIR%\node_modules" (
    echo   [INSTALL] Frontend dependencies (npm install — first run only)...
    cd /d "%ROOT_DIR%"
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo   [ERROR] Failed to install frontend dependencies.
        pause
        exit /b 1
    )
) else (
    echo   [OK] Frontend dependencies found.
)

REM --- Backend (FastAPI in backend/) ---
if "!NO_BACKEND!"=="0" (
    python -c "import fastapi, uvicorn, pydantic_settings, httpx" 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo   [INSTALL] Backend Python dependencies...
        pip install -r "%ROOT_DIR%\backend\requirements.txt"
        if %ERRORLEVEL% NEQ 0 (
            echo   [WARNING] Full requirements install failed — installing core packages...
            pip install fastapi uvicorn pydantic pydantic-settings httpx
        )
    ) else (
        echo   [OK] Backend Python dependencies found.
    )
)

echo.

:: ============================================
:: Start services
:: ============================================

echo [LAUNCH] Starting all services...
echo.

REM --- 1. Backend API (port 8000) — start first so the frontend can reach it ---
if "!NO_BACKEND!"=="1" (
    echo   [1/2] SKIPPED — Backend API (Python/pip not found).
    echo         Install Python from https://python.org/ to enable the API.
) else (
    echo   [1/2] Starting Backend API on http://localhost:8000...
    start "Protheon Backend" cmd /k "cd /d "%ROOT_DIR%\backend" && echo ======================================== && echo   Protheon Backend API && echo   API: http://localhost:8000/api && echo   Docs: http://localhost:8000/api/docs && echo ======================================== && echo. && python -m uvicorn app.main:app --reload --port 8000"
)

timeout /t 4 /nobreak >nul

REM --- 2. Frontend workspace (port 3000) ---
echo   [2/2] Starting Protheon Workspace on http://localhost:3000...
REM NEXT_PUBLIC_API_BASE_URL points the workspace at the backend above.
start "Protheon Workspace" cmd /k "set NEXT_PUBLIC_API_BASE_URL=http://localhost:8000&& cd /d "%ROOT_DIR%" && echo ======================================== && echo   Protheon Workspace && echo   URL: http://localhost:3000 && echo ======================================== && echo. && npm run dev"

timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   All Services Started!
echo ========================================
echo.
echo   Workspace:    http://localhost:3000
if "!NO_BACKEND!"=="0" (
    echo   Backend API:  http://localhost:8000/api
    echo   API Docs:     http://localhost:8000/api/docs
)
echo.
echo   Open http://localhost:3000 in your browser to get started.
echo.
echo   TIP: To stop all services, close each terminal window,
echo        or press Ctrl+C in each window.
echo.
pause
endlocal
