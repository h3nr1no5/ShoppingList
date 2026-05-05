"""
Test connection to Azure PostgreSQL using raw asyncpg.
"""
import asyncio
import asyncpg


async def test_connection():
    try:
        print("Attempting to connect to Azure PostgreSQL...")
        conn = await asyncpg.connect(
            host="shoppinglist-postgres.postgres.database.azure.com",
            port=5432,
            user="postgresadmin",
            password="I.gmH.,xCJNWi1s`",
            database="shoppinglist",
            ssl="require",
            timeout=30,
        )
        print("Connected successfully!")

        # Test a simple query
        result = await conn.fetchval("SELECT 1")
        print(f"Query result: {result}")

        await conn.close()
        print("Connection closed.")

    except Exception as e:
        print(f"Error: {type(e).__name__}: {e}")


asyncio.run(test_connection())