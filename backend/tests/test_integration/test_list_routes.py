"""
Integration tests for shopping list routes.
"""
import uuid
from httpx import AsyncClient


class TestHealthCheck:
    """Tests for GET /health."""

    async def test_health_check(self, client: AsyncClient):
        """Health check should return healthy status."""
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}


class TestGetLists:
    """Tests for GET /api/lists."""

    async def test_get_lists_requires_auth(self, client: AsyncClient):
        """Getting lists without auth should return 401."""
        response = await client.get("/api/lists")
        assert response.status_code == 401

    async def test_get_lists_success(self, authenticated_client: AsyncClient, test_list):
        """Getting lists with auth should return user's lists."""
        response = await authenticated_client.get("/api/lists")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    async def test_get_lists_empty(self, authenticated_client: AsyncClient):
        """User with no lists should get empty array."""
        response = await authenticated_client.get("/api/lists")
        assert response.status_code == 200
        assert response.json() == []


class TestCreateList:
    """Tests for POST /api/lists."""

    async def test_create_list_requires_auth(self, client: AsyncClient):
        """Creating list without auth should return 401."""
        response = await client.post("/api/lists", json={"name": "Test"})
        assert response.status_code == 401

    async def test_create_list_success(self, authenticated_client: AsyncClient):
        """Creating list with auth should succeed."""
        response = await authenticated_client.post(
            "/api/lists",
            json={"name": "New Shopping List"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Shopping List"
        assert data["owner_id"] is not None

    async def test_create_list_missing_name(self, authenticated_client: AsyncClient):
        """Creating list without name should return 422."""
        response = await authenticated_client.post("/api/lists", json={})
        assert response.status_code == 422


class TestGetList:
    """Tests for GET /api/lists/{list_id}."""

    async def test_get_list_by_id_success(self, authenticated_client: AsyncClient, test_list):
        """Getting list by ID should return the list with items."""
        response = await authenticated_client.get(f"/api/lists/{test_list.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_list.id)
        assert data["name"] == test_list.name
        assert "items" in data

    async def test_get_list_not_found(self, authenticated_client: AsyncClient):
        """Getting nonexistent list should return 404."""
        response = await authenticated_client.get(f"/api/lists/{uuid.uuid4()}")
        assert response.status_code == 404


class TestUpdateList:
    """Tests for PUT /api/lists/{list_id}."""

    async def test_update_list_name(self, authenticated_client: AsyncClient, test_list):
        """Updating list name should succeed."""
        response = await authenticated_client.put(
            f"/api/lists/{test_list.id}",
            json={"name": "Updated Name"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"

    async def test_update_list_is_public(self, authenticated_client: AsyncClient, test_list):
        """Updating list is_public should succeed."""
        response = await authenticated_client.put(
            f"/api/lists/{test_list.id}",
            json={"is_public": True},
        )
        assert response.status_code == 200
        assert response.json()["is_public"] is True

    async def test_update_list_partial(self, authenticated_client: AsyncClient, test_list):
        """Partial update should only change specified fields."""
        response = await authenticated_client.put(
            f"/api/lists/{test_list.id}",
            json={"name": "New Name"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "New Name"
        assert response.json()["is_public"] == test_list.is_public


class TestDeleteList:
    """Tests for DELETE /api/lists/{list_id}."""

    async def test_delete_list_requires_auth(self, client: AsyncClient, test_list):
        """Deleting list without auth should return 401."""
        response = await client.delete(f"/api/lists/{test_list.id}")
        assert response.status_code == 401

    async def test_delete_list_success(self, authenticated_client: AsyncClient, test_list):
        """Owner should be able to delete list."""
        response = await authenticated_client.delete(f"/api/lists/{test_list.id}")
        assert response.status_code == 200
        assert "deleted successfully" in response.json()["message"]

    async def test_delete_list_non_owner(
        self,
        authenticated_client_2: AsyncClient,
        test_list,
    ):
        """Non-owner should get 403 when trying to delete."""
        response = await authenticated_client_2.delete(f"/api/lists/{test_list.id}")
        assert response.status_code == 403

    async def test_delete_list_not_found(self, authenticated_client: AsyncClient):
        """Deleting nonexistent list should return 404."""
        response = await authenticated_client.delete(f"/api/lists/{uuid.uuid4()}")
        assert response.status_code == 404


class TestShareLink:
    """Tests for POST /api/lists/{list_id}/share."""

    async def test_create_share_link_requires_auth(self, client: AsyncClient, test_list):
        """Creating share link without auth should return 401."""
        response = await client.post(f"/api/lists/{test_list.id}/share")
        assert response.status_code == 401

    async def test_create_share_link_success(self, authenticated_client: AsyncClient, test_list):
        """Owner should be able to generate share code."""
        response = await authenticated_client.post(f"/api/lists/{test_list.id}/share")
        assert response.status_code == 200
        data = response.json()
        assert "share_code" in data
        assert data["share_code"] is not None


class TestSharedList:
    """Tests for GET /api/lists/shared/{share_code}."""

    async def test_get_shared_list_success(self, client: AsyncClient, test_list_with_share_code):
        """Getting list by share code should succeed without auth."""
        share_code = test_list_with_share_code.share_code
        response = await client.get(f"/api/lists/shared/{share_code}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_list_with_share_code.id)

    async def test_get_shared_list_not_found(self, client: AsyncClient):
        """Getting list with invalid share code should return 404."""
        response = await client.get(f"/api/lists/shared/{uuid.uuid4()}")
        assert response.status_code == 404
