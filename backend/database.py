"""
Database configuration module.
Handles PostgreSQL connection including Azure PostgreSQL connection string format.
"""
import os
from typing import Optional
from urllib.parse import unquote

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import URL


Base = declarative_base()


def get_database_url() -> str:
    """
    Build database URL from environment variables.
    Supports both regular PostgreSQL and Azure PostgreSQL connection string.
    """
    # Check for Azure PostgreSQL connection string first
    azure_connection_string = os.getenv("AZURE_POSTGRESQL_CONNECTIONSTRING")
    
    if azure_connection_string:
        # Parse Azure format: postgresql://user:password@host:port/dbname?sslmode=require
        # Replace postgresql:// with postgresql+asyncpg:// for async driver
        db_url = azure_connection_string.replace("postgresql://", "postgresql+asyncpg://")
        
        # URL decode user and password in case they contain special characters
        # Extract user:password@host:port/dbname?sslmode=require
        if "@" in db_url:
            scheme_part, host_part = db_url.split("@", 1)
            # Remove sslmode query param - we pass SSL as engine arg instead
            if "?" in host_part:
                host_port_db, query_params = host_part.split("?", 1)
                # Filter out sslmode as we'll handle SSL in engine args
                query_params = "&".join(p for p in query_params.split("&") if not p.startswith("sslmode="))
                if query_params:
                    host_part = f"{host_port_db}?{query_params}"
                else:
                    host_part = host_port_db
            else:
                host_part = host_part
            
            host_port_db = host_part
            host, port_db = host_port_db.split("/", 1)
            host, port = host.split(":", 1)
            db_name = port_db
            
            # Get user and password from scheme part
            # postgresql+asyncpg://user:password -> user:password
            auth_part = scheme_part.replace("postgresql+asyncpg://", "")
            user, password = auth_part.split(":", 1)
            
            # Rebuild URL with decoded credentials (without sslmode - will be added as engine arg)
            db_url = f"postgresql+asyncpg://{unquote(user)}:{unquote(password)}@{host}:{port}/{db_name}"
        
        return db_url
    
    # Use regular DATABASE_URL environment variable
    database_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/shoppinglist")
    return database_url


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
    Initialize database tables.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_db():
    """
    Drop all database tables.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)