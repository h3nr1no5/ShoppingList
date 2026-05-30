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


@pytest.mark.integration
@pytest.mark.postgresql
class TestForgotPassword:
    """Tests for POST /api/auth/forgot-password."""

    async def test_forgot_password_existing_user(self, client: AsyncClient, test_user):
        """Should return 200 with message for existing user."""
        response = await client.post(
            "/api/auth/forgot-password",
            json={"email": test_user.email},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "If an account with that email exists, a password reset link has been sent."

    async def test_forgot_password_nonexistent_user(self, client: AsyncClient):
        """Should return 200 with same message for non-existing user (anti-enumeration)."""
        response = await client.post(
            "/api/auth/forgot-password",
            json={"email": "nonexistent@example.com"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "If an account with that email exists, a password reset link has been sent."

    async def test_forgot_password_invalid_email(self, client: AsyncClient):
        """Should return 422 for invalid email format."""
        response = await client.post(
            "/api/auth/forgot-password",
            json={"email": "not-an-email"},
        )
        assert response.status_code == 422


@pytest.mark.integration
@pytest.mark.postgresql
class TestResetPassword:
    """Tests for POST /api/auth/reset-password."""

    async def test_reset_password_success(self, client: AsyncClient, test_user):
        """Should reset password and allow login with new password."""
        from auth import create_password_reset_token

        # Create a reset token for the test user
        reset_token = create_password_reset_token(test_user.email)

        # Reset password
        new_password = "NewPassword123!"
        response = await client.post(
            "/api/auth/reset-password",
            json={"token": reset_token, "password": new_password},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Password has been reset successfully. You can now log in with your new password."

        # Verify login works with new password
        login_response = await client.post(
            "/api/auth/login",
            data={"username": test_user.email, "password": new_password},
        )
        assert login_response.status_code == 200
        assert "access_token" in login_response.json()

        # Verify old password no longer works
        old_login_response = await client.post(
            "/api/auth/login",
            data={"username": test_user.email, "password": "TestPassword123!"},
        )
        assert old_login_response.status_code == 401

    async def test_reset_password_invalid_token(self, client: AsyncClient):
        """Invalid reset token should return 400."""
        response = await client.post(
            "/api/auth/reset-password",
            json={"token": "invalid-token-value", "password": "NewPassword123!"},
        )
        assert response.status_code == 400
        data = response.json()
        assert "Invalid or expired reset token" in data["detail"]

    async def test_reset_password_expired_token(self, client: AsyncClient):
        """Expired reset token should return 400."""
        from datetime import datetime, timedelta, timezone
        from jose import jwt
        from auth import SECRET_KEY, ALGORITHM

        past_expire = datetime.now(timezone.utc) - timedelta(hours=1)
        payload = {
            "sub": "test@example.com",
            "exp": past_expire,
            "purpose": "password_reset",
        }
        expired_token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

        response = await client.post(
            "/api/auth/reset-password",
            json={"token": expired_token, "password": "NewPassword123!"},
        )
        assert response.status_code == 400
        data = response.json()
        assert "Invalid or expired reset token" in data["detail"]

    async def test_reset_password_short_password(self, client: AsyncClient, test_user):
        """Short password should return 422."""
        from auth import create_password_reset_token

        reset_token = create_password_reset_token(test_user.email)
        response = await client.post(
            "/api/auth/reset-password",
            json={"token": reset_token, "password": "short"},
        )
        assert response.status_code == 422

    async def test_reset_password_empty_token(self, client: AsyncClient):
        """Empty token should return 400."""
        response = await client.post(
            "/api/auth/reset-password",
            json={"token": "", "password": "NewPassword123!"},
        )
        assert response.status_code == 400

    async def test_reset_password_wrong_purpose(self, client: AsyncClient, test_user_token):
        """An access token used as reset token should return 400."""
        response = await client.post(
            "/api/auth/reset-password",
            json={"token": test_user_token, "password": "NewPassword123!"},
        )
        assert response.status_code == 400
        data = response.json()
        assert "Invalid or expired reset token" in data["detail"]