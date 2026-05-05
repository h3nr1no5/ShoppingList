#!/usr/bin/env bash
# prepackage hook: Inject VITE_API_URL into frontend/.env before Docker build.
# This ensures Vite bakes the correct API URL at build time.
#
# Runs after `azd provision` (during `azd up` or `azd deploy`), so
# API_APP_URL output from main.bicep is available via `azd env get-values`.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${REPO_ROOT}/frontend/.env"

# Try to get the API URL from azd environment outputs
API_URL=""
if command -v azd &> /dev/null; then
  API_URL=$(azd env get-values 2>/dev/null | grep '^API_APP_URL=' | head -1 | cut -d'=' -f2- | tr -d '"' || true)
fi

# Fallback: use existing value in .env if API_APP_URL not available (first provision)
if [ -z "${API_URL}" ] && [ -f "${ENV_FILE}" ]; then
  API_URL=$(grep '^VITE_API_URL=' "${ENV_FILE}" 2>/dev/null | head -1 | cut -d'=' -f2- || true)
fi

# If still empty, leave .env unchanged
if [ -z "${API_URL}" ]; then
  echo "⚠ VITE_API_URL not set — leaving ${ENV_FILE} unchanged"
  exit 0
fi

# Write the value to .env (create if needed)
echo "VITE_API_URL=${API_URL}" > "${ENV_FILE}"
echo "✓ Set VITE_API_URL=${API_URL} in ${ENV_FILE}"
