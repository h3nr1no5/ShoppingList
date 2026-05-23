#!/usr/bin/env bash
#
# migrate_float_unit.sh
#
# Migration: Change list_items.quantity from INTEGER to DOUBLE PRECISION,
#            and add list_items.unit VARCHAR(20) with default 'pcs'.
#
# Idempotent: safe to run multiple times. Each SQL statement uses
# conditional guards (IF NOT EXISTS / type check) to avoid errors.
#
# Requires: docker, docker compose, and the PostgreSQL container defined
#           in ../docker-compose.yml.

set -euo pipefail

# ── Step 0: Navigate to backend/ ────────────────────────────────────────────
cd "$(dirname "$0")/.."
COMPOSE_FILE="docker-compose.yml"

# ── Step 1: Ensure PostgreSQL container is running ──────────────────────────
echo "➤ Checking PostgreSQL container (shoppinglist-db)…"

if docker ps --format '{{.Names}}' | grep -q '^shoppinglist-db$'; then
  echo "  ✔ Container already running."
else
  echo "  ⚠ Container not found. Starting via docker compose…"
  docker compose -f "$COMPOSE_FILE" up -d
  echo "  ✔ Container started."

  # Wait for PostgreSQL to become healthy (up to 30 s).
  echo "  ⏳ Waiting for PostgreSQL to become healthy…"
  for i in $(seq 1 30); do
    if docker exec shoppinglist-db pg_isready -U postgres >/dev/null 2>&1; then
      echo "  ✔ PostgreSQL is ready."
      break
    fi
    if [ "$i" -eq 30 ]; then
      echo "  ✘ ERROR: PostgreSQL did not become ready within 30 s."
      exit 1
    fi
    sleep 1
  done
fi

PSQL() {
  docker compose exec -T db psql -U postgres -d shoppinglist -c "$1"
}

# ── Step 2: ALTER COLUMN quantity → DOUBLE PRECISION ───────────────────────
echo ""
echo "➤ Migrating list_items.quantity to DOUBLE PRECISION…"

PSQL "
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_name  = 'list_items'
       AND column_name = 'quantity'
       AND data_type   = 'double precision'
  ) THEN
    ALTER TABLE list_items ALTER COLUMN quantity TYPE DOUBLE PRECISION;
    RAISE NOTICE 'quantity column migrated to DOUBLE PRECISION.';
  ELSE
    RAISE NOTICE 'quantity column already DOUBLE PRECISION – skipping.';
  END IF;
END \$\$;
"

echo "  ✔ Done."

# ── Step 3: ADD COLUMN unit (if not exists) ─────────────────────────────────
echo ""
echo "➤ Adding list_items.unit VARCHAR(20) DEFAULT 'pcs'…"

PSQL "
  ALTER TABLE list_items ADD COLUMN IF NOT EXISTS unit VARCHAR(20) NOT NULL DEFAULT 'pcs';
"

echo "  ✔ Done."

# ── Done ────────────────────────────────────────────────────────────────────
echo ""
echo "✓ Migration complete: quantity (DOUBLE PRECISION), unit (VARCHAR(20) DEFAULT 'pcs')."
