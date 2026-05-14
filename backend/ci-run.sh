#!/bin/bash
# CI startup script for backend — assumes PostgreSQL is already available
# (e.g., GitHub Actions postgres service). No Docker checks.
# Starts uvicorn directly without needing Docker.

cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

if ! python -c "import fastapi" 2>/dev/null; then
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

echo "Starting FastAPI server on http://localhost:8000"
uvicorn main:app --host 0.0.0.0 --port 8000