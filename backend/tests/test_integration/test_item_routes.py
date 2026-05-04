"""
Integration tests for item routes.
"""
import asyncio
import uuid
from httpx import AsyncClient


class TestGetItems:
    """Tests for GET /api/lists/{list_id}/items."""

    async def test_get_items_success(self, authenticated_client: AsyncClient, test_list, test_item):
        """Getting items for a list should succeed."""
        response = await authenticated_client.get(f"/api/lists/{test_list.id}/items")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    async def test_get_items_empty_list(self, authenticated_client: AsyncClient, test_list):
        """Getting items for empty list should return empty array."""
        response = await authenticated_client.get(f"/api/lists/{test_list.id}/items")
        assert response.status_code == 200
        assert response.json() == []

    async def test_get_items_not_found(self, authenticated_client: AsyncClient):
        """Getting items for nonexistent list should return 404."""
        response = await authenticated_client.get(f"/api/lists/{uuid.uuid4()}/items")
        assert response.status_code == 404


class TestAddItem:
    """Tests for POST /api/lists/{list_id}/items."""

    async def test_add_item_success(self, authenticated_client: AsyncClient, test_list):
        """Adding item to list should succeed."""
        response = await authenticated_client.post(
            f"/api/lists/{test_list.id}/items",
            json={"name": "Milk", "quantity": 2},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Milk"
        assert data["quantity"] == 2

    async def test_add_item_default_values(self, authenticated_client: AsyncClient, test_list):
        """Adding item should use default values."""
        response = await authenticated_client.post(
            f"/api/lists/{test_list.id}/items",
            json={"name": "Bread"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["quantity"] == 1
        assert data["is_checked"] is False

    async def test_add_item_missing_name(self, authenticated_client: AsyncClient, test_list):
        """Adding item without name should return 422."""
        response = await authenticated_client.post(
            f"/api/lists/{test_list.id}/items",
            json={},
        )
        assert response.status_code == 422

    async def test_add_item_to_nonexistent_list(self, authenticated_client: AsyncClient):
        """Adding item to nonexistent list should return 404."""
        response = await authenticated_client.post(
            f"/api/lists/{uuid.uuid4()}/items",
            json={"name": "Milk"},
        )
        assert response.status_code == 404


class TestUpdateItem:
    """Tests for PUT /api/items/{item_id}."""

    async def test_update_item_name(self, authenticated_client: AsyncClient, test_item):
        """Updating item name should succeed."""
        response = await authenticated_client.put(
            f"/api/items/{test_item.id}",
            json={"name": "Updated Item"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Item"

    async def test_update_item_quantity(self, authenticated_client: AsyncClient, test_item):
        """Updating item quantity should succeed."""
        response = await authenticated_client.put(
            f"/api/items/{test_item.id}",
            json={"quantity": 10},
        )
        assert response.status_code == 200
        assert response.json()["quantity"] == 10

    async def test_update_item_is_checked(self, authenticated_client: AsyncClient, test_item):
        """Updating item is_checked should succeed."""
        response = await authenticated_client.put(
            f"/api/items/{test_item.id}",
            json={"is_checked": True},
        )
        assert response.status_code == 200
        assert response.json()["is_checked"] is True

    async def test_update_item_partial(self, authenticated_client: AsyncClient, test_item):
        """Partial update should only change specified fields."""
        original_name = test_item.name
        response = await authenticated_client.put(
            f"/api/items/{test_item.id}",
            json={"quantity": 5},
        )
        assert response.status_code == 200
        assert response.json()["name"] == original_name
        assert response.json()["quantity"] == 5

    async def test_update_item_not_found(self, authenticated_client: AsyncClient):
        """Updating nonexistent item should return 404."""
        response = await authenticated_client.put(
            f"/api/items/{uuid.uuid4()}",
            json={"name": "Test"},
        )
        assert response.status_code == 404


class TestDeleteItem:
    """Tests for DELETE /api/items/{item_id}."""

    async def test_delete_item_success(self, authenticated_client: AsyncClient, test_item):
        """Deleting item should succeed."""
        response = await authenticated_client.delete(f"/api/items/{test_item.id}")
        assert response.status_code == 200
        assert "deleted successfully" in response.json()["message"]

    async def test_delete_item_not_found(self, authenticated_client: AsyncClient):
        """Deleting nonexistent item should return 404."""
        response = await authenticated_client.delete(f"/api/items/{uuid.uuid4()}")
        assert response.status_code == 404


class TestItemUpdatedAt:
    """Tests for item updated_at field in API responses."""

    async def test_create_item_returns_updated_at(self, authenticated_client: AsyncClient, test_list):
        """Creating an item should return updated_at in response."""
        response = await authenticated_client.post(
            f"/api/lists/{test_list.id}/items",
            json={"name": "Milk", "quantity": 2},
        )
        assert response.status_code == 200
        data = response.json()
        assert "updated_at" in data
        assert data["updated_at"] is not None

    async def test_update_item_returns_updated_at(self, authenticated_client: AsyncClient, test_item):
        """Updating an item should return updated_at in response."""
        response = await authenticated_client.put(
            f"/api/items/{test_item.id}",
            json={"name": "Updated Item"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "updated_at" in data
        assert data["updated_at"] is not None

    async def test_update_item_changes_updated_at(self, authenticated_client: AsyncClient, test_item):
        """Updating an item should change updated_at to a later time."""
        # Get initial updated_at
        get_response = await authenticated_client.get(f"/api/lists/{test_item.list_id}/items")
        initial_updated_at = get_response.json()[0]["updated_at"]
        
        # Wait a small amount to ensure time difference
        await asyncio.sleep(0.01)
        
        # Update the item
        response = await authenticated_client.put(
            f"/api/items/{test_item.id}",
            json={"name": "Updated Name"},
        )
        assert response.status_code == 200
        data = response.json()
        
        # The updated_at should be different (later)
        new_updated_at = data["updated_at"]
        assert new_updated_at != initial_updated_at

    async def test_toggle_is_checked_updates_updated_at(self, authenticated_client: AsyncClient, test_item):
        """Toggling is_checked should update updated_at."""
        # Get initial updated_at
        get_response = await authenticated_client.get(f"/api/lists/{test_item.list_id}/items")
        initial_updated_at = get_response.json()[0]["updated_at"]
        
        await asyncio.sleep(0.01)
        
        # Toggle is_checked
        response = await authenticated_client.put(
            f"/api/items/{test_item.id}",
            json={"is_checked": True},
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["updated_at"] != initial_updated_at
