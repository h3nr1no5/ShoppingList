# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Smoke tests** — `backend/smoke_test.py` for post-deployment API validation
  - Exercises: health, SPA serving, registration, login, list CRUD, item CRUD
  - Runs via deploy workflow and scheduled `smoke.yml` workflow (every 15 min)
  - Usable locally via `python backend/smoke_test.py <BASE_URL> <REGISTRATION_KEY>`
- **E2E test suite** — Playwright-based browser tests covering user flows
  - Auth flows (login, registration, session management)
  - List CRUD operations
  - Item CRUD operations
  - Sharing flows
  - Offline queue behavior
  - Language switching
  - Theme switching
  - Navigation
  - `run-e2e-tests.sh` convenience script for local execution
  - CI integration via `frontend-e2e` job in test.yml
- **Duplicate item name validation** — Items with duplicate names in the same list are now rejected (validated on both add and edit)
- **Health check enhanced** — `/health` now probes database connectivity:
  - Returns 200 with `{"status": "healthy", "database": "ok"}` when DB is reachable
  - Returns 503 with `{"status": "degraded", "database": "unreachable"}` when DB is down
- **Static files safety check** — Server checks if static directory exists before mounting (prevents crash in dev mode without built frontend)
- **Offline queue** — Item mutations made while offline are queued in localStorage and auto-synced on reconnect
  - `useOfflineQueue` hook for managing pending changes
  - `ListDetail` and `SharedList` pages integrate queue + sync
  - Error differentiation: 404 (skip), 401 (notify), transient (retry)
  - Post-sync re-fetch for state reconciliation
  - 19 new tests for offline queue behavior

### Changed

- **CI/CD workflows updated**:
  - deploy.yml: Added smoke test step, updated to actions/checkout@v5
  - test.yml: Added `frontend-e2e` job with Playwright, runs on PR to main/dev
  - New smoke.yml: Scheduled smoke test every 15 minutes
- **Simplified deployment**: single container app, root Dockerfile, ghcr.io, GitHub Actions CI/CD
- Removed Express proxy server, separate frontend/backend Dockerfiles, ACR, Key Vault, 5 deployment hooks
- Frontend now served by FastAPI StaticFiles (same-origin, no VITE_API_URL needed in production)

### Deprecated

### Removed

### Fixed

- pytest.ini now ignores `smoke_test.py` to prevent pytest from picking it up
- Frontend-e2e CI job now runs on `dev` branch as well as `main`
- Error message verification in E2E tests for invalid list IDs
- Offline item updates no longer lost on page refresh or reconnect
- Failed online API calls now enqueue changes for retry

### Security

## [1.0.0] - 2026-05-05

### Added

#### Backend

- FastAPI REST API with async SQLAlchemy 2.0
- JWT authentication via python-jose with configurable token expiration
- User registration with invite code protection (`REGISTRATION_KEY`)
- Password hashing using bcrypt (< 4.1) via passlib
- PostgreSQL database support via asyncpg
- PostgreSQL for testing (via Docker)
- Shopping list CRUD operations (create, read, update, delete)
- List item management with name, quantity, checked status, and sort order
- UUID-based share codes for list sharing
- Flexible access control model:
  - Owner-only operations (delete list, generate share code)
  - Share code holders (read, update list and items)
  - Public lists (accessible without authentication)
  - Anonymous lists (no owner)
- Configurable CORS origins via `ALLOWED_ORIGINS`
- Azure PostgreSQL connection string detection with SSL support
- Health check endpoint at `/health`
- Swagger UI API documentation at `/api/docs`
- ReDoc API documentation at `/redoc`

#### Frontend

- React 19 with TypeScript and Vite build system
- React Router for client-side routing
- User authentication pages (login/register with invite code)
- Dashboard with shopping list overview
- List detail view for authenticated users
- Shared list view accessible via share code
- Shopping list creation and management
- Item management (add, check off, delete)
- Dark mode theme support via React context
- Responsive mobile-friendly UI
- Production Express server with Helmet security headers
- Content Security Policy (CSP) configuration

#### Infrastructure

- Azure Container Apps deployment (backend and frontend)
- Azure Database for PostgreSQL Flexible Server
- Bicep infrastructure as code
- Azure Developer CLI (azd) for deployment management
- GitHub Actions CI/CD workflow with:
  - Python 3.11 test environment
  - PostgreSQL 16 service container
  - Frontend build and linting
  - Backend security tests

#### Testing

- pytest test suite with pytest-asyncio
- Unit tests for core functionality
- Integration tests for API endpoints
- Security tests for authentication and authorization
- Test fixtures:
  - Authenticated and unauthenticated HTTP clients
  - Test user accounts with valid JWT tokens
  - Various list types (owner, public, anonymous, shared)
  - Automatic database setup/teardown per test

### Changed

- Backend uses async database operations throughout
- Frontend uses native Fetch API instead of external HTTP client
- Vite proxies `/api` requests to backend in development
- Production frontend runs on Express (port 8080) instead of Vite preview

### Deprecated

- `is_public` column in ShoppingList model (no longer used, but still exists in database)

### Removed

### Fixed

### Security

- JWT tokens with configurable expiration
- Password hashing with bcrypt (version pinned < 4.1 for passlib compatibility)
- Invite-only user registration
- Helmet CSP headers in production frontend
- CORS origin validation
- Share codes required for shared list access

[Unreleased]: https://github.com/shoppinglist/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/shoppinglist/releases/tag/v1.0.0