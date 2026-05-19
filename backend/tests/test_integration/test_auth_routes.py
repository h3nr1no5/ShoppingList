"""
Integration tests for authentication routes.
"""
import os
from httpx import AsyncClient

import pytest


@pytest.mark.integration
@pytest.mark.postgresql
class TestRegister:
    """Tests for POST /api/auth/register."""

    async def test_register_success(self, client: AsyncClient):
        """Registering with valid invite code should return token."""
        response = await client.post(
            "/api/auth/register",
            json={"email": "newuser@example.com", "password": "password123", "invite_code": os.environ["REGISTRATION_KEY"]},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_register_duplicate_email(self, client: AsyncClient, test_user):
        """Registering with duplicate email should return 400."""
        response = await client.post(
            "/api/auth/register",
            json={"email": test_user.email, "password": "password123", "invite_code": os.environ["REGISTRATION_KEY"]},
        )
        assert response.status_code == 400

    async def test_register_short_password(self, client: AsyncClient):
        """Registering with short password should return 422."""
        response = await client.post(
            "/api/auth/register",
            json={"email": "user@example.com", "password": "short", "invite_code": os.environ["REGISTRATION_KEY"]},
        )
        assert response.status_code == 422

    async def test_register_invalid_email(self, client: AsyncClient):
        """Registering with invalid email should return 422."""
        response = await client.post(
            "/api/auth/register",
            json={"email": "not-an-email", "password": "password123", "invite_code": os.environ["REGISTRATION_KEY"]},
        )
        assert response.status_code == 422

    async def test_register_missing_fields(self, client: AsyncClient):
        """Registering with missing fields should return 422."""
        response = await client.post(
            "/api/auth/register",
            json={"email": "user@example.com"},
        )
        assert response.status_code == 422

    async def test_register_without_invite_code(self, client: AsyncClient):
        """Registering without invite code should return 400."""
        response = await client.post(
            "/api/auth/register",
            json={"email": "newuser_noinvite@example.com", "password": "password123"},
        )
        assert response.status_code == 400

    async def test_register_with_invalid_invite_code(self, client: AsyncClient):
        """Registering with invalid invite code should return 400."""
        response = await client.post(
            "/api/auth/register",
            json={
                "email": "newuser_invalidinvite@example.com",
                "password": "password123",
                "invite_code": "wrong-code",
            },
        )
        assert response.status_code == 400


@pytest.mark.integration
@pytest.mark.postgresql
class TestLogin:
    """Tests for POST /api/auth/login."""

    async def test_login_success(self, client: AsyncClient, test_user):
        """Login with correct credentials should return token."""
        response = await client.post(
            "/api/auth/login",
            data={"username": test_user.email, "password": "TestPassword123!"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client: AsyncClient, test_user):
        """Login with wrong password should return 401."""
        response = await client.post(
            "/api/auth/login",
            data={"username": test_user.email, "password": "WrongPassword"},
        )
        assert response.status_code == 401

    async def test_login_nonexistent_user(self, client: AsyncClient):
        """Login with nonexistent email should return 401."""
        response = await client.post(
            "/api/auth/login",
            data={"username": "nonexistent@example.com", "password": "password"},
        )
        assert response.status_code == 401

    async def test_login_missing_credentials(self, client: AsyncClient):
        """Login without credentials should return 422."""
        response = await client.post("/api/auth/login")
        assert response.status_code == 422