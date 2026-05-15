@echo off
echo ========================================
echo   BioStream - Starting All Services
echo ========================================
echo.

echo [1/3] Starting Landing Page (Port 3000)...
start "BioStream Landing" cmd /k "cd biostream_landing-master && npm run dev"
timeout /t 3 /nobreak >nul

echo [2/3] Starting BioStream Workspace...
start "BioStream Workspace" cmd /k "cd protv3-main\biostream && npm run dev"
timeout /t 5 /nobreak >nul

echo [3/3] Starting Backend API (Port 8000)...
start "BioStream Backend" cmd /k "cd protv3-main\Biobackend && python main.py"
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   All Services Started!
echo ========================================
echo.
echo Landing Page:    http://localhost:3000
echo BioStream App:   Check terminal output for actual port (usually 5173 or 3002)
echo Backend API:     http://localhost:8000
echo.
echo IMPORTANT: The BioStream workspace may run on a different port if 5173 is occupied.
echo Check the "BioStream Workspace" terminal window for the actual URL.
echo.
echo Test Credentials:
echo Email:    example@gmail.com
echo Password: 1234567
echo.
echo Press any key to exit this window...
pause >nul