@echo off
setlocal enabledelayedexpansion
title SSC CGL Platform Launcher

echo =====================================================================
echo    SSC CGL Local-First Mock Test ^& Analytics Platform
echo =====================================================================
echo.

:: 1. Verify Python virtual environment
if exist .venv\Scripts\python.exe (
    set "PYTHON_EXE=.venv\Scripts\python.exe"
) else (
    set "PYTHON_EXE=python"
)

:: 2. Detect Local LAN IPv4 Address via Python
for /f "delims=" %%I in ('"%PYTHON_EXE%" -c "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); (s.connect(('8.8.8.8', 1)), print(s.getsockname()[0]), s.close()) if True else None" 2^>nul') do (
    set "LAN_IP=%%I"
)

if "%LAN_IP%"=="" (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" 2^>nul') do (
        if not defined LAN_IP (
            for /f "tokens=1" %%b in ("%%a") do set "LAN_IP=%%b"
        )
    )
)

if "%LAN_IP%"=="" set "LAN_IP=localhost"

echo ---------------------------------------------------------------------
echo  Local Host URL:    http://localhost:5173
echo  Tablet LAN Access: http://%LAN_IP%:5173
echo  FastAPI Docs:      http://%LAN_IP%:8000/docs
echo ---------------------------------------------------------------------
echo.
echo  Connect your iPad / Android tablet to the SAME Wi-Fi network and
echo  open:  http://%LAN_IP%:5173
echo.
echo =====================================================================
echo  Starting Backend (FastAPI on 0.0.0.0:8000)...
echo  Starting Frontend (Vite on 0.0.0.0:5173)...
echo =====================================================================
echo.

:: Launch backend in a separate titled window
start "SSC CGL Backend [Port 8000]" cmd /k "%PYTHON_EXE% -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"

:: Launch frontend in current window or separate window
start "SSC CGL Frontend [Port 5173]" cmd /k "npm --prefix frontend run dev -- --host 0.0.0.0"

echo Servers are running in dedicated background windows.
echo To checkpoint and commit to Git after testing:
echo   1. Click 'Flush & Lock DB for Git' in the top navigation bar.
echo   2. Run: git add . ^&^& git commit -m "Exam session completed"
echo.
pause
