#!/bin/bash
# Run the FastAPI backend server

cd "$(dirname "$0")"

# Handle stop command
if [ "$1" = "stop" ]; then
    echo "Stopping PostgreSQL container..."
    docker compose down
    exit 0
fi

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install dependencies if needed
if ! python -c "import fastapi" 2>/dev/null; then
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Creating .env from template..."
    cp .env.example .env
    echo "Please edit .env and add your SECRET_KEY"
fi

# Start PostgreSQL container if not running
if [ "$(docker compose ps -q db 2>/dev/null)" = "" ]; then
    echo "Starting PostgreSQL container..."
    docker compose up -d
fi

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
RETRIES=30
until docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
    echo "Waiting for PostgreSQL... ($RETRIES attempts remaining)"
    RETRIES=$((RETRIES - 1))
    sleep 2
done

if [ $RETRIES -eq 0 ]; then
    echo "ERROR: PostgreSQL did not start in time."
    exit 1
fi

echo "PostgreSQL is ready."

# Run the server
echo "Starting FastAPI server on http://localhost:8000"
uvicorn main:app --reload --host 0.0.0.0 --port 8000