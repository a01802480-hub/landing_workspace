@echo off
setlocal enabledelayedexpansion
echo ========================================
echo   BioStream - Starting All Services
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
    echo   The backend API will NOT start. BioStream will run with limited features.
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

REM --- Landing Page (Next.js) ---
if not exist "%ROOT_DIR%\biostream_landing-master\node_modules" (
    echo   [INSTALL] Landing Page dependencies...
    cd /d "%ROOT_DIR%\biostream_landing-master"
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo   [ERROR] Failed to install Landing Page dependencies.
        pause
        exit /b 1
    )
    cd /d "%ROOT_DIR%"
) else (
    echo   [OK] Landing Page dependencies found.
)

REM --- Workspace (Vite + React) ---
if not exist "%ROOT_DIR%\protv3-main\biostream\node_modules" (
    echo   [INSTALL] Workspace dependencies...
    cd /d "%ROOT_DIR%\protv3-main\biostream"
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo   [ERROR] Failed to install Workspace dependencies.
        pause
        exit /b 1
    )
    cd /d "%ROOT_DIR%"
) else (
    echo   [OK] Workspace dependencies found.
)

REM --- Backend (Python) ---
if "!NO_BACKEND!"=="0" (
    REM Check if key dependencies are installed by trying to import them
    python -c "import fastapi, uvicorn, requests" 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo   [INSTALL] Backend Python dependencies...
        cd /d "%ROOT_DIR%\protv3-main\Biobackend"
        pip install -r requirements.txt
        if %ERRORLEVEL% NEQ 0 (
            echo   [WARNING] Some backend dependencies may have failed to install.
            echo   Trying individual installs...
            pip install fastapi uvicorn pydantic requests httpx
        )
        cd /d "%ROOT_DIR%"
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

REM --- 1. Landing Page (port 3000) ---
echo   [1/3] Starting Landing Page on http://localhost:3000...
start "BioStream Landing" cmd /k "cd /d "%ROOT_DIR%\biostream_landing-master" && echo ======================================== && echo   BioStream Landing Page && echo   URL: http://localhost:3000 && echo ======================================== && echo. && npm run dev"

REM Wait a moment for the port to begin binding
timeout /t 4 /nobreak >nul

REM --- 2. Workspace App (port 3001) ---
echo   [2/3] Starting BioStream Workspace on http://localhost:3001...
start "BioStream Workspace" cmd /k "cd /d "%ROOT_DIR%\protv3-main\biostream" && echo ======================================== && echo   BioStream Workspace && echo   URL: http://localhost:3001 && echo ======================================== && echo. && npm run dev"

timeout /t 4 /nobreak >nul

REM --- 3. Backend API (port 8000) ---
if "!NO_BACKEND!"=="1" (
    echo   [3/3] SKIPPED — Backend API (Python/pip not found).
    echo         Install Python from https://python.org/ to enable the API.
) else (
    echo   [3/3] Starting Backend API on http://localhost:8000...
    start "BioStream Backend" cmd /k "cd /d "%ROOT_DIR%\protv3-main\Biobackend" && echo ======================================== && echo   BioStream Backend API && echo   URL: http://localhost:8000 && echo   Docs: http://localhost:8000/docs && echo ======================================== && echo. && python main.py"
)

timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   All Services Started!
echo ========================================
echo.
echo   Landing Page:  http://localhost:3000
echo   BioStream App:  http://localhost:3001
if "!NO_BACKEND!"=="0" (
    echo   Backend API:   http://localhost:8000
    echo   API Docs:      http://localhost:8000/docs
)
echo.
echo   Open http://localhost:3000 in your browser to get started.
echo.
echo   TIP: To stop all services, close each terminal window,
echo        or press Ctrl+C in each window.
echo.
pause
endlocal