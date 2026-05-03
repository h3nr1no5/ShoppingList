#!/bin/bash
# Stop the React frontend dev server

cd "$(dirname "$0")"

# Find and kill the vite/node process
PID=$(pgrep -f "vite" 2>/dev/null)

if [ -n "$PID" ]; then
    echo "Stopping Vite dev server (PID: $PID)..."
    kill $PID
    echo "Server stopped."
else
    echo "No running server found."
fi

echo "Done."