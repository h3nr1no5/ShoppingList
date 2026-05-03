# AGENTS.md — Shopping List App

## What this is
A shopping list app with sharing capabilities. FastAPI backend + React/Vite frontend + PostgreSQL. Monorepo layout: `backend/`, `frontend/`, `infra/` (Azure Bicep).

## Quick Start

```bash
# Backend (port 8000)
cd backend && bash run.sh        # creates venv, starts Docker Postgres, runs uvicorn
cd backend && bash run.sh stop   # stops Postgres container
cd backend && bash stop.sh       # kills uvicorn process

# Frontend (port 5173)
cd frontend && bash run.sh       # installs deps, runs Vite dev server
```

## Backend Commands
```bash
cd backend && pytest                         # run all tests (uses SQLite, not Postgres)
cd backend && pytest tests/test_unit/        # unit tests only
cd backend && pytest -m integration          # integration tests only
cd backend && pytest -m security             # security tests only
cd backend && pytest -v -k "test_login"      # run a single test by name
```

## Frontend Commands
```bash
cd frontend && npm run dev     # dev server
cd frontend && npm run build   # typecheck + build (tsc -b && vite build)
cd frontend && npm run lint    # eslint
```

## Critical Setup Quirks

- **`SECRET_KEY` is required at import time** — `auth.py` reads it on module load and raises `RuntimeError` if missing. Must be set in `.env` before starting the server or importing the app in tests. Generate with: `python -c 'import secrets; print(secrets.token_hex(32))'`. In production (Azure), stored as a container app secret.
- **Registration requires invite code** — New user registration is protected by `REGISTRATION_KEY`. Set via env var or Azure secret.
- **Tests use SQLite, not PostgreSQL** — `conftest.py` overrides `DATABASE_URL` to `sqlite+aiosqlite:///./test_shopping_list.db`. The test db file lives in the `backend/` root. No running Postgres needed for tests.
- **No migration system** — tables are auto-created on startup via `init_db()` (`Base.metadata.create_all`). Add new models directly to `models.py`.
- **Vite proxies `/api` → `http://localhost:8000`** — the frontend dev server handles the API proxy. `VITE_API_URL` in `.env` is optional and rarely needed.
- **Docker Compose runs Postgres** on port 5432 with `postgres:postgres` credentials. Database name: `shoppinglist`.

## Architecture Facts

- **All API routes use `/api/*` prefix** except `/health`
- **JWT auth** via `python-jose`, passwords via `passlib` + `bcrypt<4.1`
- **Async SQLAlchemy 2.0** with `asyncpg` driver (PostgreSQL) / `aiosqlite` (tests)
- **Share codes** are UUIDs passed as query param `?share_code=...` on list endpoints
- **Access model**: owner, share code, public list, or anonymous list (no owner)
- **CORS** configurable via `ALLOWED_ORIGINS` env var (comma-separated, defaults to `http://localhost:5173`)
- **Azure Container Apps** — both frontend and backend run as container apps (not App Service)
- **PostgreSQL** — Azure Database for PostgreSQL Flexible Server

## Azure Deployment

The app is deployed to Azure Container Apps using Azure Developer CLI (`azd`).

```bash
# Provision infrastructure (ACR, PostgreSQL, Container Apps)
cd infra && azd provision

# Deploy the application
cd infra && azd deploy --all

# Or do both in one step
cd infra && azd up
```

**Production URLs:**
- Frontend: `https://shoppinglist-web.victorioushill-2f5d1c85.northeurope.azurecontainerapps.io/`
- API: `https://shoppinglist-api.victorioushill-2f5d1c85.northeurope.azurecontainerapps.io/`
- API Docs: `https://shoppinglist-api.victorioushill-2f5d1c85.northeurope.azurecontainerapps.io/docs`

**Registration:** Requires invite code (set via `REGISTRATION_KEY` environment variable)

## Test Fixtures (conftest.py)
- `client` — unauthenticated async HTTP client
- `authenticated_client` — authenticated as test_user (email: `test@example.com`, password: `TestPassword123!`)
- `authenticated_client_2` — authenticated as test_user_2
- `test_user`, `test_user_2` — user objects
- `test_user_token`, `test_user_2_token` — valid JWT tokens
- `test_list`, `test_list_public`, `test_list_no_owner`, `test_list_with_share_code` — list variants
- `test_item` — item in test_list
- `db_session` — clean isolated DB session
- `clean_database` (autouse) — wipes all tables after each test
