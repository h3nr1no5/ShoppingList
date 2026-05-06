#!/bin/bash
set -e

echo "========================================="
echo "Verifying Deployment"
echo "========================================="

# Get URLs from azd environment
WEB_URL=$(azd env get-value AZURE_WEB_APP_URL 2>/dev/null || echo "")
API_URL=$(azd env get-value AZURE_API_APP_URL 2>/dev/null || echo "")

if [ -z "$WEB_URL" ] || [ -z "$API_URL" ]; then
    echo "⚠️  Could not retrieve URLs from azd environment"
    echo "   WEB_URL: $WEB_URL"
    echo "   API_URL: $API_URL"
    echo "   Continuing with verification anyway..."
fi

echo "Web URL: ${WEB_URL:-not set}"
echo "API URL: ${API_URL:-not set}"
echo ""

# Verify web frontend is accessible
echo "Checking web frontend..."
if curl -sf "$WEB_URL/" > /dev/null; then
    echo "✅ Web frontend is accessible"
else
    echo "❌ Web frontend check failed"
    exit 1
fi

# Verify web frontend returns HTTP 200
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$WEB_URL/")
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Web frontend returns HTTP 200"
else
    echo "❌ Web frontend returned HTTP $HTTP_CODE"
    exit 1
fi

# Verify API health endpoint
echo ""
echo "Checking API health..."
if curl -sf "$API_URL/health" > /dev/null; then
    echo "✅ API health check passed"
else
    echo "❌ API health check failed"
    exit 1
fi

# Verify API returns healthy status
HEALTH_STATUS=$(curl -s "$API_URL/health" | grep -o '"status":"[^"]*"' || echo "")
if [ -n "$HEALTH_STATUS" ]; then
    echo "✅ API status: $HEALTH_STATUS"
else
    echo "⚠️  Could not parse API health status"
fi

# Verify API URL is correctly baked into frontend bundle
echo ""
echo "Checking if API URL is in frontend bundle..."
BUNDLE_URL=$(curl -s "$WEB_URL/" | grep -oP 'src="\/assets\/index-[^"]+\.js"' | head -1 | grep -oP '\/assets\/[^"]+' || echo "")
if [ -n "$BUNDLE_URL" ]; then
    echo "   Bundle: $BUNDLE_URL"
    # Download bundle and check for API URL
    BUNDLE_CONTENT=$(curl -s "${WEB_URL}${BUNDLE_URL}")
    if echo "$BUNDLE_CONTENT" | grep -q "$API_URL"; then
        echo "✅ API URL is correctly baked into frontend bundle"
    else
        echo "❌ WARNING: API URL not found in frontend bundle!"
        echo "   Expected: $API_URL"
        echo "   The frontend may be using wrong API URL!"
        exit 1
    fi
else
    echo "⚠️  Could not find bundle URL for verification"
fi

echo ""
echo "========================================="
echo "✅ Deployment verification completed successfully!"
echo "========================================="
echo ""
echo "| Service | Endpoint |"
echo "|---------|----------|"
echo "| Frontend | $WEB_URL |"
echo "| API | $API_URL |"
