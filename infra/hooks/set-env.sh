#!/usr/bin/env bash
# set-env.sh — Predeploy hook: syncs backend/.env secrets → Azure Key Vault
#
# Reads SECRET_KEY and REGISTRATION_KEY from backend/.env and updates the
# corresponding Key Vault secrets so the Bicep template always deploys with
# the latest values.
#
# Creates the Key Vault if it doesn't exist (run standalone for first-time setup).
#
# Usage:
#   ./set-env.sh [key-vault-name]
#
# One-time setup (first use):
#   1. Run this script to create the Key Vault:
#        ./infra/hooks/set-env.sh
#   2. Grant the API container app's managed identity read access:
#        az keyvault set-policy --name shoppinglist-kv \
#          --object-id "$(az containerapp show -n shoppinglist-api -g <rg> --query identity.principalId -o tsv)" \
#          --secret-permissions get
#   3. If deploying via CI/CD, grant the OIDC principal the same permission.
#      The Key Vault name is passed to Bicep via AZD_DEPLOY_PARAM_KEY_VAULT_NAME
#      in .github/workflows/deploy.yml.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${REPO_ROOT}/backend/.env"
KEY_VAULT_NAME="${1:-shoppinglist-kv}"

echo ""
echo "=== Predeploy: sync .env → Key Vault '${KEY_VAULT_NAME}' ==="

# --- Check prerequisites ---

if ! az account show &>/dev/null; then
  echo "⚠  Not logged in to Azure — run 'az login' first"
  echo "   (skipping KV sync, deployment may fail if secrets are missing)"
  exit 0
fi

if [ ! -f "${ENV_FILE}" ]; then
  echo "⚠  backend/.env not found at ${ENV_FILE}"
  echo "   (skipping KV sync, deployment may fail if secrets are missing)"
  exit 0
fi

# --- Source backend/.env ---

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}" 2>/dev/null || {
  echo "⚠  Could not source backend/.env — skipping KV sync"
  exit 0
}
set +a

# --- Resolve resource group ---

RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-}"
if [ -z "${RESOURCE_GROUP}" ]; then
  RESOURCE_GROUP="$(azd env get-values 2>/dev/null \
    | grep '^AZURE_RESOURCE_GROUP=' \
    | cut -d= -f2- || true)"
fi
if [ -z "${RESOURCE_GROUP}" ]; then
  RESOURCE_GROUP="$(az group list --query '[0].name' -o tsv 2>/dev/null || true)"
fi

# --- Create Key Vault if it doesn't exist ---

if ! az keyvault show --name "${KEY_VAULT_NAME}" &>/dev/null; then
  if [ -z "${RESOURCE_GROUP}" ]; then
    echo "⚠  No resource group found — cannot create Key Vault"
    echo "   Set AZURE_RESOURCE_GROUP or run 'azd provision' first"
    echo "   Then run this script again before 'azd deploy'"
    exit 0
  fi
  echo "Creating Key Vault '${KEY_VAULT_NAME}' in resource group '${RESOURCE_GROUP}'..."
  az keyvault create \
    --name "${KEY_VAULT_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --location "${AZURE_LOCATION:-northeurope}" \
    --enable-rbac-authorization false \
    --output none
  echo "✓ Key Vault created"
  echo ""
  echo "⚠  Don't forget to grant the API container app access:"
  echo "   az keyvault set-policy --name ${KEY_VAULT_NAME} \\"
  echo "     --object-id \$(az containerapp show -n shoppinglist-api -g ${RESOURCE_GROUP} \\"
  echo "       --query identity.principalId -o tsv) \\"
  echo "     --secret-permissions get"
  echo ""
fi

# --- Sync secrets ---

SYNCED=false

if [ -n "${SECRET_KEY:-}" ]; then
  az keyvault secret set \
    --vault-name "${KEY_VAULT_NAME}" \
    --name secret-key \
    --value "${SECRET_KEY}" \
    --output none
  echo "✓ secret-key synced from .env"
  SYNCED=true
else
  echo "⚠  SECRET_KEY not set in backend/.env — skipping"
fi

if [ -n "${REGISTRATION_KEY:-}" ]; then
  az keyvault secret set \
    --vault-name "${KEY_VAULT_NAME}" \
    --name registration-key \
    --value "${REGISTRATION_KEY}" \
    --output none
  echo "✓ registration-key synced from .env"
  SYNCED=true
else
  echo "⚠  REGISTRATION_KEY not set in backend/.env — skipping"
fi

if [ -n "${E2E_TEST_PASSWORD:-}" ]; then
  az keyvault secret set \
    --vault-name "${KEY_VAULT_NAME}" \
    --name e2e-test-password \
    --value "${E2E_TEST_PASSWORD}" \
    --output none
  echo "✓ e2e-test-password synced from .env"
  SYNCED=true
else
  echo "⚠  E2E_TEST_PASSWORD not set in backend/.env — skipping"
fi

if [ "${SYNCED}" = true ]; then
  echo "=== KV sync complete ==="
else
  echo "⚠  No secrets were synced — deployment may fail"
fi
echo ""
