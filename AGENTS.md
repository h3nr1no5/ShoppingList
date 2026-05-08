# AGENTS.md — Shopping List App

## What this is
Shopping list app with sharing. FastAPI backend + React/Vite frontend + PostgreSQL. Monorepo: `backend/`, `frontend/`, `infra/` (Azure Bicep).

## Quick Start
```bash
cd backend && bash run.sh        # venv + PostgreSQL + uvicorn on :8000
cd backend && bash run.sh stop   # stops PostgreSQL container
cd backend && bash stop.sh       # kills uvicorn
cd frontend && bash run.sh       # installs deps + Vite dev server on :5173
```

## Dev Commands
```bash
# Backend tests (requires PostgreSQL running via docker compose)
cd backend && pytest                     # all tests
cd backend && pytest tests/test_unit/    # unit only
cd backend && pytest -m integration      # integration only
cd backend && pytest -m security         # security only
cd backend && pytest -v -k "test_name"   # single test

# Frontend
cd frontend && npm run build   # tsc -b && vite build
cd frontend && npm run lint    # eslint
```

## Critical Gotchas

- **`SECRET_KEY` required at import time** — `auth.py` reads it on module load, raises `RuntimeError` if missing. Must be in `.env` before starting server or running tests. Generate: `python -c 'import secrets; print(secrets.token_hex(32))'`
- **Registration requires invite code** — protected by `REGISTRATION_KEY` env var. In Azure, stored as a container app secret.
- **Tests require PostgreSQL** — conftest.py uses PostgreSQL (not SQLite). Start with `cd backend && docker compose up -d`. Each test gets fresh tables via `setup_database` fixture (create_all → drop_all).
- **No migration system** — `Base.metadata.create_all` on startup. Add new models to `models.py` directly.
- **Vite proxies `/api` → `http://localhost:8000`** — `VITE_API_URL` in `.env` is optional and rarely needed.
- **`bcrypt<4.1` pinned** — newer versions break passlib compatibility.
- **Offline queue uses localStorage** — `useOfflineQueue` hook stores pending changes under `pending_changes_{listId}`. No size limit enforcement yet. Changes persist across page refreshes but not across browser storage clears.

## Architecture

- All API routes use `/api/*` prefix except `/health`
- JWT auth via `python-jose`, passwords via `passlib` + `bcrypt`
- Async SQLAlchemy 2.0 with `asyncpg` (PostgreSQL)
- Share codes are UUIDs passed as `?share_code=...` query param
- Access model: owner, share code, public list, or anonymous list (no owner)
- CORS configurable via `ALLOWED_ORIGINS` (comma-separated, defaults to `http://localhost:5173`)
- `database.py` detects Azure URLs by checking for `azure` or `cloudapp` in connection string → enables SSL

## Azure Deployment

Deployed via `azd` to Azure Container Apps (not App Service).

```bash
cd infra && azd up              # provision + deploy
cd infra && azd provision       # provision only
cd infra && azd deploy --all    # deploy only
```

**Production URLs:**
- Frontend: `https://shoppinglist-web.victorioushill-2f5d1c85.northeurope.azurecontainerapps.io/`
- API: `https://shoppinglist-api.victorioushill-2f5d1c85.northeurope.azurecontainerapps.io/`

**CI:** `.github/workflows/test.yml` runs on push/PR to `main`. Python 3.11, PostgreSQL 16 service, SECRET_KEY + REGISTRATION_KEY set.

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
- `backend/main.py` — app entry point + all API routes
- `backend/models.py` — SQLAlchemy models (User, ShoppingList, ListItem)
- `backend/auth.py` — JWT + password hashing
- `backend/crud.py` — database operations
- `backend/database.py` — async engine + session setup
- `frontend/src/api/client.ts` — API client
- `frontend/src/App.tsx` — router + auth context
- `frontend/src/hooks/useOfflineQueue.ts` — offline mutation queue hook
- `infra/main.bicep` — Azure infrastructure
