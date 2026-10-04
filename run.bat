@echo off
setlocal
echo ========================================
echo   Protheon - Backend API
echo ========================================
echo.

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"

REM Check Python
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Install from: https://python.org/
    pause
    exit /b 1
)

REM Check / install dependencies
echo [CHECK] Verifying Python dependencies...
python -c "import fastapi, uvicorn, pydantic_settings, httpx" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [INSTALL] Installing backend dependencies...
    pip install -r "%BACKEND_DIR%\requirements.txt"
    if %ERRORLEVEL% NEQ 0 (
        echo [WARNING] Full requirements install failed — installing core packages...
        pip install fastapi uvicorn pydantic pydantic-settings httpx
    )
    echo.
)

echo [START] Launching Protheon Backend API...
echo.
echo   API:     http://localhost:8000/api
echo   Docs:    http://localhost:8000/api/docs
echo   Health:  http://localhost:8000/api/health
echo.
echo   Press Ctrl+C to stop.
echo ========================================
echo.

cd /d "%BACKEND_DIR%"
python -m uvicorn app.main:app --reload --port 8000

pause
endlocal
