#!/bin/bash
# Run E2E tests locally.
# Starts PostgreSQL, ensures deps are installed, delegates to Playwright.
# Stops PostgreSQL when tests finish (pass or fail).
#
# Usage:
#   ./run-e2e.sh                          # run all E2E tests
#   ./run-e2e.sh --project=chromium       # single browser
#   ./run-e2e.sh e2e/lists.spec.ts        # single test file
#   ./run-e2e.sh --debug                  # playright debug mode
#
# Required env vars:
#   E2E_INVITE_CODE   — registration invite code (prompts if missing)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# ============================================================================
# Cleanup handler — always stop PostgreSQL on exit
# ============================================================================
cleanup() {
    echo ""
    echo "=== Cleaning up ==="
    docker compose -f "$BACKEND_DIR/docker-compose.yml" down 2>/dev/null || true
    echo "PostgreSQL stopped."
}
trap cleanup EXIT

# ============================================================================
# Prerequisite checks
# ============================================================================
echo "=== Checking prerequisites ==="

if ! command -v docker &>/dev/null; then
    echo "ERROR: docker is required but not found."
    echo "  Install: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker info &>/dev/null; then
    echo "ERROR: Docker daemon is not running."
    echo "  Start Docker Desktop or the docker service."
    exit 1
fi

if ! command -v python3 &>/dev/null; then
    echo "ERROR: python3 is required but not found."
    exit 1
fi

if ! command -v node &>/dev/null; then
    echo "ERROR: node is required but not found."
    exit 1
fi

echo "  docker  — $(docker --version)"
echo "  python3 — $(python3 --version)"
echo "  node    — $(node --version)"

# ============================================================================
# E2E invite code
# ============================================================================
if [ -z "${E2E_INVITE_CODE:-}" ]; then
    if [ -f "$BACKEND_DIR/.env" ]; then
        # shellcheck source=/dev/null
        source "$BACKEND_DIR/.env"
    fi
    if [ -n "${REGISTRATION_KEY:-}" ]; then
        E2E_INVITE_CODE="$REGISTRATION_KEY"
        echo "  E2E invite code loaded from backend/.env"
    else
        echo ""
        echo "ERROR: E2E_INVITE_CODE is not set."
        echo "  Set it as an env var or add REGISTRATION_KEY to backend/.env."
        echo "  Generate one: python3 -c \"import secrets; print(secrets.token_hex(16))\""
        exit 1
    fi
fi
export E2E_INVITE_CODE

# ============================================================================
# Ensure SECRET_KEY in backend/.env
# ============================================================================
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo ""
    echo "Creating backend/.env..."
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
fi

if grep -q "your-secret-key-here" "$BACKEND_DIR/.env" 2>/dev/null \
   || ! grep -q "^SECRET_KEY=" "$BACKEND_DIR/.env" 2>/dev/null \
   || [ -z "$(grep "^SECRET_KEY=" "$BACKEND_DIR/.env" 2>/dev/null | cut -d= -f2)" ]; then
    echo ""
    echo "Generating SECRET_KEY in backend/.env..."
    NEW_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    if grep -q "^SECRET_KEY=" "$BACKEND_DIR/.env"; then
        # Replace existing placeholder/empty key (portable sed — works on macOS and Linux)
        sed -i.bak "s|^SECRET_KEY=.*|SECRET_KEY=$NEW_KEY|" "$BACKEND_DIR/.env" && rm -f "$BACKEND_DIR/.env.bak"
    else
        echo "SECRET_KEY=$NEW_KEY" >> "$BACKEND_DIR/.env"
    fi
    echo "  SECRET_KEY generated."
fi

# ============================================================================
# Start PostgreSQL
# ============================================================================
echo ""
echo "=== Starting PostgreSQL ==="
cd "$BACKEND_DIR"
docker compose up -d

echo "Waiting for PostgreSQL to be ready..."
RETRIES=30
until docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1 || [ "$RETRIES" -eq 0 ]; do
    echo "  Waiting... ($RETRIES attempts remaining)"
    RETRIES=$((RETRIES - 1))
    sleep 2 || { echo "Interrupted."; exit 130; }
done

if [ "$RETRIES" -eq 0 ]; then
    echo "ERROR: PostgreSQL did not start in time."
    exit 1
fi
echo "  PostgreSQL ready."

# ============================================================================
# Frontend dependencies
# ============================================================================
echo ""
echo "=== Frontend dependencies ==="
cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm ci
    echo "  npm ci complete."
fi

# ============================================================================
# Playwright browsers
# ============================================================================
if ! npx playwright --version &>/dev/null; then
    echo "Installing Playwright..."
    npm ci
fi

LOCAL_BROWSERS="$FRONTEND_DIR/node_modules/@playwright/test/browsers"
if [ ! -d "$LOCAL_BROWSERS" ] \
   && [ ! -d "$HOME/.cache/ms-playwright" ] \
   && [ ! -d "$HOME/Library/Caches/ms-playwright" ]; then
    echo "Installing Playwright browsers..."
    npx playwright install --with-deps
    echo "  Playwright browsers installed."
fi

# ============================================================================
# Run tests
# ============================================================================
echo ""
echo "=== Running E2E tests ==="
echo "  Command: npx playwright test $*"
echo ""

# The playwright.config.ts manages backend + frontend via webServer,
# so we just run playwright directly.
set +e  # allow playwright exit code to propagate
npx playwright test "$@"
PLAYWRIGHT_EXIT=$?
set -e

echo ""
if [ $PLAYWRIGHT_EXIT -eq 0 ]; then
    echo "E2E tests PASSED."
else
    echo "E2E tests FAILED (exit code $PLAYWRIGHT_EXIT)."
fi

# Exit with Playwright's exit code (cleanup trap already registered)
exit $PLAYWRIGHT_EXIT
