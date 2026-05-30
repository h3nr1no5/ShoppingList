"""
Security-focused tests for authentication.
"""
import uuid
import pytest
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from httpx import AsyncClient

from auth import create_access_token, SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES


@pytest.mark.security
@pytest.mark.postgresql
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
        expired_expire = datetime.now(timezone.utc) - timedelta(hours=1)
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
            "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
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
            "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
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


@pytest.mark.security
@pytest.mark.postgresql
class TestPasswordSecurity:
    """Tests for password hashing security."""

    async def test_password_is_hashed(self, test_user):
        """Stored password should be hashed, not plaintext."""
        assert test_user.password_hash != "TestPassword123!"
        assert len(test_user.password_hash) > 50  # bcrypt hashes are long

    async def test_hash_is_bcrypt_format(self):
        """Password hash should be in bcrypt format."""
        from auth import get_password_hash
        hashed = get_password_hash("TestPassword123!")
        assert hashed.startswith("$2")  # bcrypt hashes start with $2a, $2b, or $2y


@pytest.mark.security
@pytest.mark.postgresql
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


@pytest.mark.security
@pytest.mark.postgresql
class TestTokenExpiry:
    """Tests for token expiry configuration."""

    async def test_token_has_expiry(self, test_user):
        """Created token should have an expiry."""
        token = create_access_token(test_user.id, test_user.email)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert "exp" in payload

    async def test_token_expiry_is_in_future(self, test_user):
        """Token expiry should be in the future."""
        token = create_access_token(test_user.id, test_user.email)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        expiry = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        assert expiry > datetime.now(timezone.utc)

    async def test_token_expiry_matches_config(self, test_user):
        """Token expiry should match ACCESS_TOKEN_EXPIRE_MINUTES."""
        token = create_access_token(test_user.id, test_user.email)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        expiry = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        expected_expiry = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        # Allow 5 second tolerance for test execution time
        assert abs((expiry - expected_expiry).total_seconds()) < 5


@pytest.mark.security
@pytest.mark.postgresql
class TestPasswordResetSecurity:
    """Security tests for password reset functionality."""

    async def test_forgot_password_no_email_enumeration(self, client: AsyncClient, test_user):
        """Both existing and non-existing emails should return identical response body."""
        # Request for existing user
        response_existing = await client.post(
            "/api/auth/forgot-password",
            json={"email": test_user.email},
        )
        # Request for non-existing user
        response_nonexisting = await client.post(
            "/api/auth/forgot-password",
            json={"email": "nonexistent@example.com"},
        )

        assert response_existing.status_code == 200
        assert response_nonexisting.status_code == 200
        assert response_existing.json() == response_nonexisting.json()

    async def test_forgot_password_rate_limiting(self, client: AsyncClient):
        """Rapid forgot-password requests should eventually hit rate limit."""
        import os
        ratelimit_enabled = os.getenv("RATELIMIT_ENABLED", "true").lower() != "false"
        if not ratelimit_enabled:
            pytest.skip("Rate limiting is disabled")

        # Send requests rapidly — rate limit is 3/minute
        responses = []
        for i in range(5):
            response = await client.post(
                "/api/auth/forgot-password",
                json={"email": f"user{i}@example.com"},
            )
            responses.append(response.status_code)

        # At least one request should be rate-limited
        assert 429 in responses, f"Expected at least one 429 in {responses}"

    async def test_reset_password_rate_limiting(self, client: AsyncClient):
        """Rapid reset-password requests should eventually hit rate limit."""
        import os
        ratelimit_enabled = os.getenv("RATELIMIT_ENABLED", "true").lower() != "false"
        if not ratelimit_enabled:
            pytest.skip("Rate limiting is disabled")

        from datetime import datetime, timedelta, timezone
        from jose import jwt
        from auth import SECRET_KEY, ALGORITHM

        # Send requests rapidly — rate limit is 5/minute
        responses = []
        for i in range(7):
            future_expire = datetime.now(timezone.utc) + timedelta(minutes=15)
            payload = {
                "sub": f"user{i}@example.com",
                "exp": future_expire,
                "purpose": "password_reset",
            }
            token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
            response = await client.post(
                "/api/auth/reset-password",
                json={"token": token, "password": "NewPassword123!"},
            )
            responses.append(response.status_code)

        # At least one request should be rate-limited
        assert 429 in responses, f"Expected at least one 429 in {responses}"
