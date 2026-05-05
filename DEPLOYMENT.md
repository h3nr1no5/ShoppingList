# Shopping List App - Deployment Guide

This guide covers deploying the shopping list app to Microsoft Azure.

## Prerequisites

| Requirement | Installation |
|-------------|--------------|
| Azure CLI | `brew install azure-cli` |
| Azure Developer CLI | `brew install azure-dev-cli` |
| Node.js 20+ | `brew install node` |
| Python 3.11+ | `brew install python@3.11` |

## Quick Deploy

```bash
# 1. Login to Azure
az login
azd config set auth.useAzCliAuth true

# 2. Navigate to project
cd ShoppingList

# 3. Deploy everything
azd up
```

The `azd up` command will prompt for:
- Environment name (e.g., `shoppinglist-prod`)
- Azure subscription
- Location (e.g., `North Europe`)
- PostgreSQL admin credentials

## Azure Region Selection

| Region | Location | Notes |
|--------|----------|-------|
| **North Europe** | Ireland | Primary (recommended for Europe) |
| **West Europe** | Netherlands | Paired region |

Both regions are GDPR-compliant with good latency to Central Europe.

When running `azd up`, select:
- Location: `North Europe`

## Architecture

| Component | Azure Service | Runtime |
|-----------|---------------|---------|
| Frontend | Container Apps | Node 20 Alpine |
| Backend API | Container Apps | Python 3.11 |
| Database | Azure Database for PostgreSQL | PostgreSQL 15 |

## What Gets Created

- **2x Container Apps** - Frontend + Backend
- **1x Container Apps Environment** - Shared environment
- **1x PostgreSQL Flexible Server** - Database (B1ms SKU)

## Registration

Registration requires an invite code. Set the `REGISTRATION_KEY` environment variable in the Container App configuration. New users must provide a valid invite code when registering via the `/api/auth/register` endpoint.

## After Deployment

### View URLs
```bash
azd show
```

### Redeploy Code Changes
```bash
azd deploy
```

### Clean Up Resources
```bash
azd down
```

## Environment Variables

The following are auto-configured during deployment:

| Variable | Description |
|----------|-------------|
| `AZURE_POSTGRESQL_CONNECTIONSTRING` | Database connection string |
| `SECRET_KEY` | Auto-generated JWT secret |
| `ALLOWED_ORIGINS` | Frontend URL (CORS) |
| `VITE_API_URL` | Backend API URL (baked into frontend at build time) |

### How `VITE_API_URL` is Set

The frontend needs the API URL at **build time** (Vite bakes it into the JavaScript bundle).

**Flow:**
1. `azd provision` → Deploys `infra/main.bicep` → Azure Container Apps created
2. `azd` stores outputs (including `API_APP_URL`) in `.azure/` state
3. `prepackage.sh` hook runs → Reads `API_APP_URL` via `azd env get-values`
4. Writes `VITE_API_URL` to `frontend/.env` (gitignored)
5. Docker build → `npm run build` → Vite replaces `import.meta.env.VITE_API_URL` with the actual value

**Key files:**
- `infra/main.bicep` (lines 148-152): Sets `VITE_API_URL` in Container App environment
- `infra/hooks/prepackage.sh`: Injects URL into `frontend/.env` before build

---

## CI/CD Pipeline

### GitHub Actions (`.github/workflows/test.yml`)
- **Triggers:** Push to `main`, Pull Requests
- **Purpose:** Runs tests ONLY - does NOT deploy to Azure
- **Jobs:**
  - `backend-test`: Python tests with PostgreSQL service container
  - `frontend-test`: Lint + Vitest tests
  - `frontend-build`: Verifies build works with test API URL

### Azure Developer CLI (`azd`) - Actual Deployment
Deployment is done manually via `azd` (not GitHub Actions):

```bash
cd infra && azd up      # Provision + Deploy (first time)
cd infra && azd deploy --all  # Deploy only (after code changes)
```

**Deployment flow:**
1. `azd provision` → Deploys `infra/main.bicep` to Azure
2. `prepackage` hook runs → `infra/hooks/prepackage.sh` writes `VITE_API_URL`
3. Build services → Docker builds for frontend/backend
4. Push images → Images pushed to Azure Container Registry (ACR)
5. Deploy → Container Apps updated with new images

**Architecture:**
```
GitHub (push) → GitHub Actions (tests only) → NO deployment
                                     │
                                     ▼
Developer Laptop → azd up / azd deploy → Azure (provision + deploy)
```

---

## Container App URLs

### URL Format
Azure Container Apps use this format:
```
https://{container-app-name}.{random-suffix}.{region}.azurecontainerapps.io/
```

Example: `shoppinglist-api.victorioushill-2f5d1c85.northeurope.azurecontainerapps.io/`

- **Fixed prefix:** `shoppinglist-api` or `shoppinglist-web`
- **Random suffix:** Azure-generated (e.g., `victorioushill-2f5d1c85`)
- **Region:** `northeurope`

### What Causes URL Changes?

The URL changes when the Container App resource is **deleted and recreated**:
- Running `azd provision` fresh (creates new resources)
- Manually deleting the Container App in Azure Portal
- Terraform/azd state issues causing recreation

**The URL stays stable** as long as you only run `azd deploy` (not `azd up` which re-provisions).

### Preventing URL Changes

| Action | Description |
|--------|-------------|
| **Don't re-provision** | Run `azd deploy --all` after code changes, not `azd up` |
| **Check `.azure/` folder** | Contains azd state - don't delete it |
| **Use `--no-refresh` flag** | `azd deploy --all --no-refresh` skips infrastructure updates |
| **Manual image update** | Use Azure Portal or `az containerapp update` to swap images without recreation |

### Updating API URL After Change

If the URL changes (e.g., after re-provisioning):
1. Run `azd env get-values` to get new `API_APP_URL`
2. Update `frontend/.env` with new `VITE_API_URL`
3. Run `cd frontend && npm run build` to rebuild
4. Redeploy: `cd infra && azd deploy --service web`

## Local Development

### Option 1: With PostgreSQL (Full Stack)

```bash
# Start PostgreSQL (requires Docker)
cd backend && bash run.sh

# Frontend (in another terminal)
cd frontend && bash run.sh
```

### Option 2: With Docker (for running tests)

Tests require PostgreSQL. Start the test database using Docker:

```bash
# Start PostgreSQL container
cd backend && docker compose up -d

# Run tests
cd backend && pytest

# Frontend
cd frontend && bash run.sh
```

Access:
- Frontend: http://localhost:5173
- API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` is set in the API Container App
- Check firewall rules allow Azure services

### CORS Errors
- Update `ALLOWED_ORIGINS` in the API Container App configuration

### Build Failures
- Check logs: `azd deploy --verbose`
- Verify Python requirements.txt syntax
- Verify package.json dependencies

## Costs

Estimated monthly costs (B1ms tier):
- Container Apps (2x): ~$10/month
- Container Apps Environment: ~$5/month
- PostgreSQL Flexible Server: ~$25/month
- **Total**: ~$40/month

Use the [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/) for accurate estimates.