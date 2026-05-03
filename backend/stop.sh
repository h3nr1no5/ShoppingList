#!/bin/bash
# Stop the FastAPI backend server

cd "$(dirname "$0")"

# Find and kill the uvicorn process
PID=$(pgrep -f "uvicorn main:app" 2>/dev/null)

if [ -n "$PID" ]; then
    echo "Stopping uvicorn (PID: $PID)..."
    kill $PID
    echo "Server stopped."
else
    echo "No running server found."
fi

# Also try to kill any python processes running main.py
PYTHON_PIDS=$(pgrep -f "main:app" 2>/dev/null)
if [ -n "$PYTHON_PIDS" ]; then
    echo "Stopping Python processes..."
    kill $PYTHON_PIDS 2>/dev/null
fi

echo "Done."