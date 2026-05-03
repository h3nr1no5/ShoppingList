"""
Unit tests for Pydantic schemas.
"""
import uuid
from datetime import datetime

import pytest
from pydantic import ValidationError

from schemas import (
    UserCreate,
    UserLogin,
    TokenResponse,
    TokenData,
    ShoppingListCreate,
    ShoppingListUpdate,
    ShoppingListResponse,
    ShoppingListWithItemsResponse,
    ShareCodeResponse,
    ListItemCreate,
    ListItemUpdate,
    ListItemResponse,
    ErrorResponse,
    MessageResponse,
)


class TestUserCreate:
    def test_valid_user_create(self):
        data = UserCreate(email="test@example.com", password="password123")
        assert data.email == "test@example.com"
        assert data.password == "password123"

    def test_invalid_email(self):
        with pytest.raises(ValidationError):
            UserCreate(email="not-an-email", password="password123")

    def test_password_too_short(self):
        with pytest.raises(ValidationError) as exc_info:
            UserCreate(email="test@example.com", password="short")
        assert "8 characters" in str(exc_info.value)

    def test_password_minimum_length(self):
        data = UserCreate(email="test@example.com", password="12345678")
        assert data.password == "12345678"

    def test_missing_email(self):
        with pytest.raises(ValidationError):
            UserCreate(password="password123")

    def test_missing_password(self):
        with pytest.raises(ValidationError):
            UserCreate(email="test@example.com")


class TestUserLogin:
    def test_valid_user_login(self):
        data = UserLogin(email="test@example.com", password="password123")
        assert data.email == "test@example.com"
        assert data.password == "password123"

    def test_invalid_email(self):
        with pytest.raises(ValidationError):
            UserLogin(email="not-an-email", password="password123")


class TestTokenResponse:
    def test_default_token_type(self):
        data = TokenResponse(access_token="test-token")
        assert data.access_token == "test-token"
        assert data.token_type == "bearer"

    def test_custom_token_type(self):
        data = TokenResponse(access_token="test-token", token_type="custom")
        assert data.token_type == "custom"


class TestTokenData:
    def test_with_user_id(self):
        user_id = uuid.uuid4()
        data = TokenData(user_id=user_id)
        assert data.user_id == user_id

    def test_default_none(self):
        data = TokenData()
        assert data.user_id is None


class TestShoppingListCreate:
    def test_valid_create(self):
        data = ShoppingListCreate(name="Groceries")
        assert data.name == "Groceries"

    def test_missing_name(self):
        with pytest.raises(ValidationError):
            ShoppingListCreate()


class TestShoppingListUpdate:
    def test_update_name(self):
        data = ShoppingListUpdate(name="New Name")
        assert data.name == "New Name"
        assert data.is_public is None

    def test_update_is_public(self):
        data = ShoppingListUpdate(is_public=True)
        assert data.is_public is True
        assert data.name is None

    def test_update_both_fields(self):
        data = ShoppingListUpdate(name="New Name", is_public=True)
        assert data.name == "New Name"
        assert data.is_public is True

    def test_all_fields_optional(self):
        data = ShoppingListUpdate()
        assert data.name is None
        assert data.is_public is None


class TestShoppingListResponse:
    def test_valid_response(self):
        now = datetime.utcnow()
        data = ShoppingListResponse(
            id=uuid.uuid4(),
            name="Groceries",
            owner_id=uuid.uuid4(),
            share_code=None,
            is_public=False,
            created_at=now,
            updated_at=now,
        )
        assert data.name == "Groceries"
        assert data.is_public is False
        assert data.share_code is None

    def test_from_attributes(self):
        class MockList:
            id = uuid.uuid4()
            name = "Test"
            owner_id = uuid.uuid4()
            share_code = uuid.uuid4()
            is_public = True
            created_at = datetime.utcnow()
            updated_at = datetime.utcnow()

        mock = MockList()
        data = ShoppingListResponse.model_validate(mock)
        assert data.name == "Test"
        assert data.is_public is True


class TestShoppingListWithItemsResponse:
    def test_with_empty_items(self):
        now = datetime.utcnow()
        data = ShoppingListWithItemsResponse(
            id=uuid.uuid4(),
            name="Groceries",
            owner_id=None,
            share_code=None,
            is_public=False,
            created_at=now,
            updated_at=now,
            items=[],
        )
        assert data.items == []

    def test_with_items(self):
        now = datetime.utcnow()
        list_id = uuid.uuid4()
        item = ListItemResponse(
            id=uuid.uuid4(),
            list_id=list_id,
            name="Milk",
            quantity=1,
            is_checked=False,
            sort_order=0,
            created_at=now,
        )
        data = ShoppingListWithItemsResponse(
            id=list_id,
            name="Groceries",
            owner_id=None,
            share_code=None,
            is_public=False,
            created_at=now,
            updated_at=now,
            items=[item],
        )
        assert len(data.items) == 1
        assert data.items[0].name == "Milk"


class TestShareCodeResponse:
    def test_valid_share_code(self):
        code = uuid.uuid4()
        data = ShareCodeResponse(share_code=code)
        assert data.share_code == code


class TestListItemCreate:
    def test_valid_create(self):
        data = ListItemCreate(name="Milk")
        assert data.name == "Milk"
        assert data.quantity == 1
        assert data.is_checked is False

    def test_custom_quantity(self):
        data = ListItemCreate(name="Eggs", quantity=12)
        assert data.quantity == 12

    def test_checked_item(self):
        data = ListItemCreate(name="Bread", is_checked=True)
        assert data.is_checked is True

    def test_missing_name(self):
        with pytest.raises(ValidationError):
            ListItemCreate()


class TestListItemUpdate:
    def test_update_name(self):
        data = ListItemUpdate(name="New Name")
        assert data.name == "New Name"

    def test_update_quantity(self):
        data = ListItemUpdate(quantity=5)
        assert data.quantity == 5

    def test_update_is_checked(self):
        data = ListItemUpdate(is_checked=True)
        assert data.is_checked is True

    def test_update_sort_order(self):
        data = ListItemUpdate(sort_order=10)
        assert data.sort_order == 10

    def test_all_fields_optional(self):
        data = ListItemUpdate()
        assert data.name is None
        assert data.quantity is None
        assert data.is_checked is None
        assert data.sort_order is None

    def test_update_multiple_fields(self):
        data = ListItemUpdate(name="Milk", quantity=2, is_checked=True)
        assert data.name == "Milk"
        assert data.quantity == 2
        assert data.is_checked is True


class TestListItemResponse:
    def test_valid_response(self):
        now = datetime.utcnow()
        list_id = uuid.uuid4()
        data = ListItemResponse(
            id=uuid.uuid4(),
            list_id=list_id,
            name="Milk",
            quantity=1,
            is_checked=False,
            sort_order=0,
            created_at=now,
        )
        assert data.name == "Milk"
        assert data.list_id == list_id


class TestErrorResponse:
    def test_valid_error(self):
        data = ErrorResponse(detail="Something went wrong")
        assert data.detail == "Something went wrong"


class TestMessageResponse:
    def test_valid_message(self):
        data = MessageResponse(message="Success")
        assert data.message == "Success"
