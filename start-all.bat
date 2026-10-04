@echo off
setlocal enabledelayedexpansion
title Protheon Launcher
echo ========================================
echo   Protheon - Starting All Services
echo ========================================
echo.

REM Get the directory where this script lives (no trailing backslash).
set "ROOT_DIR=%~dp0"
set "ROOT_DIR=%ROOT_DIR:~0,-1%"

echo [CHECK] Verifying prerequisites...
echo.

REM --- Node.js ---
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Install from: https://nodejs.org/
    goto :end
)
for /f "tokens=*" %%v in ('node -v') do echo   Node.js: %%v

REM --- npm ---
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not installed or not in PATH.
    goto :end
)
for /f "tokens=*" %%v in ('npm -v') do echo   npm: v%%v

REM --- Python / pip (backend optional but recommended) ---
set "NO_BACKEND=0"
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Python is not installed or not in PATH.
    echo   The backend API will NOT start. The workspace will run with limited features.
    echo   Install from: https://python.org/
    set "NO_BACKEND=1"
) else (
    for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo   Python: %%v
    where pip >nul 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo [WARNING] pip is not available - cannot install backend dependencies.
        set "NO_BACKEND=1"
    )
)

echo.

REM ============================================
REM Install dependencies
REM ============================================

echo [SETUP] Checking and installing dependencies...
echo.

if not exist "%ROOT_DIR%\node_modules" (
    echo   [INSTALL] Frontend dependencies ^(npm install - first run only^)...
    pushd "%ROOT_DIR%"
    call npm install
    set "NPM_ERR=!ERRORLEVEL!"
    popd
    if not "!NPM_ERR!"=="0" (
        echo   [ERROR] Failed to install frontend dependencies.
        goto :end
    )
) else (
    echo   [OK] Frontend dependencies found.
)

if "!NO_BACKEND!"=="0" (
    python -c "import fastapi, uvicorn, pydantic_settings, httpx" >nul 2>nul
    if !ERRORLEVEL! NEQ 0 (
        echo   [INSTALL] Backend Python dependencies...
        pip install -r "%ROOT_DIR%\backend\requirements.txt"
        if !ERRORLEVEL! NEQ 0 (
            echo   [WARNING] Full requirements install failed - installing core packages...
            pip install fastapi uvicorn pydantic pydantic-settings httpx
        )
    ) else (
        echo   [OK] Backend Python dependencies found.
    )
)

echo.

REM ============================================
REM Start services
REM ============================================

echo [LAUNCH] Starting all services...
echo.

REM Port checks: if a service is already listening, report it instead of
REM spawning a window that would flash open and die on the conflict.

netstat -ano | findstr /C:":8000 " | findstr LISTENING >nul 2>nul
set "PORT_8000=!ERRORLEVEL!"

netstat -ano | findstr /C:":3000 " | findstr LISTENING >nul 2>nul
set "PORT_3000=!ERRORLEVEL!"

if "!NO_BACKEND!"=="1" (
    echo   [1/2] SKIPPED - Backend API ^(Python/pip not found^).
    echo         Install Python from https://python.org/ to enable the API.
) else if "!PORT_8000!"=="0" (
    echo   [1/2] Backend already running on http://localhost:8000 - reusing it.
) else (
    echo   [1/2] Starting Backend API on http://localhost:8000...
    start "Protheon Backend" /D "%ROOT_DIR%\backend" cmd /k "python -m uvicorn app.main:app --reload --port 8000"
)

>nul ping -n 5 127.0.0.1

if "!PORT_3000!"=="0" (
    echo   [2/2] Workspace already running on http://localhost:3000 - reusing it.
    echo         ^(To restart it with a fresh build, close that window first.^)
) else (
    echo   [2/2] Starting Protheon Workspace on http://localhost:3000...
    start "Protheon Workspace" /D "%ROOT_DIR%" cmd /k "set NEXT_PUBLIC_API_BASE_URL=http://localhost:8000&& npm run dev"
)

>nul ping -n 3 127.0.0.1

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

:end
echo.
pause
endlocal
