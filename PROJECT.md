# Shopping List App

A full-stack shopping list application with sharing capabilities. Built with FastAPI (backend), React + TypeScript + Vite (frontend), and PostgreSQL. Deployed to Azure Container Apps.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI, SQLAlchemy 2.0 (async), Uvicorn |
| **Frontend** | React 19, TypeScript, Vite, React Router, Axios |
| **Database** | PostgreSQL (async via asyncpg), SQLite (tests) |
| **Auth** | JWT (python-jose), bcrypt (passlib) |
| **Infra** | Azure Container Apps, Azure Database for PostgreSQL, Bicep |
| **CI/Testing** | pytest, pytest-asyncio, httpx, ESLint |

## Project Structure

```
ShoppingList/
├── AGENTS.md              # Agent instructions & command reference
├── DEPLOYMENT.md          # Azure deployment guide
├── PROJECT.md             # Project overview (this file)
├── azure.yaml             # Azure Developer CLI configuration
├── backend/               # FastAPI backend (Python)
│   ├── main.py            # App entry point & all API routes
│   ├── models.py          # SQLAlchemy ORM models (User, ShoppingList, ListItem)
│   ├── schemas.py         # Pydantic request/response schemas
│   ├── auth.py            # JWT auth, password hashing, token utilities
│   ├── crud.py            # Database CRUD operations
│   ├── database.py        # Async SQLAlchemy engine & session setup
│   ├── requirements.txt   # Python dependencies
│   ├── docker-compose.yml # Local PostgreSQL via Docker
│   ├── Dockerfile         # Backend container image
│   ├── run.sh             # Start script (creates venv, starts Postgres, runs uvicorn)
│   ├── stop.sh            # Stop script
│   └── tests/             # Test suite
│       ├── conftest.py    # Fixtures (authenticated clients, test data, clean DB)
│       ├── test_unit/     # Unit tests
│       ├── test_integration/  # Integration tests
│       └── test_security/     # Security tests
├── frontend/              # React frontend (TypeScript)
│   ├── src/
│   │   ├── App.tsx        # Router, protected routes, context providers
│   │   ├── main.tsx       # React entry point
│   │   ├── pages/         # Route pages
│   │   │   ├── Home.tsx           # Dashboard - list overview
│   │   │   ├── ListDetail.tsx     # Single list view (authenticated)
│   │   │   ├── SharedList.tsx     # Shared list view (via share code)
│   │   │   ├── Login.tsx          # Login page
│   │   │   └── Register.tsx       # Registration page (invite code required)
│   │   ├── components/    # Reusable UI components
│   │   │   ├── Header.tsx         # App header with nav
│   │   │   ├── ListForm.tsx       # Create/edit list form
│   │   │   ├── ItemForm.tsx       # Create/edit item form
│   │   │   ├── ListItem.tsx       # Single item display
│   │   │   ├── ShoppingListCard.tsx  # List card for dashboard
│   │   │   └── ShareModal.tsx     # Share code modal
│   │   ├── context/       # React contexts (Auth, Theme)
│   │   ├── api/           # API client utilities
│   │   └── types/         # TypeScript type definitions
│   ├── package.json       # Node dependencies
│   ├── vite.config.ts     # Vite config (proxies /api to backend)
│   ├── server.js          # Express production server
│   ├── Dockerfile         # Frontend container image
│   └── run.sh             # Start script (installs deps, runs Vite)
└── infra/                 # Azure infrastructure (Bicep)
    ├── main.bicep         # Infrastructure definition
    └── parameters.json    # Deployment parameters
```

## Features

- **User Authentication** — JWT-based login/registration with invite code protection
- **Shopping Lists** — Create, read, update, delete lists with items
- **List Items** — Add items with name, quantity, checked status, and sort order
- **Sharing** — Generate UUID-based share codes to share lists with others
- **Access Control** — Owner, share code, public list, or anonymous list (no owner)
- **Dark Mode** — Theme switching via React context
- **Responsive UI** — Mobile-friendly interface

## API Overview

All routes use `/api/*` prefix except `/health`.

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user (requires invite code) |
| POST | `/api/auth/login` | Login (OAuth2 form) |

### Lists

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/lists` | Auth required | Get all user's lists |
| POST | `/api/lists` | Auth required | Create new list |
| GET | `/api/lists/{id}` | Owner/share/public | Get list with items |
| PUT | `/api/lists/{id}` | Owner/share/public | Update list |
| DELETE | `/api/lists/{id}` | Owner only | Delete list |
| POST | `/api/lists/{id}/share` | Owner only | Generate share code |
| GET | `/api/lists/shared/{code}` | Public | Get list by share code |

### Items

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/lists/{id}/items` | Owner/share/public | Get all items |
| POST | `/api/lists/{id}/items` | Owner/share/public | Add item |
| PUT | `/api/items/{id}` | Owner/share/public | Update item |
| DELETE | `/api/items/{id}` | Owner/share/public | Delete item |

### Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/docs` | Swagger UI (dev) |

## Database Models

### User

- `id` (UUID), `email` (unique), `password_hash`, `created_at`

### ShoppingList

- `id` (UUID), `name`, `owner_id` (FK → User, nullable), `share_code` (UUID, nullable), `is_public`, `created_at`, `updated_at`

### ListItem

- `id` (UUID), `list_id` (FK → ShoppingList), `name`, `quantity`, `is_checked`, `sort_order`, `created_at`

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker (for local PostgreSQL)

### Backend

```bash
cd backend && bash run.sh          # starts everything (venv, Postgres, uvicorn on :8000)
cd backend && bash run.sh stop     # stops Postgres
cd backend && bash stop.sh         # kills uvicorn
```

### Frontend

```bash
cd frontend && bash run.sh         # installs deps, starts Vite dev server on :5173
```

## Environment Variables

**Backend** (`backend/.env`):

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes | JWT signing key (generate: `python -c 'import secrets; print(secrets.token_hex(32))'`) |
| `REGISTRATION_KEY` | Yes | Invite code for new user registration |
| `DATABASE_URL` | No | PostgreSQL URL (default: `postgresql+asyncpg://postgres:postgres@localhost:5432/shoppinglist`) |
| `AZURE_POSTGRESQL_CONNECTIONSTRING` | No | Azure connection string (overrides DATABASE_URL) |
| `ALLOWED_ORIGINS` | No | CORS origins (default: `http://localhost:5173`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | JWT expiry (default: 30) |

**Frontend** (`frontend/.env`):

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | Backend API URL (optional, Vite proxies by default) |

## Testing

```bash
cd backend && pytest                         # all tests (SQLite, isolated)
cd backend && pytest tests/test_unit/        # unit tests only
cd backend && pytest -m integration          # integration tests only
cd backend && pytest -m security             # security tests only
cd backend && pytest -v -k "test_name"       # single test
```

Tests use SQLite (not PostgreSQL). Fixtures in `conftest.py` provide authenticated clients, test data, and automatic DB cleanup.

## Azure Deployment

Deployed via Azure Developer CLI (`azd`) to Azure Container Apps.

```bash
cd infra && azd up          # provision + deploy
cd infra && azd provision   # provision only
cd infra && azd deploy      # deploy only
```

**Production URLs:**

- Frontend: `https://shoppinglist-web.victorioushill-2f5d1c85.northeurope.azurecontainerapps.io/`
- API: `https://shoppinglist-api.victorioushill-2f5d1c85.northeurope.azurecontainerapps.io/`

See `DEPLOYMENT.md` for full deployment guide.

## Key Design Decisions

- **No migration system** — Tables auto-created via `Base.metadata.create_all` on startup
- **Share codes as UUIDs** — Passed as query param `?share_code=...` or path param
- **Flexible access model** — Owner, share code holder, public list, or anonymous list
- **Async throughout** — Async SQLAlchemy, asyncpg, async FastAPI
- **Vite proxy for dev** — Frontend dev server proxies `/api` → `http://localhost:8000`
- **SQLite for tests** — Fast, isolated test runs without PostgreSQL dependency
