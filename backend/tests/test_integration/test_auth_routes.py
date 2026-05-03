"""
Integration tests for authentication routes.
"""
import pytest
from httpx import AsyncClient


class TestRegister:
    """Tests for POST /api/auth/register."""

    async def test_register_success(self, client: AsyncClient, monkeypatch):
        """Registering with valid data should return token."""
        monkeypatch.delenv("REGISTRATION_KEY", raising=False)
        response = await client.post(
            "/api/auth/register",
            json={"email": "newuser@example.com", "password": "password123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_register_duplicate_email(self, client: AsyncClient, test_user, monkeypatch):
        """Registering with duplicate email should return 400."""
        monkeypatch.delenv("REGISTRATION_KEY", raising=False)
        response = await client.post(
            "/api/auth/register",
            json={"email": test_user.email, "password": "password123"},
        )
        assert response.status_code == 400

    async def test_register_short_password(self, client: AsyncClient, monkeypatch):
        """Registering with short password should return 422."""
        monkeypatch.delenv("REGISTRATION_KEY", raising=False)
        response = await client.post(
            "/api/auth/register",
            json={"email": "user@example.com", "password": "short"},
        )
        assert response.status_code == 422

    async def test_register_invalid_email(self, client: AsyncClient, monkeypatch):
        """Registering with invalid email should return 422."""
        monkeypatch.delenv("REGISTRATION_KEY", raising=False)
        response = await client.post(
            "/api/auth/register",
            json={"email": "not-an-email", "password": "password123"},
        )
        assert response.status_code == 422

    async def test_register_missing_fields(self, client: AsyncClient, monkeypatch):
        """Registering with missing fields should return 422."""
        monkeypatch.delenv("REGISTRATION_KEY", raising=False)
        response = await client.post(
            "/api/auth/register",
            json={"email": "user@example.com"},
        )
        assert response.status_code == 422

    async def test_register_without_invite_code_when_registration_key_not_set(
        self, client: AsyncClient, monkeypatch
    ):
        """Registering without invite code when REGISTRATION_KEY is not set should succeed."""
        monkeypatch.delenv("REGISTRATION_KEY", raising=False)
        response = await client.post(
            "/api/auth/register",
            json={"email": "newuser_noinvite@example.com", "password": "password123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_register_with_valid_invite_code(
        self, client: AsyncClient, monkeypatch
    ):
        """Registering with valid invite code when REGISTRATION_KEY is set should succeed."""
        monkeypatch.setenv("REGISTRATION_KEY", "test-secret-key")
        response = await client.post(
            "/api/auth/register",
            json={
                "email": "newuser_validinvite@example.com",
                "password": "password123",
                "invite_code": "test-secret-key",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_register_with_invalid_invite_code(
        self, client: AsyncClient, monkeypatch
    ):
        """Registering with invalid invite code should succeed (registration is open)."""
        # Registration is now open to everyone, invite codes are ignored
        response = await client.post(
            "/api/auth/register",
            json={
                "email": "newuser_invalidinvite@example.com",
                "password": "password123",
                "invite_code": "wrong-code",
            },
        )
        assert response.status_code == 200
        assert "access_token" in response.json()

    async def test_register_missing_invite_code_when_required(
        self, client: AsyncClient, monkeypatch
    ):
        """Registering without invite code should succeed (registration is open)."""
        # Registration is now open to everyone, invite codes are ignored
        response = await client.post(
            "/api/auth/register",
            json={"email": "newuser_missinginvite@example.com", "password": "password123"},
        )
        assert response.status_code == 200
        assert "access_token" in response.json()


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
