import os
os.environ['AZURE_POSTGRESQL_CONNECTIONSTRING'] = 'postgresql://postgresadmin:TestPassword123!@shoppinglist-postgres.postgres.database.azure.com:5432/shoppinglist?sslmode=require'

from database import DATABASE_URL, engine
print('DATABASE_URL:', DATABASE_URL[:80])

from sqlalchemy import text
import asyncio

async def check():
    async with engine.connect() as conn:
        # Check database exists
        result = await conn.execute(text("SELECT datname FROM pg_database WHERE datname='shoppinglist'"))
        print('Database exists:', result.fetchone())
        
        # Check tables
        result = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
        tables = result.fetchall()
        print('Tables:', tables)

asyncio.run(check())
