#!/bin/bash
# Run backend tests with PostgreSQL

cd "$(dirname "$0")"

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install dependencies if needed
if ! python -c "import pytest" 2>/dev/null; then
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

# Check if PostgreSQL is running
if [ "$(docker compose ps -q db 2>/dev/null)" = "" ]; then
    echo "Starting PostgreSQL container..."
    docker compose up -d

    # Wait for PostgreSQL to be ready
    echo "Waiting for PostgreSQL..."
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
fi

# Run tests
echo "Running tests..."
pytest -v "$@"