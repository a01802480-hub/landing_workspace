@echo off
setlocal
echo ========================================
echo   BioStream - Backend API
echo ========================================
echo.

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%protv3-main\Biobackend"

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
cd /d "%BACKEND_DIR%"
python -c "import fastapi, uvicorn, requests" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [INSTALL] Installing backend dependencies...
    pip install -r requirements.txt
    if %ERRORLEVEL% NEQ 0 (
        echo [WARNING] Full requirements install failed — installing core packages...
        pip install fastapi uvicorn pydantic requests httpx
    )
    echo.
)

echo [START] Launching BioStream Backend API...
echo.
echo   API:     http://localhost:8000
echo   Docs:    http://localhost:8000/docs
echo   Health:  http://localhost:8000/
echo.
echo   Press Ctrl+C to stop.
echo ========================================
echo.

python main.py

pause
endlocal