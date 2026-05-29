"""
Database configuration module.
Handles PostgreSQL connection including Azure PostgreSQL connection string format.
"""
import logging
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base


logger = logging.getLogger(__name__)


Base = declarative_base()


def get_database_url() -> str:
    """
    Get database URL from DATABASE_URL environment variable.
    Fallback to Azure connection string if DATABASE_URL is not set.
    """
    # First try DATABASE_URL (set in Container App)
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        # Remove sslmode from query params (we handle SSL in engine args)
        if "?" in database_url:
            base, params = database_url.split("?", 1)
            # Filter out sslmode
            params = "&".join(
                p for p in params.split("&")
                if not p.startswith("sslmode=")
            )
            database_url = f"{base}?{params}" if params else base
        logger.info(f"Using DATABASE_URL (cleaned): {database_url[:50]}...")
        return database_url
    
    # Fallback to Azure connection string
    azure_connection_string = os.getenv("AZURE_POSTGRESQL_CONNECTIONSTRING")
    if azure_connection_string:
        # Convert to asyncpg format
        db_url = azure_connection_string.replace("postgresql://", "postgresql+asyncpg://")
        # Remove sslmode from URL (we handle SSL in engine args)
        if "?" in db_url:
            base, params = db_url.split("?", 1)
            params = "&".join(p for p in params.split("&") if not p.startswith("sslmode="))
            db_url = f"{base}?{params}" if params else base
        logger.info(f"Using AZURE_POSTGRESQL_CONNECTIONSTRING (converted): {db_url[:50]}...")
        return db_url
    
    # Default fallback
    default_url = "postgresql+asyncpg://postgres:postgres@localhost:5432/shoppinglist"
    logger.warning(f"No database URL found, using default: {default_url[:50]}...")
    return default_url


# Create async engine
DATABASE_URL = get_database_url()

# Pool settings only apply to PostgreSQL (not SQLite)
is_sqlite = "sqlite" in DATABASE_URL

engine_kwargs = {
    "echo": os.getenv("SQL_ECHO", "false").lower() == "true",
}
if not is_sqlite:
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20
    # Enable SSL only for Azure PostgreSQL (not for local Docker Postgres)
    # Azure requires SSL, local development does not
    if "azure" in DATABASE_URL.lower() or "cloudapp" in DATABASE_URL.lower():
        engine_kwargs["connect_args"] = {
            "ssl": True,
        }

engine = create_async_engine(DATABASE_URL, **engine_kwargs)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """
    Dependency for getting async database session.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """
    Initialize database tables and run schema migrations.
    """
    logger.info(f"Initializing database tables... (DATABASE_URL starts with: {DATABASE_URL[:30]}...)")
    try:
        async with engine.begin() as conn:
            # Log what tables will be created
            table_names = [table.name for table in Base.metadata.tables.values()]
            logger.info(f"Tables to create (if not exist): {table_names}")

            await conn.run_sync(Base.metadata.create_all)

            # ── Backup: snapshot list_items before migration ──
            logger.info("Creating pre-migration backup of list_items...")
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS list_items_backup_20260526 AS
                SELECT * FROM list_items
            """))

            # ── Migration 1: quantity INTEGER → DOUBLE PRECISION ──
            logger.info("Running migration: list_items.quantity → DOUBLE PRECISION...")
            await conn.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'list_items'
                        AND column_name = 'quantity'
                        AND data_type = 'double precision'
                    ) THEN
                        ALTER TABLE list_items
                        ALTER COLUMN quantity TYPE DOUBLE PRECISION;
                        RAISE NOTICE 'quantity column migrated to DOUBLE PRECISION.';
                    ELSE
                        RAISE NOTICE 'quantity column already DOUBLE PRECISION – skipping.';
                    END IF;
                END $$;
            """))

            # ── Migration 2: add unit column ──────────────────
            logger.info("Running migration: adding list_items.unit column...")
            await conn.execute(text("""
                ALTER TABLE list_items
                ADD COLUMN IF NOT EXISTS unit VARCHAR(20) NOT NULL DEFAULT 'pcs';
            """))

        logger.info("SUCCESS: Database tables initialized")
    except Exception as e:
        logger.error(f"ERROR: Failed to initialize database: {e}")
        logger.error(f"DATABASE_URL starts with: {DATABASE_URL[:50]}...")
        raise


async def drop_db():
    """
    Drop all database tables.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)