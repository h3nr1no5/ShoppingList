"""
Unit tests for CRUD operations.
"""
import os
import uuid
import pytest

from models import User, ShoppingList, ListItem
from schemas import UserCreate, ShoppingListCreate, ShoppingListUpdate, ListItemCreate, ListItemUpdate
from crud import (
    create_user,
    authenticate_user,
    get_user_by_email,
    get_user_by_id,
    create_shopping_list,
    get_user_lists,
    get_list_by_id,
    get_list_by_share_code,
    update_shopping_list,
    delete_shopping_list,
    generate_share_code,
    get_items_by_list_id,
    get_item_by_id,
    create_list_item,
    update_list_item,
    delete_list_item,
    get_max_sort_order,
)


@pytest.mark.unit
@pytest.mark.postgresql
class TestUserCrud:
    """Tests for user CRUD operations."""

    async def test_create_user_success(self, db_session):
        """Creating a user should succeed and return the user."""
        user_data = UserCreate(email="newuser@example.com", password="password123", invite_code=os.environ["REGISTRATION_KEY"])
        user = await create_user(db_session, user_data)
        assert user.email == "newuser@example.com"
        assert user.id is not None
        assert user.password_hash != "password123"

    async def test_create_user_duplicate_email_raises(self, db_session, test_user):
        """Creating a user with duplicate email should raise ValueError."""
        user_data = UserCreate(email=test_user.email, password="password123", invite_code=os.environ["REGISTRATION_KEY"])
        with pytest.raises(ValueError, match="Email already registered"):
            await create_user(db_session, user_data)

    async def test_authenticate_user_success(self, db_session, test_user):
        """Authentication with correct credentials should return user."""
        user = await authenticate_user(db_session, test_user.email, "TestPassword123!")
        assert user is not None
        assert user.id == test_user.id

    async def test_authenticate_user_wrong_password(self, db_session, test_user):
        """Authentication with wrong password should return None."""
        user = await authenticate_user(db_session, test_user.email, "WrongPassword")
        assert user is None

    async def test_authenticate_user_nonexistent(self, db_session):
        """Authentication with nonexistent email should return None."""
        user = await authenticate_user(db_session, "nonexistent@example.com", "password")
        assert user is None

    async def test_get_user_by_email_success(self, db_session, test_user):
        """Getting user by email should return the user."""
        user = await get_user_by_email(db_session, test_user.email)
        assert user is not None
        assert user.id == test_user.id

    async def test_get_user_by_email_not_found(self, db_session):
        """Getting nonexistent user by email should return None."""
        user = await get_user_by_email(db_session, "nonexistent@example.com")
        assert user is None

    async def test_get_user_by_id_success(self, db_session, test_user):
        """Getting user by ID should return the user."""
        user = await get_user_by_id(db_session, test_user.id)
        assert user is not None
        assert user.id == test_user.id

    async def test_get_user_by_id_not_found(self, db_session):
        """Getting nonexistent user by ID should return None."""
        user = await get_user_by_id(db_session, uuid.uuid4())
        assert user is None


@pytest.mark.unit
@pytest.mark.postgresql
class TestShoppingListCrud:
    """Tests for shopping list CRUD operations."""

    async def test_create_shopping_list_with_owner(self, db_session, test_user):
        """Creating a list with owner should set owner_id."""
        list_data = ShoppingListCreate(name="Groceries")
        shopping_list = await create_shopping_list(db_session, list_data, test_user)
        assert shopping_list.name == "Groceries"
        assert shopping_list.owner_id == test_user.id

    async def test_create_shopping_list_without_owner(self, db_session):
        """Creating a list without owner should have None owner_id."""
        list_data = ShoppingListCreate(name="Anonymous List")
        shopping_list = await create_shopping_list(db_session, list_data, None)
        assert shopping_list.name == "Anonymous List"
        assert shopping_list.owner_id is None

    async def test_get_user_lists(self, db_session, test_user):
        """Should return all lists owned by user."""
        await create_shopping_list(db_session, ShoppingListCreate(name="List 1"), test_user)
        await create_shopping_list(db_session, ShoppingListCreate(name="List 2"), test_user)
        lists = await get_user_lists(db_session, test_user.id)
        assert len(lists) >= 2

    async def test_get_user_lists_empty(self, db_session, test_user_2):
        """User with no lists should get empty list."""
        lists = await get_user_lists(db_session, test_user_2.id)
        assert lists == []

    async def test_get_list_by_id_success(self, db_session, test_list):
        """Getting list by ID should return the list with items."""
        shopping_list = await get_list_by_id(db_session, test_list.id)
        assert shopping_list is not None
        assert shopping_list.id == test_list.id
        assert hasattr(shopping_list, "items")

    async def test_get_list_by_id_not_found(self, db_session):
        """Getting nonexistent list by ID should return None."""
        shopping_list = await get_list_by_id(db_session, uuid.uuid4())
        assert shopping_list is None

    async def test_get_list_by_share_code_success(self, db_session, test_list_with_share_code):
        """Getting list by share code should return the list."""
        shopping_list = await get_list_by_share_code(db_session, test_list_with_share_code.share_code)
        assert shopping_list is not None
        assert shopping_list.id == test_list_with_share_code.id

    async def test_get_list_by_share_code_not_found(self, db_session):
        """Getting list with invalid share code should return None."""
        shopping_list = await get_list_by_share_code(db_session, uuid.uuid4())
        assert shopping_list is None

    async def test_update_shopping_list_name(self, db_session, test_list):
        """Updating list name should change the name."""
        update_data = ShoppingListUpdate(name="Updated Name")
        updated = await update_shopping_list(db_session, test_list, update_data)
        assert updated.name == "Updated Name"

    async def test_update_shopping_list_partial(self, db_session, test_list):
        """Partial update should only change specified fields."""
        original_name = test_list.name
        update_data = ShoppingListUpdate()
        updated = await update_shopping_list(db_session, test_list, update_data)
        assert updated.name == original_name

    async def test_delete_shopping_list(self, db_session, test_list):
        """Deleting a list should remove it."""
        list_id = test_list.id
        await delete_shopping_list(db_session, test_list)
        deleted = await get_list_by_id(db_session, list_id)
        assert deleted is None

    async def test_generate_share_code(self, db_session, test_list):
        """Generating share code should set a UUID."""
        assert test_list.share_code is None
        updated = await generate_share_code(db_session, test_list)
        assert updated.share_code is not None
        assert isinstance(updated.share_code, uuid.UUID)

    async def test_generate_share_code_updates_existing(self, db_session, test_list_with_share_code):
        """Generating new share code should replace existing one."""
        old_code = test_list_with_share_code.share_code
        updated = await generate_share_code(db_session, test_list_with_share_code)
        assert updated.share_code != old_code


@pytest.mark.unit
@pytest.mark.postgresql
class TestListItemCrud:
    """Tests for list item CRUD operations."""

    async def test_create_list_item_success(self, db_session, test_list):
        """Creating an item should succeed."""
        item_data = ListItemCreate(name="Milk", quantity=2)
        item = await create_list_item(db_session, test_list.id, item_data)
        assert item.name == "Milk"
        assert item.quantity == 2
        assert item.list_id == test_list.id

    async def test_create_list_item_default_values(self, db_session, test_list):
        """Creating an item should use default values."""
        item_data = ListItemCreate(name="Bread")
        item = await create_list_item(db_session, test_list.id, item_data)
        assert item.quantity == 1
        assert item.is_checked is False

    async def test_create_list_item_sort_order_increments(self, db_session, test_list):
        """Creating items should auto-increment sort_order."""
        item1 = await create_list_item(db_session, test_list.id, ListItemCreate(name="Item 1"))
        item2 = await create_list_item(db_session, test_list.id, ListItemCreate(name="Item 2"))
        item3 = await create_list_item(db_session, test_list.id, ListItemCreate(name="Item 3"))
        assert item2.sort_order == item1.sort_order + 1
        assert item3.sort_order == item2.sort_order + 1

    async def test_get_items_by_list_id(self, db_session, test_list):
        """Should return all items for a list."""
        await create_list_item(db_session, test_list.id, ListItemCreate(name="Item 1"))
        await create_list_item(db_session, test_list.id, ListItemCreate(name="Item 2"))
        items = await get_items_by_list_id(db_session, test_list.id)
        assert len(items) >= 2

    async def test_get_items_by_list_id_empty(self, db_session):
        """List with no items should return empty list."""
        empty_list = await create_shopping_list(db_session, ShoppingListCreate(name="Empty"), None)
        items = await get_items_by_list_id(db_session, empty_list.id)
        assert items == []

    async def test_get_item_by_id_success(self, db_session, test_item):
        """Getting item by ID should return the item."""
        item = await get_item_by_id(db_session, test_item.id)
        assert item is not None
        assert item.id == test_item.id

    async def test_get_item_by_id_not_found(self, db_session):
        """Getting nonexistent item by ID should return None."""
        item = await get_item_by_id(db_session, uuid.uuid4())
        assert item is None

    async def test_update_list_item_name(self, db_session, test_item):
        """Updating item name should change the name."""
        update_data = ListItemUpdate(name="Updated Item")
        updated = await update_list_item(db_session, test_item, update_data)
        assert updated.name == "Updated Item"

    async def test_update_list_item_quantity(self, db_session, test_item):
        """Updating item quantity should change the quantity."""
        update_data = ListItemUpdate(quantity=10)
        updated = await update_list_item(db_session, test_item, update_data)
        assert updated.quantity == 10

    async def test_update_list_item_is_checked(self, db_session, test_item):
        """Updating item is_checked should change the value."""
        update_data = ListItemUpdate(is_checked=True)
        updated = await update_list_item(db_session, test_item, update_data)
        assert updated.is_checked is True

    async def test_update_list_item_partial(self, db_session, test_item):
        """Partial update should only change specified fields."""
        original_name = test_item.name
        update_data = ListItemUpdate(quantity=5)
        updated = await update_list_item(db_session, test_item, update_data)
        assert updated.name == original_name
        assert updated.quantity == 5

    async def test_delete_list_item(self, db_session, test_item):
        """Deleting an item should remove it."""
        item_id = test_item.id
        await delete_list_item(db_session, test_item)
        deleted = await get_item_by_id(db_session, item_id)
        assert deleted is None

    async def test_get_max_sort_order_empty_list(self, db_session):
        """Max sort order for empty list should be -1."""
        empty_list = await create_shopping_list(db_session, ShoppingListCreate(name="Empty"), None)
        max_order = await get_max_sort_order(db_session, empty_list.id)
        assert max_order == -1

    async def test_get_max_sort_order_with_items(self, db_session, test_list):
        """Max sort order should return highest sort_order."""
        await create_list_item(db_session, test_list.id, ListItemCreate(name="Item 1"))
        await create_list_item(db_session, test_list.id, ListItemCreate(name="Item 2"))
        max_order = await get_max_sort_order(db_session, test_list.id)
        assert max_order >= 1
