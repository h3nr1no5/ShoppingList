"""
Security-focused tests for authentication.
"""
import uuid
import pytest
from datetime import datetime, timedelta
from jose import jwt, JWTError
from httpx import AsyncClient

from auth import create_access_token, SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES


class TestTokenValidation:
    """Tests for JWT token validation security."""

    async def test_invalid_token_format(self, client: AsyncClient):
        """Malformed token should return 401."""
        response = await client.get(
            "/api/lists",
            headers={"Authorization": "Bearer invalid-token-format"},
        )
        assert response.status_code == 401

    async def test_expired_token(self, client: AsyncClient, test_user):
        """Expired token should return 401."""
        # Create an expired token
        expired_expire = datetime.utcnow() - timedelta(hours=1)
        expired_payload = {
            "sub": str(test_user.id),
            "email": test_user.email,
            "exp": expired_expire,
        }
        expired_token = jwt.encode(expired_payload, SECRET_KEY, algorithm=ALGORITHM)
        
        response = await client.get(
            "/api/lists",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401

    async def test_token_with_missing_subject(self, client: AsyncClient):
        """Token without 'sub' claim should return 401."""
        payload = {
            "email": "test@example.com",
            "exp": datetime.utcnow() + timedelta(minutes=30),
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        
        response = await client.get(
            "/api/lists",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401

    async def test_token_with_invalid_uuid(self, client: AsyncClient):
        """Token with invalid UUID as subject should return 401."""
        payload = {
            "sub": "not-a-uuid",
            "email": "test@example.com",
            "exp": datetime.utcnow() + timedelta(minutes=30),
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        
        response = await client.get(
            "/api/lists",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401

    async def test_token_for_nonexistent_user(self, client: AsyncClient):
        """Token for deleted/nonexistent user should return 401."""
        nonexistent_id = uuid.uuid4()
        token = create_access_token(nonexistent_id, "ghost@example.com")
        
        response = await client.get(
            "/api/lists",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401

    async def test_empty_token(self, client: AsyncClient):
        """Empty bearer token should return 401."""
        response = await client.get(
            "/api/lists",
            headers={"Authorization": "Bearer "},
        )
        assert response.status_code == 401

    async def test_no_token(self, client: AsyncClient):
        """Request without token should return 401 for protected endpoints."""
        response = await client.get("/api/lists")
        assert response.status_code == 401

    async def test_bearer_prefix_missing(self, client: AsyncClient, test_user_token):
        """Token without 'Bearer' prefix should be rejected."""
        response = await client.get(
            "/api/lists",
            headers={"Authorization": test_user_token},
        )
        assert response.status_code == 401


class TestPasswordSecurity:
    """Tests for password hashing security."""

    def test_password_is_hashed(self, test_user):
        """Stored password should be hashed, not plaintext."""
        assert test_user.password_hash != "TestPassword123!"
        assert len(test_user.password_hash) > 50  # bcrypt hashes are long

    def test_hash_is_bcrypt_format(self):
        """Password hash should be in bcrypt format."""
        from auth import get_password_hash
        hashed = get_password_hash("TestPassword123!")
        assert hashed.startswith("$2")  # bcrypt hashes start with $2a, $2b, or $2y


class TestAuthorizationEdgeCases:
    """Tests for authorization edge cases."""

    async def test_create_list_requires_auth(self, client: AsyncClient):
        """Creating list should require authentication."""
        response = await client.post("/api/lists", json={"name": "Test"})
        assert response.status_code == 401

    async def test_delete_list_requires_auth(self, client: AsyncClient, test_list):
        """Deleting list should require authentication."""
        response = await client.delete(f"/api/lists/{test_list.id}")
        assert response.status_code == 401

    async def test_share_code_endpoint_requires_auth(self, client: AsyncClient, test_list):
        """Generating share code should require authentication."""
        response = await client.post(f"/api/lists/{test_list.id}/share")
        assert response.status_code == 401

    async def test_login_invalid_content_type(self, client: AsyncClient):
        """Login with JSON instead of form data should fail."""
        response = await client.post(
            "/api/auth/login",
            json={"username": "test@example.com", "password": "password"},
        )
        assert response.status_code == 422

    async def test_sql_injection_in_email(self, client: AsyncClient):
        """SQL injection attempt in email should not bypass auth."""
        response = await client.post(
            "/api/auth/login",
            data={
                "username": "test@example.com' OR '1'='1",
                "password": "password",
            },
        )
        assert response.status_code == 401

    async def test_xss_in_list_name(self, authenticated_client: AsyncClient):
        """XSS attempt in list name should be stored as-is (handled by frontend)."""
        response = await authenticated_client.post(
            "/api/lists",
            json={"name": "<script>alert('xss')</script>"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "<script>alert('xss')</script>"


class TestTokenExpiry:
    """Tests for token expiry configuration."""

    def test_token_has_expiry(self, test_user):
        """Created token should have an expiry."""
        token = create_access_token(test_user.id, test_user.email)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert "exp" in payload

    def test_token_expiry_is_in_future(self, test_user):
        """Token expiry should be in the future."""
        token = create_access_token(test_user.id, test_user.email)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        expiry = datetime.utcfromtimestamp(payload["exp"])
        assert expiry > datetime.utcnow()

    def test_token_expiry_matches_config(self, test_user):
        """Token expiry should match ACCESS_TOKEN_EXPIRE_MINUTES."""
        token = create_access_token(test_user.id, test_user.email)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        expiry = datetime.utcfromtimestamp(payload["exp"])
        expected_expiry = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        # Allow 5 second tolerance for test execution time
        assert abs((expiry - expected_expiry).total_seconds()) < 5
