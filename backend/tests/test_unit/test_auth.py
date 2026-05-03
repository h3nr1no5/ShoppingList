"""
Unit tests for authentication functions.
"""
import uuid
import pytest
from jose import jwt

from auth import get_password_hash, verify_password, create_access_token, ALGORITHM, SECRET_KEY


class TestPasswordHashing:
    """Tests for password hashing and verification."""

    def test_hash_password_returns_string(self):
        """Password hash should be a non-empty string."""
        hashed = get_password_hash("TestPassword123!")
        assert isinstance(hashed, str)
        assert len(hashed) > 0

    def test_hash_password_produces_different_hashes(self):
        """Same password should produce different hashes (due to salt)."""
        hashed1 = get_password_hash("TestPassword123!")
        hashed2 = get_password_hash("TestPassword123!")
        assert hashed1 != hashed2

    def test_verify_password_correct(self):
        """Correct password should verify successfully."""
        password = "TestPassword123!"
        hashed = get_password_hash(password)
        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """Incorrect password should fail verification."""
        hashed = get_password_hash("TestPassword123!")
        assert verify_password("WrongPassword", hashed) is False

    def test_verify_password_empty_string(self):
        """Empty password should fail verification."""
        hashed = get_password_hash("TestPassword123!")
        assert verify_password("", hashed) is False

    def test_verify_password_different_hash(self):
        """Password verified against different hash should fail."""
        hashed1 = get_password_hash("TestPassword123!")
        hashed2 = get_password_hash("AnotherPassword456!")
        assert verify_password("TestPassword123!", hashed2) is False


class TestCreateAccessToken:
    """Tests for JWT token creation."""

    def test_create_token_returns_string(self):
        """Token should be a non-empty string."""
        token = create_access_token(uuid.uuid4(), "test@example.com")
        assert isinstance(token, str)
        assert len(token) > 0

    def test_create_token_contains_subject(self):
        """Token should contain the user ID as subject."""
        user_id = uuid.uuid4()
        token = create_access_token(user_id, "test@example.com")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == str(user_id)

    def test_create_token_contains_email(self):
        """Token should contain the email."""
        email = "test@example.com"
        token = create_access_token(uuid.uuid4(), email)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["email"] == email

    def test_create_token_contains_expiry(self):
        """Token should contain an expiry timestamp."""
        token = create_access_token(uuid.uuid4(), "test@example.com")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert "exp" in payload

    def test_create_token_different_users(self):
        """Tokens for different users should be different."""
        user1_id = uuid.uuid4()
        user2_id = uuid.uuid4()
        token1 = create_access_token(user1_id, "user1@example.com")
        token2 = create_access_token(user2_id, "user2@example.com")
        assert token1 != token2

    def test_create_token_without_email(self):
        """Token should be creatable without email."""
        user_id = uuid.uuid4()
        token = create_access_token(user_id)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == str(user_id)
        assert payload["email"] == ""
