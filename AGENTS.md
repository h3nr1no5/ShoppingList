# AGENTS.md — Shopping List App

## What this is
Shopping list app with sharing. FastAPI backend + React/Vite frontend + PostgreSQL. Monorepo: `backend/`, `frontend/`, `infra/` (Azure Bicep).

**Architecture:** Single container serving both the FastAPI backend and the React/Vite SPA from the same origin. FastAPI mounts the built frontend as static files at `/` with SPA fallback for client-side routing.

## Quick Start
```bash
cd backend && bash run.sh        # venv + PostgreSQL + uvicorn on :8000
cd backend && bash run.sh stop   # stops PostgreSQL container
cd backend && bash stop.sh       # kills uvicorn
cd frontend && bash run.sh       # installs deps + Vite dev server on :5173
```

## Migration (quantity float + unit)
```bash
bash backend/scripts/migrate_float_unit.sh   # ALTER TABLE for existing DB
```
The script is idempotent — safe to run multiple times. Changes `quantity` to `FLOAT` and adds `unit VARCHAR(20)`.

## E2E Database Cleanup
```bash
bash backend/scripts/e2e_db_clean.sh   # drop and recreate shoppinglist_e2e database
```
E2E tests use a dedicated `shoppinglist_e2e` PostgreSQL database, keeping the dev `shoppinglist` database clean. The database is dropped and recreated before each E2E run:
- **`bash run-e2e-tests.sh`** — handles cleanup automatically after starting PostgreSQL.
- **`cd frontend && npx playwright test`** — Playwright's webServer config chains `e2e_db_clean.sh` before starting the backend, so cleanup still happens.
- **Standalone use** — the script can be run manually to reset the E2E database at any time.

## Dev Commands
```bash
# Backend tests (requires PostgreSQL running via docker compose)
cd backend && pytest                     # all tests (excludes smoke_test.py)
cd backend && pytest tests/test_unit/    # unit only
cd backend && pytest -m integration      # integration only
cd backend && pytest -m security         # security only
cd backend && pytest -v -k "test_name"   # single test

# Smoke tests (post-deployment, requires running server)
cd backend && python smoke_test.py       # run against local :8000
# Or run via: bash run-e2e-tests.sh       # starts PostgreSQL + runs smoke tests

# E2E tests (requires PostgreSQL)
bash run-e2e-tests.sh                    # starts PostgreSQL, cleans shoppinglist_e2e DB, runs Playwright
cd frontend && npx playwright test       # run Playwright tests directly (auto-cleans DB via webServer config)

# Frontend
cd frontend && npm run build   # tsc -b && vite build
cd frontend && npm run lint    # eslint
```

## Critical Gotchas

- **`SECRET_KEY` required at import time** — `auth.py` reads it on module load, raises `RuntimeError` if missing. Must be in `.env` before starting server or running tests. Generate: `python -c 'import secrets; print(secrets.token_hex(32))'`
- **Registration requires invite code** — protected by `REGISTRATION_KEY` env var. In Azure, passed as a secure Bicep parameter from GitHub Actions.
- **Tests require PostgreSQL** — conftest.py uses PostgreSQL (not SQLite). Start with `cd backend && docker compose up -d`. Each test gets fresh tables via `setup_database` fixture (create_all → drop_all).
- **`pytest.ini` ignores smoke_test.py** — `addopts = --ignore=smoke_test.py` prevents accidental runs during test suite execution.
- **No migration system** — `Base.metadata.create_all` on startup. Add new models to `models.py` directly.
- **`bcrypt<4.1` pinned** — newer versions break passlib compatibility.
- **Offline queue uses localStorage** — `useOfflineQueue` hook stores pending changes under `pending_changes_{listId}`. No size limit enforcement yet. Changes persist across page refreshes but not across browser storage clears.
- **Duplicate item names rejected** — adding or editing items with duplicate names within the same list is validated and rejected.
- **Static files mounting checks for directory** — `main.py` checks if the static directory exists before mounting (allows running backend without built frontend in development).
- **Quantity is now FLOAT** — `ListItem.quantity` is `Float` (was `Integer`). Frontend uses `parseFloat`. Range: 0.1–9999. Backward compatible — integer values still accepted.
- **Items have a unit field** — `ListItem.unit` (VARCHAR(20), default `"pcs"`). Display: `{quantity} {unit}` when unit is set (e.g. `2 kg`, `1 pcs`). Falls back to `x{quantity}` when unit is empty.

## Architecture

- Single-container deployment: FastAPI serves both the API (`/api/*`) and the frontend (static files at `/` with SPA fallback)
- API routes: `/api/*` (auth, lists, items) and `/health` (health check with DB connectivity)
- `/health` returns 200 with `{"status": "healthy", "database": "ok"}` when healthy, 503 with `{"status": "degraded", "database": "unreachable"}` when DB is down
- JWT auth via `python-jose`, passwords via `passlib` + `bcrypt`
- Async SQLAlchemy 2.0 with `asyncpg` (PostgreSQL)
- Share codes are UUIDs passed as `?share_code=...` query param
- Access model: owner, share code, public list, or anonymous list (no owner)
- CORS configurable via `ALLOWED_ORIGINS` (comma-separated, defaults to `http://localhost:5173`)
- `database.py` detects Azure URLs by checking for `azure` or `cloudapp` in connection string → enables SSL
- Frontend calls `/api/*` directly (same-origin); no separate API URL needed in production

## Azure Deployment

Deployed via GitHub Actions to Azure Container Apps. Push to `main` triggers the workflow which builds the image, pushes to ghcr.io, updates the container app, and runs smoke tests.

**Staging:** Push to `dev` triggers an ephemeral staging deployment via Azure Container Instances (ACI). A container spins up, runs E2E + smoke tests against it, then is destroyed. Cost: ~$0.02 per run.

**Initial provisioning:**
```bash
az login
azd init
azd provision
```

**Automatic deploy:** Push to `main` → GitHub Actions deploys automatically.

**Staging deploy:** Push to `dev` → ACI staging environment (ephemeral, auto-cleanup).

**Production URL:** `https://shoppinglist-app.victorioushill-2f5d1c85.northeurope.azurecontainerapps.io/`

**Secrets (GitHub → Actions → Secrets):**
- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` — OIDC auth
- `SECRET_KEY`, `REGISTRATION_KEY` — passed to Bicep via `@secure()` params
- `DATABASE_URL` — full PostgreSQL connection string (required for ACI staging)
- `GHCR_PAT` — PAT with `write:packages` and `read:packages` scopes (used for both pushing to ghcr.io and Container App runtime pulls)

**Variables (GitHub → Actions → Variables):**
- `AZURE_ENV_NAME` = `shoppinglistprod`

**CI:** `test.yml` runs tests on push/PR to `main` and `dev`. `deploy.yml` deploys on push to `main`. `deploy-dev.yml` runs ACI staging on push to `dev`.

## Test Fixtures (conftest.py)

| Fixture | Description |
|---------|-------------|
| `client` | Unauthenticated async HTTP client |
| `authenticated_client` | Authenticated as test_user (`test@example.com` / `TestPassword123!`) |
| `authenticated_client_2` | Authenticated as test_user_2 (`test2@example.com` / `TestPassword456!`) |
| `test_user`, `test_user_2` | User model instances |
| `test_user_token`, `test_user_2_token` | Valid JWT tokens |
| `test_list`, `test_list_public`, `test_list_no_owner`, `test_list_with_share_code` | List variants |
| `test_item` | Item in test_list |
| `db_session` | Clean isolated DB session per test |
| `setup_database` (autouse) | Creates all tables before test, drops after |

## Key Files
- `Dockerfile` — root multi-stage build (Node build → Python runtime)
- `backend/main.py` — FastAPI app entry point, routes, and static file mounting
- `backend/models.py` — SQLAlchemy models (User, ShoppingList, ListItem)
- `backend/auth.py` — JWT + password hashing
- `backend/crud.py` — database operations
- `backend/database.py` — async engine + session setup
- `backend/smoke_test.py` — post-deployment smoke tests
- `backend/ci-run.sh` — CI backend startup script
- `frontend/src/api/client.ts` — API client
- `frontend/src/App.tsx` — router + auth context
- `frontend/src/hooks/useOfflineQueue.ts` — offline mutation queue hook
- `frontend/e2e/` — Playwright E2E tests
- `frontend/playwright.deploy.config.ts` — deployment-specific E2E config (no webServer, runs against deployed instance)
- `run-e2e-tests.sh` — convenience script for local E2E tests
- `.github/workflows/deploy-dev.yml` — ACI staging workflow (ephemeral, push to `dev`)
- `.github/workflows/deploy.yml` — production deployment workflow (push to `main`)
- `infra/main.bicep` — Azure infrastructure (single container app)
- `backend/scripts/migrate_float_unit.sh` — DB migration for float quantity + unit column
- `backend/scripts/e2e_db_clean.sh` — drops and recreates the `shoppinglist_e2e` database