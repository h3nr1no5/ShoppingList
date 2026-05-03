"""
Test configuration and fixtures for the shopping list API.
"""
import os
import uuid
from typing import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

# Set SECRET_KEY BEFORE importing the app (auth.py reads it at import time)
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only-do-not-use-in-production"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_shopping_list.db"

from database import get_db, Base
from models import User, ShoppingList, ListItem
from auth import get_password_hash, create_access_token
from main import app

# Create test engine
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_shopping_list.db"
engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    """Override database dependency for testing."""
    async with TestSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
async def create_tables():
    """Create all tables before tests and drop after."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(autouse=True)
async def clean_database():
    """Clean up database after each test to ensure isolation."""
    yield
    # Clean up after the test - delete in reverse order for FK constraints
    async with TestSessionLocal() as session:
        for table in reversed(Base.metadata.sorted_tables):
            await session.execute(delete(table))
        await session.commit()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a clean database session for each test."""
    async with TestSessionLocal() as session:
        try:
            yield session
        finally:
            await session.rollback()
            await session.close()


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Provide an async test client."""
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user."""
    user = User(
        email="test@example.com",
        password_hash=get_password_hash("TestPassword123!"),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_user_2(db_session: AsyncSession) -> User:
    """Create a second test user."""
    user = User(
        email="test2@example.com",
        password_hash=get_password_hash("TestPassword456!"),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_user_token(test_user: User) -> str:
    """Generate a valid token for the test user."""
    return create_access_token(test_user.id, test_user.email)


@pytest.fixture
async def test_user_2_token(test_user_2: User) -> str:
    """Generate a valid token for the second test user."""
    return create_access_token(test_user_2.id, test_user_2.email)


@pytest.fixture
async def test_list(db_session: AsyncSession, test_user: User) -> ShoppingList:
    """Create a test shopping list owned by test_user."""
    shopping_list = ShoppingList(
        name="Test Shopping List",
        owner_id=test_user.id,
    )
    db_session.add(shopping_list)
    await db_session.commit()
    await db_session.refresh(shopping_list)
    return shopping_list


@pytest.fixture
async def test_list_public(db_session: AsyncSession, test_user: User) -> ShoppingList:
    """Create a public test shopping list."""
    shopping_list = ShoppingList(
        name="Public Shopping List",
        owner_id=test_user.id,
        is_public=True,
    )
    db_session.add(shopping_list)
    await db_session.commit()
    await db_session.refresh(shopping_list)
    return shopping_list


@pytest.fixture
async def test_list_no_owner(db_session: AsyncSession) -> ShoppingList:
    """Create a shopping list with no owner."""
    shopping_list = ShoppingList(
        name="Anonymous Shopping List",
        owner_id=None,
    )
    db_session.add(shopping_list)
    await db_session.commit()
    await db_session.refresh(shopping_list)
    return shopping_list


@pytest.fixture
async def test_list_with_share_code(db_session: AsyncSession, test_user: User) -> ShoppingList:
    """Create a shopping list with a share code."""
    shopping_list = ShoppingList(
        name="Shared Shopping List",
        owner_id=test_user.id,
        share_code=uuid.uuid4(),
    )
    db_session.add(shopping_list)
    await db_session.commit()
    await db_session.refresh(shopping_list)
    return shopping_list


@pytest.fixture
async def test_item(db_session: AsyncSession, test_list: ShoppingList) -> ListItem:
    """Create a test list item."""
    item = ListItem(
        list_id=test_list.id,
        name="Test Item",
        quantity=2,
        is_checked=False,
        sort_order=0,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


@pytest.fixture
async def authenticated_client(
    test_user_token: str,
) -> AsyncGenerator[AsyncClient, None]:
    """Provide an authenticated test client with isolated headers."""
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Authorization": f"Bearer {test_user_token}"},
    ) as ac:
        yield ac


@pytest.fixture
async def authenticated_client_2(
    test_user_2_token: str,
) -> AsyncGenerator[AsyncClient, None]:
    """Provide an authenticated test client for user 2 with isolated headers."""
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Authorization": f"Bearer {test_user_2_token}"},
    ) as ac:
        yield ac
