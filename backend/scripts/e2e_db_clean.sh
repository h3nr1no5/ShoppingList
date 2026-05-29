#!/bin/bash
# Clean the E2E test database.
#
# 1. Kills the running backend on port 8000 (if any).
# 2. Ensures PostgreSQL is running.
# 3. Drops and recreates the 'shoppinglist_e2e' database.
#
# Usage: bash backend/scripts/e2e_db_clean.sh

set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== E2E Database Cleanup ==="

# Kill existing backend if running on port 8000
E2E_PID=$(lsof -ti:8000 2>/dev/null || true)
if [ -n "$E2E_PID" ]; then
    echo "Killing existing backend on port 8000 (pid $E2E_PID)..."
    kill "$E2E_PID" 2>/dev/null || true
    sleep 2
fi

# Ensure PostgreSQL container is running
if [ "$(docker compose ps -q db 2>/dev/null)" = "" ]; then
    echo "Starting PostgreSQL container..."
    docker compose up -d
fi

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
RETRIES=30
until docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1 || [ "$RETRIES" -eq 0 ]; do
    sleep 2
    RETRIES=$((RETRIES - 1))
done

if [ "$RETRIES" -eq 0 ]; then
    echo "ERROR: PostgreSQL not ready." >&2
    exit 1
fi

echo "PostgreSQL is ready."

# Terminate connections to shoppinglist_e2e, drop and recreate it
echo "Creating clean 'shoppinglist_e2e' database..."
docker compose exec -T db psql -U postgres -c "
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE datname = 'shoppinglist_e2e' AND pid <> pg_backend_pid();
" 2>&1 || true
docker compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS shoppinglist_e2e;"
docker compose exec -T db psql -U postgres -c "CREATE DATABASE shoppinglist_e2e;"
echo "Done. Database 'shoppinglist_e2e' is ready."
