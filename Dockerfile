# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Python runtime
FROM python:3.11-slim
WORKDIR /app

# Install runtime system dependencies (ca-certificates for Azure PostgreSQL SSL)
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libcap2 libsystemd0 libudev1 && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --upgrade pip setuptools wheel \
    && pip uninstall -y pip setuptools

# Copy backend application code
COPY backend/ .

# Copy built frontend to /app/static (matches STATIC_DIR default)
COPY --from=frontend-builder /app/frontend/dist /app/static

EXPOSE 8000
USER nobody
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]