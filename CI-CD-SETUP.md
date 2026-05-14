# CI/CD Setup Guide

## Overview

Two GitHub Actions workflows:
- `test.yml` — Runs on push/PR to `main` (tests, lint, build verification)
- `deploy.yml` — Runs on push to `main` (deploys to Azure)

## Prerequisites

- Azure AD App Registration with OIDC federated credential for GitHub
- GitHub secrets configured (see below)

## Required GitHub Configuration

### Secrets (Settings → Secrets and variables → Actions → Secrets)

| Secret | Purpose |
|---|---|
| `AZURE_CLIENT_ID` | Azure AD app registration client ID |
| `AZURE_TENANT_ID` | Azure tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `SECRET_KEY` | JWT signing key |
| `REGISTRATION_KEY` | Invite code for registration |
| `GHCR_PAT` | GitHub PAT with `read:packages` scope (for Container App runtime pulls) |

### Variables (Settings → Secrets and variables → Actions → Variables)

| Variable | Value |
|---|---|
| `AZURE_ENV_NAME` | `shoppinglistprod` (or your env name) |

### Notes

- OIDC secrets (AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID) use `secrets.*` in the workflow, so add them as Secrets (not Variables).
- `GHCR_PAT` must be a [Personal Access Token](https://github.com/settings/tokens) with `read:packages` scope. The `GITHUB_TOKEN` can't be used because it expires after the workflow run, but Container Apps need credentials to pull images at runtime.

## Workflow Details

### test.yml
- **Backend**: pytest with PostgreSQL 16 service container
- **Frontend**: lint + tests
- **Bicep**: validates compilation

### deploy.yml

1. **Checkout** code
2. **Login to ghcr.io** via `docker/login-action` (uses `GITHUB_TOKEN`)
3. **Build & push** Docker image to `ghcr.io/${{ github.repository }}:${{ github.sha }}`
4. **Login to Azure** via OIDC (`azure/login@v2`)
5. **Detect resource group** and container app name via Azure CLI
6. **Update container app** via `az containerapp update` with new image + secrets
7. **Smoke test**: health check (`/health`) + SPA check (`/`)

## Troubleshooting

### "403" pulling from ghcr.io
Ensure `GHCR_PAT` has `read:packages` scope and is set correctly.

### Container App keeps crashing
Check logs:
```bash
az containerapp logs show --name shoppinglistprod-app --resource-group rg-shoppinglistprod --tail 100
```

### Workflow fails on OIDC
Verify federated credential subject matches `repo:your-org/ShoppingList:environment:production`.