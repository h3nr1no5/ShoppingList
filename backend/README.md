# Shopping List App - Backend

FastAPI backend with JWT authentication, PostgreSQL database, and shopping list management.

## Getting Started

### Prerequisites

- Python 3.11+
- PostgreSQL (via Docker) or a local PostgreSQL installation
- Docker and Docker Compose (for running PostgreSQL locally)

### Local Development

```bash
cd backend
bash run.sh
```

This script will:

1. Create a Python virtual environment if one doesn't exist
2. Install dependencies from `requirements.txt`
3. Copy `.env.example` to `.env` if no `.env` file exists
4. Start a PostgreSQL container using Docker Compose
5. Wait for PostgreSQL to be ready
6. Start the FastAPI server on `http://localhost:8000`

To stop the PostgreSQL container:

```bash
cd backend
bash run.sh stop
```

Alternatively, you can run the server directly with uvicorn:

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Generating a SECRET_KEY

The `SECRET_KEY` is required for JWT token signing and must be set in the environment before starting the server. Generate a secure key with:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Add the generated key to your `.env` file:

```
SECRET_KEY=your-generated-secret-key
```

> **Note:** The server will raise a `RuntimeError` if `SECRET_KEY` is not set when importing the auth module.

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SECRET_KEY` | JWT signing key (generate with `python -c 'import secrets; print(secrets.token_hex(32))'`) | Yes | - |
| `DATABASE_URL` | PostgreSQL connection string (e.g., `postgresql+asyncpg://user:pass@host:5432/dbname`) | No | `postgresql+asyncpg://postgres:postgres@localhost:5432/shoppinglist` |
| `AZURE_POSTGRESQL_CONNECTIONSTRING` | Azure PostgreSQL connection string (will be parsed to extract DATABASE_URL) | No | - |
| `REGISTRATION_KEY` | Invite code required for user registration | No | - |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | No | `http://localhost:5173` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT token expiration time | No | `30` |
| `SQL_ECHO` | Enable SQL query logging | No | `false` |

### Registration Key

Set the invite code in your `.env` file:

```
REGISTRATION_KEY=[your-registration-key]
```

## Testing

The test suite uses SQLite instead of PostgreSQL for isolation and speed. The test database file is created automatically in the backend directory.

Run all tests:

```bash
cd backend
pytest
```

Run specific test categories using markers:

```bash
# Unit tests only
pytest -m unit

# Integration tests only
pytest -m integration

# Security tests only
pytest -m security
```

Run a specific test by name:

```bash
pytest -v -k "test_login"
```

## Azure Deployment

### Container App URL

The backend is deployed as an Azure Container App:

- **API URL**: https://shoppinglist-api.victorioushill-2f5d1c85.northeurope.azurecontainerapps.io/
- **API Docs**: https://shoppinglist-api.victorioushill-2f5d1c85.northeurope.azurecontainerapps.io/docs

### Deploying to Azure

The app uses Azure Developer CLI (`azd`) for deployment. From the `infra/` directory:

```bash
cd infra

# Provision infrastructure (first time only)
azd provision

# Deploy the backend service
azd deploy --service api
```

### Secret Configuration

In Azure Container Apps, secrets are configured at the container app level. Set the following secrets:

- `SECRET_KEY` — JWT signing key (generate as shown above)
- `REGISTRATION_KEY` — Set to your invite code

Configure secrets via the Azure portal or Azure CLI:

```bash
azd env set SECRET_KEY "your-generated-secret-key"
azd env set REGISTRATION_KEY "[your-registration-key]"
```

## API Documentation

Interactive API documentation is available at:

**Swagger UI**: https://shoppinglist-api.victorioushill-2f5d1c85.northeurope.azurecontainerapps.io/docs

**ReDoc**: https://shoppinglist-api.victorioushill-2f5d1c85.northeurope.azurecontainerapps.io/redoc

## Architecture

- **Framework**: FastAPI
- **Database**: PostgreSQL with async SQLAlchemy 2.0
- **Authentication**: JWT via `python-jose`
- **Password Hashing**: `bcrypt` (< 4.1)
- **Database Driver**: `asyncpg` (production) / `aiosqlite` (tests)
- **CORS**: Configurable via `ALLOWED_ORIGINS`

## Project Structure

```
backend/
├── main.py          # FastAPI application entry point
├── models.py        # SQLAlchemy models
├── schemas.py       # Pydantic schemas
├── crud.py          # Database operations
├── auth.py          # Authentication utilities
├── database.py      # Database configuration
├── requirements.txt # Python dependencies
├── run.sh          # Local development script
└── docker-compose.yml  # PostgreSQL container
```

## License

MIT