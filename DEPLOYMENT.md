# Shopping List App - Deployment Guide

This guide covers deploying the shopping list app to Microsoft Azure.

## Prerequisites

| Requirement | Installation |
|-------------|--------------|
| Azure CLI | `brew install azure-cli` |
| Azure Developer CLI | `brew install azure-dev-cli` |
| Node.js 18+ | `brew install node` |
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
| Frontend | App Service | Node 18 Alpine |
| Backend API | App Service | Python 3.11 |
| Database | Azure Database for PostgreSQL | PostgreSQL 15 |

## What Gets Created

- **2x App Service** (Linux) - Frontend + Backend
- **1x PostgreSQL Flexible Server** - Database
- **1x App Service Plan** - B1 SKU

## Registration

Registration is **open to everyone** — no invite code required. New users can register directly through the `/api/auth/register` endpoint.

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
| `VITE_API_URL` | Backend API URL |

## Local Development

### Option 1: With PostgreSQL (Full Stack)

```bash
# Start PostgreSQL (requires Docker)
cd backend && bash run.sh

# Frontend (in another terminal)
cd frontend && bash run.sh
```

### Option 2: SQLite for Testing (No PostgreSQL Required)

Tests use SQLite and don't require a running PostgreSQL instance:

```bash
# Backend with SQLite (for testing only)
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
- Verify `AZURE_POSTGRESQL_CONNECTIONSTRING` is set in App Service
- Check firewall rules allow Azure services

### CORS Errors
- Update `ALLOWED_ORIGINS` in App Service configuration

### Build Failures
- Check logs: `azd deploy --verbose`
- Verify Python requirements.txt syntax
- Verify package.json dependencies

## Costs

Estimated monthly costs (B1 tier):
- App Service (2x): ~$25/month
- PostgreSQL Flexible Server: ~$30/month
- **Total**: ~$55/month

Use the [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/) for accurate estimates.