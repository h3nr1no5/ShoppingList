# Build stage — compile C extensions and install Python dependencies
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies (gcc for bcrypt, cryptography C extensions)
RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

# Copy requirements and install all Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Production stage — runtime only, no build tooling
FROM python:3.11-slim

WORKDIR /app

# Install only runtime system dependencies (psql for health checks / ad-hoc queries)
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages and CLI entrypoints from builder
# This includes uvicorn, fastapi, sqlalchemy, asyncpg, etc.
# gcc, apt cache, and build artifacts stay in the builder stage
COPY --from=builder /usr/local/ /usr/local/

# Copy application code (.dockerignore filters out tests, venv, __pycache__, etc.)
COPY . .

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]