#!/usr/bin/env bash
# =====================================================================
# SSC CGL Local-First Mock Test & Analytics Platform — Launcher
# =====================================================================

set -e

# Detect Python
if [ -f ".venv/bin/python" ]; then
    PYTHON_EXE=".venv/bin/python"
elif [ -f ".venv/Scripts/python.exe" ]; then
    PYTHON_EXE=".venv/Scripts/python.exe"
else
    PYTHON_EXE="python3"
fi

# Detect LAN IPv4
LAN_IP=$($PYTHON_EXE -c "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('8.8.8.8', 1)); print(s.getsockname()[0]); s.close()" 2>/dev/null || echo "localhost")

echo "====================================================================="
echo "   SSC CGL Local-First Mock Test & Analytics Platform"
echo "====================================================================="
echo "  Local Host URL:    http://localhost:5173"
echo "  Tablet LAN Access: http://${LAN_IP}:5173"
echo "  FastAPI Docs:      http://${LAN_IP}:8000/docs"
echo "====================================================================="
echo " Connect your iPad / Android tablet to the SAME Wi-Fi network and"
echo " open: http://${LAN_IP}:5173"
echo "====================================================================="
echo ""

# Trap to kill both processes on Ctrl+C
cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
    wait "$FRONTEND_PID" 2>/dev/null || true
    echo "All processes stopped cleanly."
    exit 0
}
trap cleanup SIGINT SIGTERM

echo "Starting Backend (uvicorn backend.main:app on 0.0.0.0:8000)..."
$PYTHON_EXE -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "Starting Frontend (Vite on 0.0.0.0:5173)..."
(cd frontend && npm run dev -- --host 0.0.0.0) &
FRONTEND_PID=$!

echo "Servers running. Press Ctrl+C to stop all servers."
wait
