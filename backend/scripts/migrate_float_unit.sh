#!/usr/bin/env bash
#
# migrate_float_unit.sh
#
# Migration: Backup list_items, then change quantity from INTEGER to DOUBLE PRECISION,
#            and add list_items.unit VARCHAR(20) with default 'pcs'.
#
# Idempotent: safe to run multiple times. Each SQL statement uses
# conditional guards (IF NOT EXISTS / type check) to avoid errors.
#
# Supports three modes:
#   No args       — local Docker PostgreSQL container (docker-compose.yml)
#   --url <url>   — remote PostgreSQL via psql connection string
#   --azure       — Azure PostgreSQL Flexible Server (auto-detect or DATABASE_URL)

set -euo pipefail

# ── Step 0: Navigate to backend/ ────────────────────────────────────────────
cd "$(dirname "$0")/.."
COMPOSE_FILE="docker-compose.yml"

# ── Arg parsing ─────────────────────────────────────────────────────────────
DB_URL=""
AZURE_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)
      if [[ $# -lt 2 || "$2" == -* ]]; then
        echo "ERROR: --url requires a connection string argument." >&2
        exit 1
      fi
      DB_URL="$2"
      shift 2
      ;;
    --azure)
      AZURE_MODE=true
      shift
      ;;
    --help)
      cat <<EOF
Usage: bash migrate_float_unit.sh [OPTIONS]

Migrate list_items.quantity to DOUBLE PRECISION and add list_items.unit column.

Options:
  --url <DATABASE_URL>  PostgreSQL connection string (e.g. postgresql://user:pass@host/db)
  --azure               Auto-detect and migrate Azure PostgreSQL Flexible Server
  --help                Show this help message

Without options, migrates the local Docker PostgreSQL container (shoppinglist-db).
EOF
      exit 0
      ;;
    *)
      echo "ERROR: Unknown option: $1" >&2
      echo "Use --help for usage." >&2
      exit 1
      ;;
  esac
done

# Validate mutual exclusivity
if [ -n "$DB_URL" ] && [ "$AZURE_MODE" = true ]; then
  echo "ERROR: --url and --azure are mutually exclusive." >&2
  exit 1
fi

# ── Mode selection & PSQL() definition ──────────────────────────────────────

if [ -n "$DB_URL" ]; then
  # ── --url mode: use psql directly ───────────────────────────────────────
  PSQL() {
    psql "$DB_URL" -c "$1"
  }

elif [ "$AZURE_MODE" = true ]; then
  # ── --azure mode ────────────────────────────────────────────────────────

  # Check Azure CLI
  if ! command -v az >/dev/null 2>&1; then
    echo "ERROR: Azure CLI not found. Install from https://aka.ms/install-azure-cli" >&2
    exit 1
  fi

  if ! az account show >/dev/null 2>&1; then
    echo "ERROR: Not logged into Azure. Run 'az login' first." >&2
    exit 1
  fi

  # Prefer DATABASE_URL env var; fall back to auto-detection
  if [ -n "${DATABASE_URL:-}" ]; then
    # Use psql with the provided DATABASE_URL
    PSQL() {
      psql "$DATABASE_URL" -c "$1"
    }
  else
    # Auto-detect from Azure CLI context
    SERVER=$(az postgres flexible-server list --query '[0].name' -o tsv)
    if [ -z "$SERVER" ] || [ "$SERVER" = "null" ]; then
      echo "ERROR: No flexible server found." >&2
      exit 1
    fi

    RG=$(az postgres flexible-server list --query '[0].resourceGroup' -o tsv)
    ADMIN_USER=$(az postgres flexible-server show --name "$SERVER" --resource-group "$RG" --query 'administratorLogin' -o tsv)

    if [ -z "${AZ_PG_PASSWORD:-}" ]; then
      echo "ERROR: AZ_PG_PASSWORD env var not set. Set it to your Azure PostgreSQL admin password." >&2
      exit 1
    fi

    DB_NAME="${PGDATABASE:-shoppinglist}"

    # Summary and confirmation prompt
    echo ""
    echo "➤ Azure auto-detection:"
    echo "   Server:      $SERVER"
    echo "   Database:    $DB_NAME"
    echo "   Admin user:  $ADMIN_USER"
    echo ""
    read -r -p "Proceed? (y/N) " REPLY
    if [ "$REPLY" != "y" ] && [ "$REPLY" != "Y" ]; then
      echo "Aborted."
      exit 0
    fi

    PSQL() {
      az postgres flexible-server execute \
        --name "$SERVER" \
        --admin-user "$ADMIN_USER" \
        --admin-password "$AZ_PG_PASSWORD" \
        --database-name "$DB_NAME" \
        --querytext "$1"
    }
  fi

else
  # ── Docker mode (default): ensure local container is running ────────────
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
fi

# ── Step 1: Backup existing list_items ──────────────────────────────────────
echo ""
echo "➤ Creating pre-migration backup of list_items..."

PSQL "
  CREATE TABLE IF NOT EXISTS list_items_backup_20260526 AS
  SELECT * FROM list_items
"

echo "  ✔ Done."

# ── Step 3: ALTER COLUMN quantity → DOUBLE PRECISION ───────────────────────
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

# ── Step 4: ADD COLUMN unit (if not exists) ─────────────────────────────────
echo ""
echo "➤ Adding list_items.unit VARCHAR(20) DEFAULT 'pcs'…"

PSQL "
  ALTER TABLE list_items ADD COLUMN IF NOT EXISTS unit VARCHAR(20) NOT NULL DEFAULT 'pcs';
"

echo "  ✔ Done."

# ── Step 5: Cleanup backup table (keep only for migration window) ────────────
echo ""
echo "➤ Cleaning up backup table..."
PSQL "DROP TABLE IF EXISTS list_items_backup_20260526;"
echo "  ✔ Done."

# ── Done ────────────────────────────────────────────────────────────────────
echo ""
echo "✓ Migration complete: quantity (DOUBLE PRECISION), unit (VARCHAR(20) DEFAULT 'pcs')."
