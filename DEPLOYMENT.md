# Shopping List App - Deployment Guide

## Architecture

Single container serving both API and frontend. FastAPI mounts the built React/Vite SPA at `/` with SPA fallback.
Images hosted on GitHub Container Registry (ghcr.io).

## Prerequisites

- Azure CLI (`brew install azure-cli`)
- Azure Developer CLI (`brew install azure-dev-cli`)
- Access to the GitHub repository with admin permissions

## One-Time Azure Setup

### 1. Create Azure AD App Registration for OIDC

```bash
az ad app create --display-name "github-shoppinglist-deploy"
APP_ID=$(az ad app list --display-name "github-shoppinglist-deploy" --query "[0].appId" -o tsv)

az ad sp create --id "$APP_ID"

# Add federated credential for GitHub
az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters '{
    "name": "github-deploy",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:your-org/ShoppingList:environment:production",
    "description": "GitHub Actions deploy from main",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# Assign Contributor role
az role assignment create \
  --assignee "$APP_ID" \
  --role "Contributor" \
  --scope "/subscriptions/$(az account show --query id -o tsv)"
```

### 2. Set GitHub Secrets

Go to repo → Settings → Secrets and variables → Actions → Secrets:

| Secret | Value |
|---|---|
| `AZURE_CLIENT_ID` | From app registration above |
| `AZURE_TENANT_ID` | `az account show --query tenantId -o tsv` |
| `AZURE_SUBSCRIPTION_ID` | `az account show --query id -o tsv` |
| `SECRET_KEY` | `python -c 'import secrets; print(secrets.token_hex(32))'` |
| `REGISTRATION_KEY` | Any string (invite code) |
| `GHCR_PAT` | GitHub PAT with `read:packages` scope |

And Variables:

| Variable | Value |
|---|---|
| `AZURE_ENV_NAME` | `shoppinglistprod` |

### 3. Initial Provisioning

```bash
# Only needed once — creates all Azure resources
az login
azd init
azd provision
```

This creates: Resource group, Container Apps Environment, Container App (with nginx placeholder), PostgreSQL Flexible Server.

## Deploy

### Automatic (CI/CD)
Push to `main` → GitHub Actions deploys automatically.

### Manual (from Actions tab)
GitHub → Actions → Deploy to Azure → Run workflow.

## What Gets Created

- **1x Container App** — serves both API and frontend (0.5 CPU, 1Gi RAM, 0-1 replicas)
- **1x Container Apps Environment**
- **1x PostgreSQL Flexible Server** (Standard_B1ms, 32GB)
- **1x Resource Group**

## Environment Variables

Set in `infra/main.bicep` as `@secure()` parameters, passed from GitHub Actions:

| Variable | Source |
|---|---|
| `SECRET_KEY` | GitHub secret → Bicep parameter |
| `REGISTRATION_KEY` | GitHub secret → Bicep parameter |
| `DATABASE_URL` | Constructed from PostgreSQL resource in Bicep |
| `ALLOWED_ORIGINS` | Unset (CORS allows same-origin only by default) |

## After Deployment

### View URL
Check the GitHub Action output, or:
```bash
az containerapp show --name shoppinglistprod-app --resource-group rg-shoppinglistprod --query properties.configuration.ingress.fqdn -o tsv
```

### Check Logs
```bash
az containerapp logs show --name shoppinglistprod-app --resource-group rg-shoppinglistprod --tail 50
```

### Clean Up
```bash
azd down
```

## Costs
- Container App (1x): ~$7/month
- Container Apps Environment: ~$5/month
- PostgreSQL Flexible Server (B1ms): ~$25/month
- **Total**: ~$37/month