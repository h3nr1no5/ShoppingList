"""
Script to delete all users from the database.
Deletes all users, which cascades to their owned shopping lists and items.
"""

import asyncio
import os
import sys

# Load environment variables BEFORE importing database module
from dotenv import load_dotenv
load_dotenv()

# Add the backend directory to the path so we can import from backend
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text, select

from database import get_database_url
from models import User


async def delete_all_users():
    """
    Delete all users from the database.
    Uses ORM deletion to trigger cascade to shopping lists and items.
    """
    database_url = get_database_url()

    # Create async engine with appropriate settings
    is_sqlite = "sqlite" in database_url
    engine_kwargs = {
        "echo": os.getenv("SQL_ECHO", "false").lower() == "true",
    }
    if not is_sqlite:
        engine_kwargs["pool_pre_ping"] = True
        engine_kwargs["pool_size"] = 10
        engine_kwargs["max_overflow"] = 20

    engine = create_async_engine(database_url, **engine_kwargs)

    async with AsyncSession(engine) as session:
        # Count users before deletion
        result = await session.execute(text("SELECT COUNT(*) FROM users"))
        count = result.scalar()

        if count == 0:
            print("No users found in the database.")
            await engine.dispose()
            return

        print(f"Found {count} user(s) in the database.")

        # Ask for confirmation
        confirmation = input("This will delete ALL users and their owned shopping lists. Continue? (yes/no): ")

        if confirmation.lower() != "yes":
            print("Operation cancelled.")
            await engine.dispose()
            return

        # Fetch and delete all users (ORM cascade handles lists and items)
        result = await session.execute(select(User))
        users = result.scalars().all()

        for user in users:
            await session.delete(user)

        await session.commit()

        print(f"Deleted {count} user(s) from the database.")

    await engine.dispose()


if __name__ == "__main__":
    # Run the async function
    asyncio.run(delete_all_users())
