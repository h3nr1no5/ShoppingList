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
| `VITE_API_URL` | Backend API URL |

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