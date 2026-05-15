# CI/CD Setup Guide

## Overview

Three GitHub Actions workflows:
- `test.yml` — Runs on push/PR to `main` and `dev` (tests, lint, build verification, E2E)
- `deploy.yml` — Runs on push to `main` (deploys to Azure)
- `smoke.yml` — Scheduled smoke test that runs every 15 minutes against production

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
- **Frontend-E2E**: Playwright E2E tests (runs on PR to `main` and `dev`)
- **Bicep**: validates compilation

### deploy.yml

1. **Checkout** code (`actions/checkout@v5`)
2. **Login to ghcr.io** via `docker/login-action@v3` (uses `GITHUB_TOKEN`)
3. **Build & push** Docker image to `ghcr.io/${{ github.repository }}:${{ github.sha }}` (`docker/build-push-action@v6`)
4. **Login to Azure** via OIDC (`azure/login@v2`)
5. **Detect resource group** and container app name via Azure CLI
6. **Update container app** via `az containerapp update` with new image + secrets
7. **Get deployment URL** via Azure CLI
8. **Setup Python** for smoke test script
9. **Run smoke tests**: executes `python backend/smoke_test.py` against deployed URL with `SMOKE_BASE_URL` and `SMOKE_REGISTRATION_KEY`

## Troubleshooting

### "403" pulling from ghcr.io
Ensure `GHCR_PAT` has `read:packages` scope and is set correctly.

### Container App keeps crashing
Check logs:
```bash
az containerapp logs show --name shoppinglist-app --resource-group rg-ShoppingListProd --tail 100
```

### Workflow fails on OIDC
Verify federated credential subject matches `repo:your-org/ShoppingList:environment:production`.