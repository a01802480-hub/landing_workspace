#!/bin/bash

echo "========================================"
echo "  BioStream - Starting All Services"
echo "========================================"
echo ""

echo "[1/3] Starting Landing Page (Port 3000)..."
cd biostream_landing-master && npm run dev &
LANDING_PID=$!
sleep 2

echo "[2/3] Starting BioStream Workspace (Port 5173)..."
cd protv3-main/biostream && npm run dev &
WORKSPACE_PID=$!
sleep 2

echo "[3/3] Starting Backend API (Port 8000)..."
cd protv3-main/Biobackend && python main.py &
BACKEND_PID=$!
sleep 1

echo ""
echo "========================================"
echo "  All Services Started!"
echo "========================================"
echo ""
echo "Landing Page:    http://localhost:3000"
echo "BioStream App:   http://localhost:5173"
echo "Backend API:     http://localhost:8000"
echo ""
echo "Test Credentials:"
echo "Email:    example@gmail.com"
echo "Password: 1234567"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for any process to exit
wait -n $LANDING_PID $WORKSPACE_PID $BACKEND_PID

# Exit with status of process that exited first
exit $?