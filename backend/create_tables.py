"""
Script to create tables in Azure PostgreSQL database.
Uses SQLAlchemy's create_all() to create tables based on defined models.
"""
import asyncio
import os
import sys

# Add the backend directory to the path so we can import modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set the Azure PostgreSQL connection string before importing database
# Format: postgresql://user:password@host:port/dbname?sslmode=require
# Note: Password contains backtick ` which needs to be URL-encoded
os.environ["AZURE_POSTGRESQL_CONNECTIONSTRING"] = (
    "postgresql://postgresadmin:I.gmH.%2CxCJNWi1s%60@shoppinglist-postgres.postgres.database.azure.com:5432/shoppinglist?sslmode=require"
)

from database import engine, Base
from models import User, ShoppingList, ListItem

# Add connection timeout to prevent hanging
import asyncpg
original_connect = asyncpg.connect

async def connect_with_timeout(*args, **kwargs):
    kwargs.setdefault("timeout", 30)
    return await original_connect(*args, **kwargs)

asyncpg.connect = connect_with_timeout


async def create_tables():
    """Create all tables in the Azure PostgreSQL database."""
    print("Connecting to Azure PostgreSQL...")
    print(f"Server: shoppinglist-postgres.postgres.database.azure.com")
    print(f"Database: shoppinglist")

    try:
        # Test the connection first
        print("\nTesting connection...")
        async with engine.connect() as conn:
            print("Connection successful!")
            # Create all tables defined in models
            print("\nCreating tables...")
            await conn.run_sync(Base.metadata.create_all)

        print("\nSUCCESS: Tables created successfully!")
        print("\nCreated tables:")
        print("  - users")
        print("  - shopping_lists")
        print("  - list_items")

    except Exception as e:
        import traceback
        print(f"\nERROR: Failed to create tables: {e}")
        traceback.print_exc()
        sys.exit(1)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(create_tables())