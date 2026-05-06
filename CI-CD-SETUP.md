# CI/CD Setup Guide for Shopping List App

## Overview

This guide explains how to set up the GitHub Actions CI/CD pipeline for the Shopping List app using Azure Developer CLI (azd).

## What Was Configured

### Files Created/Modified

| File | Purpose |
|------|---------|
| `.github/workflows/deploy.yml` | GitHub Actions workflow for CI/CD |
| `infra/hooks/verify-deployment.sh` | Post-deployment verification script |
| `azure.yaml` | Added `postdeploy` hook for URL verification |

### How It Works

1. **On push to `main` branch:**
   - Runs backend tests (PostgreSQL required)
   - Runs frontend tests + linting
   - If tests pass → deploys to Azure using `azd deploy --all`
   - Verifies deployment (health checks + URL validation)

2. **Post-Deployment Verification (`postdeploy` hook):**
   - Checks web frontend accessibility (HTTP 200)
   - Checks API health endpoint
   - Verifies API URL is correctly baked into frontend bundle

## GitHub Repository Configuration

### Step 1: Set Up Azure Authentication (OIDC)

Run these commands locally to configure OpenID Connect:

```bash
# Log in to Azure
az login

# Get your subscription ID
az account show --query id -o tsv

# Get your tenant ID
az account show --query tenantId -o tsv

# Create federated credential for GitHub
# (This links your GitHub repo to Azure for secure authentication)
```

**Option A: Use `azd pipeline config` (Automated - Recommended):**
```bash
cd /Users/henrik/Documents/dev/opencode/ShoppingList
azd pipeline config
# Choose: GitHub
# This automatically sets up OIDC and creates the workflow
```

**Option B: Manual OIDC Setup:**

1. Go to [Azure Portal → Azure Active Directory → App registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Create a new app registration named "shoppinglist-github-actions"
3. Note the **Application (client) ID** and **Directory (tenant) ID**
4. Go to "Certificates & secrets" → "Federated credentials" → "Add credential"
5. Select "GitHub" as issuer
6. Enter your GitHub repo: `h3nr1c0/ShoppingList`
7. Select "Environment: production"

### Step 2: Add GitHub Repository Variables

Go to **GitHub repo → Settings → Secrets and variables → Actions → Variables tab**

Add these variables:

| Name | Value | Example |
|------|-------|---------|
| `AZURE_CLIENT_ID` | Azure app registration client ID | `12345678-1234-1234-1234-123456789012` |
| `AZURE_TENANT_ID` | Azure tenant ID | `87654321-4321-4321-4321-210987654321` |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID | `51234567-8901-2345-6789-012345678901` |
| `AZURE_ENV_NAME` | azd environment name | `shoppinglistprod` |

### Step 3: Add GitHub Repository Secrets

Go to **GitHub repo → Settings → Secrets and variables → Actions → Secrets tab**

Add these secrets (for production deployment):

| Name | Value | Notes |
|------|-------|-------|
| `SECRET_KEY` | Your production secret key | Generate: `python -c 'import secrets; print(secrets.token_hex(32))'` |
| `REGISTRATION_KEY` | Your production registration key | Any secure random string |

**Note:** These secrets are also stored as Azure Container App secrets via `infra/main.bicep`.

## How to Deploy

### Automatic Deployment (Recommended)

1. Push to `main` branch:
   ```bash
   git add .
   git commit -m "feat: add CI/CD pipeline"
   git push origin main
   ```

2. GitHub Actions will automatically:
   - Run tests
   - Deploy to Azure
   - Verify the deployment

3. Monitor at: **GitHub repo → Actions tab**

### Manual Deployment (Local)

```bash
cd /Users/henrik/Documents/dev/opencode/ShoppingList/infra
azd deploy --all
```

### Verifying Deployment

After deployment, the `postdeploy` hook automatically:

1. Checks web frontend URL (HTTP 200)
2. Checks API health endpoint
3. Verifies API URL is baked into frontend bundle

View results in:
- **GitHub Actions logs** (if deployed via pipeline)
- **Local terminal** (if deployed via `azd deploy`)

## Troubleshooting

### Wrong URL Deployed

**Problem:** Frontend has wrong API URL baked in.

**Solution:** The `prebuild` hook now runs BEFORE Docker build, ensuring `.env` has correct `VITE_API_URL` from `azd env get-values`.

**Verify:**
```bash
# Check what URL is baked into the bundle
curl -s https://shoppinglist-web.victorioushill-2f5d1c85.northeurope.azurecontainerapps.io/ | grep "index-"
# Download that bundle and check for API URL
curl -s https://shoppinglist-web.victorioushill-2f5d1c85.northeurope.azurecontainerapps.io/assets/index-XXXX.js | grep "shoppinglist-api"
```

### Deployment Failed

1. Check GitHub Actions logs
2. Verify GitHub secrets/variables are set correctly
3. Run `azd deploy --all` locally to test

### Health Check Failed

```bash
# Check API health
curl https://shoppinglist-api.victorioushill-2f5d1c85.northeurope.azurecontainerapps.io/health

# Check web frontend
curl -I https://shoppinglist-web.victorioushill-2f5d1c85.northeurope.azurecontainerapps.io/
```

## Manual Testing (Without Pipeline)

To test the post-deployment verification locally:

```bash
cd /Users/henrik/Documents/dev/opencode/ShoppingList

# Set azd environment
azd env set AZURE_ENV_NAME shoppinglistprod

# Run verification script manually
bash infra/hooks/verify-deployment.sh
```

## Next Steps

1. **Commit and push** the CI/CD files:
   ```bash
   git add .github/workflows/deploy.yml infra/hooks/verify-deployment.sh azure.yaml
   git commit -m "feat: add CI/CD pipeline with post-deployment verification"
   git push origin main
   ```

2. **Set up GitHub secrets** (see Step 2 & 3 above)

3. **Monitor first deployment** at GitHub Actions tab

4. **Verify** the deployment URL shows correct API endpoint

## Summary

| Feature | Status |
|---------|--------|
| Tests on PR/push | ✅ Via `test.yml` |
| Automatic deployment to Azure | ✅ Via `deploy.yml` |
| Post-deployment URL verification | ✅ Via `postdeploy` hook |
| OIDC authentication | ⚠️  Needs manual setup |
| GitHub secrets configured | ⚠️  Needs manual setup |
