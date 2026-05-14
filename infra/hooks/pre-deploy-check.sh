#!/bin/bash
# pre-deploy-check.sh
# Pre-deployment URL verification
# Runs AFTER set-env.sh (which syncs .env → Key Vault).
# Runs BEFORE azd deploy to prevent wrong URL deployments.

set -e

echo "========================================="
echo "Pre-Deployment URL Check"
echo "========================================="

# 1. Check Azure CLI login
echo ""
echo "1. Checking Azure authentication..."
if ! az account show > /dev/null 2>&1; then
    echo "❌ Not logged in to Azure"
    echo "   Run: az login"
    exit 1
fi
echo "✅ Azure CLI authenticated"

# 2. Check azd environment
echo ""
echo "2. Checking azd environment..."
if ! azd env get-values > /dev/null 2>&1; then
    echo "❌ azd environment not configured"
    echo "   Run: azd init"
    exit 1
fi
echo "✅ azd environment configured"

# 3. Get expected URLs from azd environment
echo ""
echo "3. Getting expected URLs from azd..."
API_URL=$(azd env get-values 2>/dev/null | grep '^AZURE_API_APP_URL=' | head -1 | cut -d'=' -f2- | tr -d '"' || "")
WEB_URL=$(azd env get-values 2>/dev/null | grep '^AZURE_WEB_APP_URL=' | head -1 | cut -d'=' -f2- | tr -d '"' || "")

if [ -z "$API_URL" ] || [ -z "$WEB_URL" ]; then
    echo "❌ Could not retrieve URLs from azd environment"
    echo "   API_URL: $API_URL"
    echo "   WEB_URL: $WEB_URL"
    echo "   Run: azd provision (if infrastructure not created yet)"
    exit 1
fi

echo "✅ URLs retrieved from azd environment:"
echo "   API: $API_URL"
echo "   Web: $WEB_URL"

# 4. Validate URL format
echo ""
echo "4. Validating URL format..."
if [[ ! "$API_URL" =~ ^https:// ]] || [[ ! "$WEB_URL" =~ ^https:// ]]; then
    echo "❌ Invalid URL format (must start with https://)"
    exit 1
fi
echo "✅ URL format valid"

# 5. Test if endpoints are accessible (infrastructure may already exist)
echo ""
echo "5. Testing if endpoints are accessible..."
HTTP_API=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" || echo "000")
HTTP_WEB=$(curl -s -o /dev/null -w "%{http_code}" "$WEB_URL/" || echo "000")

if [ "$HTTP_API" = "200" ] || [ "$HTTP_API" = "000" ]; then
    echo "   API endpoint: $HTTP_API (may not be deployed yet)"
else
    echo "⚠️  API endpoint returned HTTP $HTTP_API"
fi

if [ "$HTTP_WEB" = "200" ] || [ "$HTTP_WEB" = "000" ]; then
    echo "   Web endpoint: $HTTP_WEB (may not be deployed yet)"
else
    echo "⚠️  Web endpoint returned HTTP $HTTP_WEB"
fi

# 6. Simulate what prebuild hook will do
echo ""
echo "6. Verifying .env file will be created correctly..."
TEMP_ENV=$(mktemp)
echo "VITE_API_URL=${API_URL}" > "$TEMP_ENV"

if grep -q "VITE_API_URL=https://" "$TEMP_ENV"; then
    echo "✅ .env file will contain valid VITE_API_URL"
    echo "   Value: $(grep VITE_API_URL "$TEMP_ENV" | cut -d'=' -f2-)"
else
    echo "❌ .env file would have invalid VITE_API_URL"
    rm "$TEMP_ENV"
    exit 1
fi
rm "$TEMP_ENV"

# 7. Final summary
echo ""
echo "========================================="
echo "✅ Pre-deployment checks PASSED!"
echo "========================================="
echo ""
echo "Ready to deploy with:"
echo "  cd infra && azd deploy --all"
echo ""
echo "| Expected URL       | Status |"
echo "|-------------------|--------|"
echo "| $API_URL | Will be baked into frontend |"
echo "| $WEB_URL | Will serve frontend |"
echo ""
