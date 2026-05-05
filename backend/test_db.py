import os
os.environ['AZURE_POSTGRESQL_CONNECTIONSTRING'] = 'postgresql://postgresadmin:TestPassword123!@shoppinglist-postgres.postgres.database.azure.com:5432/shoppinglist?sslmode=require'

from database import DATABASE_URL, engine
print('DATABASE_URL:', DATABASE_URL[:80])

from sqlalchemy import text
import asyncio

async def test_connection():
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            print('Connection successful:', result.scalar())
            
            # Check database exists
            result = await conn.execute(text("SELECT datname FROM pg_database WHERE datname='shoppinglist'"))
            print('Database exists:', result.fetchone())
            
            # Check tables
            result = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
            tables = result.fetchall()
            print('Tables:', tables)
    except Exception as e:
        print('Connection failed:', e)

asyncio.run(test_connection())
