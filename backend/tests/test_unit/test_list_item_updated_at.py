"""
Unit tests for ListItem updated_at field.
"""
import os
import uuid
import asyncio
from datetime import datetime, timezone

import pytest

from models import ListItem
from schemas import ListItemResponse, ListItemUpdate
from crud import create_list_item, update_list_item, get_item_by_id
from schemas import ListItemCreate, ShoppingListCreate


@pytest.mark.unit
@pytest.mark.postgresql
class TestListItemModelUpdatedAt:
    """Tests for ListItem model updated_at field."""

    async def test_list_item_has_updated_at_field(self, db_session, test_list):
        """ListItem model should have updated_at field."""
        item = await create_list_item(
            db_session,
            test_list.id,
            ListItemCreate(name="Test Item"),
        )
        assert hasattr(item, "updated_at")

    async def test_list_item_updated_at_defaults_to_now_on_creation(self, db_session, test_list):
        """Updated_at should be set to current time on item creation."""
        before = datetime.now(timezone.utc)
        item = await create_list_item(
            db_session,
            test_list.id,
            ListItemCreate(name="Test Item"),
        )
        after = datetime.now(timezone.utc)
        assert item.updated_at is not None
        assert before <= item.updated_at <= after

    async def test_list_item_updated_at_is_timezone_aware(self, db_session, test_list):
        """Updated_at should be timezone-aware."""
        item = await create_list_item(
            db_session,
            test_list.id,
            ListItemCreate(name="Test Item"),
        )
        assert item.updated_at.tzinfo is not None


@pytest.mark.unit
@pytest.mark.postgresql
class TestListItemUpdatedAtOnUpdate:
    """Tests for updated_at auto-update on item changes."""

    async def test_updated_at_changes_on_name_update(self, db_session, test_item):
        """Updating item name should change updated_at."""
        original_updated_at = test_item.updated_at
        # Wait a small amount to ensure time difference
        await asyncio.sleep(0.01)
        
        update_data = ListItemUpdate(name="New Name")
        updated = await update_list_item(db_session, test_item, update_data)
        
        assert updated.updated_at is not None
        assert updated.updated_at > original_updated_at

    async def test_updated_at_changes_on_quantity_update(self, db_session, test_item):
        """Updating item quantity should change updated_at."""
        original_updated_at = test_item.updated_at
        await asyncio.sleep(0.01)
        
        update_data = ListItemUpdate(quantity=5.5)
        updated = await update_list_item(db_session, test_item, update_data)
        
        assert updated.updated_at is not None
        assert updated.updated_at > original_updated_at

    async def test_updated_at_changes_on_is_checked_toggle(self, db_session, test_item):
        """Toggling is_checked should change updated_at."""
        original_updated_at = test_item.updated_at
        await asyncio.sleep(0.01)
        
        # Toggle is_checked
        update_data = ListItemUpdate(is_checked=not test_item.is_checked)
        updated = await update_list_item(db_session, test_item, update_data)
        
        assert updated.updated_at is not None
        assert updated.updated_at > original_updated_at

    async def test_updated_at_changes_on_partial_update(self, db_session, test_item):
        """Partial update should change updated_at."""
        original_updated_at = test_item.updated_at
        await asyncio.sleep(0.01)
        
        update_data = ListItemUpdate(quantity=3.5)
        updated = await update_list_item(db_session, test_item, update_data)
        
        assert updated.updated_at is not None
        assert updated.updated_at > original_updated_at


@pytest.mark.unit
class TestListItemSchemaUpdatedAt:
    """Tests for ListItemResponse schema with updated_at."""

    def test_list_item_response_has_updated_at_field(self):
        """ListItemResponse should include updated_at field."""
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
            updated_at=now,
        )
        assert data.updated_at == now

    def test_list_item_response_updated_at_can_be_none(self):
        """ListItemResponse updated_at can be None for backward compatibility."""
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
        assert data.updated_at is None

    def test_list_item_response_from_attributes(self):
        """ListItemResponse should work with from_attributes."""
        now = datetime.now(timezone.utc)
        
        class MockItem:
            id = uuid.uuid4()
            list_id = uuid.uuid4()
            name = "Test Item"
            quantity = 2.5
            unit = "pcs"
            is_checked = True
            sort_order = 1
            created_at = now
            updated_at = now

        mock = MockItem()
        data = ListItemResponse.model_validate(mock)
        assert data.name == "Test Item"
        assert data.quantity == 2.5
        assert data.unit == "pcs"
        assert data.updated_at == now