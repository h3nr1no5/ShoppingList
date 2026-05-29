"""
Unit tests for Pydantic schemas.
"""
import os
import uuid
from datetime import datetime, timezone

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


@pytest.mark.unit
class TestUserCreate:
    def test_valid_user_create(self):
        data = UserCreate(email="test@example.com", password="password123", invite_code=os.environ["REGISTRATION_KEY"])
        assert data.email == "test@example.com"
        assert data.password == "password123"

    def test_invalid_email(self):
        with pytest.raises(ValidationError):
            UserCreate(email="not-an-email", password="password123", invite_code=os.environ["REGISTRATION_KEY"])

    def test_password_too_short(self):
        with pytest.raises(ValidationError) as exc_info:
            UserCreate(email="test@example.com", password="short", invite_code=os.environ["REGISTRATION_KEY"])
        assert "8 characters" in str(exc_info.value)

    def test_password_minimum_length(self):
        data = UserCreate(email="test@example.com", password="12345678", invite_code=os.environ["REGISTRATION_KEY"])
        assert data.password == "12345678"

    def test_missing_email(self):
        with pytest.raises(ValidationError):
            UserCreate(password="password123", invite_code=os.environ["REGISTRATION_KEY"])

    def test_missing_password(self):
        with pytest.raises(ValidationError):
            UserCreate(email="test@example.com", invite_code=os.environ["REGISTRATION_KEY"])


@pytest.mark.unit
class TestUserLogin:
    def test_valid_user_login(self):
        data = UserLogin(email="test@example.com", password="password123")
        assert data.email == "test@example.com"
        assert data.password == "password123"

    def test_invalid_email(self):
        with pytest.raises(ValidationError):
            UserLogin(email="not-an-email", password="password123")


@pytest.mark.unit
class TestTokenResponse:
    def test_default_token_type(self):
        data = TokenResponse(access_token="test-token")
        assert data.access_token == "test-token"
        assert data.token_type == "bearer"

    def test_custom_token_type(self):
        data = TokenResponse(access_token="test-token", token_type="custom")
        assert data.token_type == "custom"


@pytest.mark.unit
class TestTokenData:
    def test_with_user_id(self):
        user_id = uuid.uuid4()
        data = TokenData(user_id=user_id)
        assert data.user_id == user_id

    def test_default_none(self):
        data = TokenData()
        assert data.user_id is None


@pytest.mark.unit
class TestShoppingListCreate:
    def test_valid_create(self):
        data = ShoppingListCreate(name="Groceries")
        assert data.name == "Groceries"

    def test_missing_name(self):
        with pytest.raises(ValidationError):
            ShoppingListCreate()


@pytest.mark.unit
class TestShoppingListUpdate:
    def test_update_name(self):
        data = ShoppingListUpdate(name="New Name")
        assert data.name == "New Name"

    def test_update_both_fields(self):
        data = ShoppingListUpdate(name="New Name")
        assert data.name == "New Name"

    def test_all_fields_optional(self):
        data = ShoppingListUpdate()
        assert data.name is None


@pytest.mark.unit
class TestShoppingListResponse:
    def test_valid_response(self):
        now = datetime.now(timezone.utc)
        data = ShoppingListResponse(
            id=uuid.uuid4(),
            name="Groceries",
            owner_id=uuid.uuid4(),
            share_code=None,
            created_at=now,
            updated_at=now,
        )
        assert data.name == "Groceries"
        assert data.share_code is None

    def test_from_attributes(self):
        class MockList:
            id = uuid.uuid4()
            name = "Test"
            owner_id = uuid.uuid4()
            share_code = uuid.uuid4()
            created_at = datetime.now(timezone.utc)
            updated_at = datetime.now(timezone.utc)

        mock = MockList()
        data = ShoppingListResponse.model_validate(mock)
        assert data.name == "Test"


@pytest.mark.unit
class TestShoppingListWithItemsResponse:
    def test_with_empty_items(self):
        now = datetime.now(timezone.utc)
        data = ShoppingListWithItemsResponse(
            id=uuid.uuid4(),
            name="Groceries",
            owner_id=None,
            share_code=None,
            created_at=now,
            updated_at=now,
            items=[],
        )
        assert data.items == []

    def test_with_items(self):
        now = datetime.now(timezone.utc)
        list_id = uuid.uuid4()
        item = ListItemResponse(
            id=uuid.uuid4(),
            list_id=list_id,
            name="Milk",
            quantity=1,
            unit="pcs",
            is_checked=False,
            sort_order=0,
            created_at=now,
        )
        data = ShoppingListWithItemsResponse(
            id=list_id,
            name="Groceries",
            owner_id=None,
            share_code=None,
            created_at=now,
            updated_at=now,
            items=[item],
        )
        assert len(data.items) == 1
        assert data.items[0].name == "Milk"
        assert data.items[0].unit == "pcs"


@pytest.mark.unit
class TestShareCodeResponse:
    def test_valid_share_code(self):
        code = uuid.uuid4()
        data = ShareCodeResponse(share_code=code)
        assert data.share_code == code


@pytest.mark.unit
class TestListItemCreate:
    def test_valid_create(self):
        data = ListItemCreate(name="Milk")
        assert data.name == "Milk"
        assert data.quantity == 1
        assert data.unit == "pcs"
        assert data.is_checked is False

    def test_custom_quantity(self):
        data = ListItemCreate(name="Eggs", quantity=12.5)
        assert data.quantity == 12.5

    def test_checked_item(self):
        data = ListItemCreate(name="Bread", is_checked=True)
        assert data.is_checked is True

    def test_custom_unit(self):
        """Accept custom unit values like 'kg'."""
        data = ListItemCreate(name="Flour", quantity=2.5, unit="kg")
        assert data.unit == "kg"
        assert data.quantity == 2.5

    def test_integer_quantity_backward_compat(self):
        """Integer quantity coerces to float for backward compat."""
        data = ListItemCreate(name="Sugar", quantity=2, unit="pcs")
        assert isinstance(data.quantity, float)
        assert data.quantity == 2.0

    def test_missing_name(self):
        with pytest.raises(ValidationError):
            ListItemCreate()


@pytest.mark.unit
class TestListItemUpdate:
    def test_update_name(self):
        data = ListItemUpdate(name="New Name")
        assert data.name == "New Name"

    def test_update_quantity(self):
        data = ListItemUpdate(quantity=5.5)
        assert data.quantity == 5.5

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
        assert data.unit is None
        assert data.is_checked is None
        assert data.sort_order is None

    def test_update_unit_only(self):
        """Test partial update with only unit changed."""
        data = ListItemUpdate(unit="kg")
        assert data.unit == "kg"
        assert data.quantity is None
        assert data.name is None

    def test_update_multiple_fields(self):
        data = ListItemUpdate(name="Milk", quantity=2.5, is_checked=True, unit="kg")
        assert data.name == "Milk"
        assert data.quantity == 2.5
        assert data.unit == "kg"
        assert data.is_checked is True


@pytest.mark.unit
class TestListItemResponse:
    class MockItem:
        """Mock ORM model for testing from_attributes."""
        def __init__(self, **kwargs):
            for key, value in kwargs.items():
                setattr(self, key, value)

    def test_valid_response(self):
        now = datetime.now(timezone.utc)
        list_id = uuid.uuid4()
        data = ListItemResponse(
            id=uuid.uuid4(),
            list_id=list_id,
            name="Milk",
            quantity=1,
            unit="pcs",
            is_checked=False,
            sort_order=0,
            created_at=now,
        )
        assert data.name == "Milk"
        assert data.list_id == list_id
        assert data.unit == "pcs"

    def test_from_attributes(self):
        """Test ListItemResponse with from_attributes for unit and float quantity."""
        list_id = uuid.uuid4()
        mock = self.MockItem(
            id=uuid.uuid4(),
            name="Test",
            quantity=2.5,
            unit="kg",
            list_id=list_id,
            is_checked=False,
            sort_order=0,
            created_at=datetime(2024, 1, 1, 12, 0),
            updated_at=datetime(2024, 1, 1, 12, 0),
            created_by="user-1",
        )
        resp = ListItemResponse.model_validate(mock, from_attributes=True)
        assert resp.quantity == 2.5
        assert resp.unit == "kg"


@pytest.mark.unit
class TestErrorResponse:
    def test_valid_error(self):
        data = ErrorResponse(detail="Something went wrong")
        assert data.detail == "Something went wrong"


@pytest.mark.unit
class TestMessageResponse:
    def test_valid_message(self):
        data = MessageResponse(message="Success")
        assert data.message == "Success"
