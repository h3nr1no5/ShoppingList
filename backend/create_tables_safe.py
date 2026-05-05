"""
Safe table creation script - only creates tables if they don't exist.
NO DATA IS DELETED.
"""
import asyncio
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from database import engine, Base
from models import User, ShoppingList, ListItem


async def create_tables_safe():
    """Create tables if they don't exist. No data is deleted."""
    logger.info("Starting safe table creation...")
    try:
        async with engine.begin() as conn:
            # This ONLY creates tables that don't exist
            # It NEVER drops or modifies existing tables
            await conn.run_sync(Base.metadata.create_all)
        logger.info("SUCCESS: Tables created (or already existed)")
    except Exception as e:
        logger.error(f"ERROR: Failed to create tables: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(create_tables_safe())