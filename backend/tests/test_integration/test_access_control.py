"""
Integration tests for access control on shopping lists.
"""
import uuid
from httpx import AsyncClient

from models import ShoppingList


class TestOwnerAccess:
    """Tests for owner access patterns."""

    async def test_owner_can_access_own_list(self, authenticated_client: AsyncClient, test_list):
        """Owner should be able to access their own list."""
        response = await authenticated_client.get(f"/api/lists/{test_list.id}")
        assert response.status_code == 200

    async def test_owner_can_update_own_list(self, authenticated_client: AsyncClient, test_list):
        """Owner should be able to update their own list."""
        response = await authenticated_client.put(
            f"/api/lists/{test_list.id}",
            json={"name": "Updated"},
        )
        assert response.status_code == 200

    async def test_owner_can_delete_own_list(self, authenticated_client: AsyncClient, test_list):
        """Owner should be able to delete their own list."""
        response = await authenticated_client.delete(f"/api/lists/{test_list.id}")
        assert response.status_code == 200

    async def test_non_owner_cannot_delete_list(
        self,
        authenticated_client: AsyncClient,
        test_user_2,
        db_session,
    ):
        """Non-owner should get 403 when trying to delete."""
        # Create a list owned by test_user_2 (not test_user)
        other_list = ShoppingList(
            name="Other User's List",
            owner_id=test_user_2.id,
        )
        db_session.add(other_list)
        await db_session.commit()
        await db_session.refresh(other_list)
        list_id = other_list.id

        # test_user tries to delete test_user_2's list
        response = await authenticated_client.delete(f"/api/lists/{list_id}")
        assert response.status_code == 403


class TestShareCodeAccess:
    """Tests for share code access patterns."""

    async def test_access_list_with_share_code(self, client: AsyncClient, test_list_with_share_code):
        """User with share code should access list."""
        share_code = test_list_with_share_code.share_code
        response = await client.get(
            f"/api/lists/{test_list_with_share_code.id}",
            params={"share_code": share_code},
        )
        assert response.status_code == 200

    async def test_access_items_with_share_code(self, client: AsyncClient, test_list_with_share_code, test_item):
        """User with share code should access items."""
        share_code = test_list_with_share_code.share_code
        response = await client.get(
            f"/api/lists/{test_list_with_share_code.id}/items",
            params={"share_code": share_code},
        )
        assert response.status_code == 200

    async def test_update_list_with_share_code(self, client: AsyncClient, test_list_with_share_code):
        """User with share code should update list."""
        share_code = test_list_with_share_code.share_code
        response = await client.put(
            f"/api/lists/{test_list_with_share_code.id}",
            json={"name": "Updated via share"},
            params={"share_code": share_code},
        )
        assert response.status_code == 200

    async def test_add_item_with_share_code(self, client: AsyncClient, test_list_with_share_code):
        """User with share code should add items."""
        share_code = test_list_with_share_code.share_code
        response = await client.post(
            f"/api/lists/{test_list_with_share_code.id}/items",
            json={"name": "Shared Item"},
            params={"share_code": share_code},
        )
        assert response.status_code == 200

    async def test_update_item_with_share_code(
        self,
        client: AsyncClient,
        test_list_with_share_code,
        db_session,
    ):
        """User with share code should update items."""
        from models import ListItem

        # Create an item on the shared list
        item = ListItem(
            list_id=test_list_with_share_code.id,
            name="Shared Item",
            quantity=1,
            is_checked=False,
            sort_order=0,
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(item)

        share_code = test_list_with_share_code.share_code
        response = await client.put(
            f"/api/items/{item.id}",
            json={"is_checked": True},
            params={"share_code": share_code},
        )
        assert response.status_code == 200
        assert response.json()["is_checked"] is True

    async def test_delete_item_with_share_code(
        self,
        client: AsyncClient,
        test_list_with_share_code,
        db_session,
    ):
        """User with share code should delete items."""
        from models import ListItem

        # Create an item on the shared list
        item = ListItem(
            list_id=test_list_with_share_code.id,
            name="Shared Item",
            quantity=1,
            is_checked=False,
            sort_order=0,
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(item)

        share_code = test_list_with_share_code.share_code
        response = await client.delete(
            f"/api/items/{item.id}",
            params={"share_code": share_code},
        )
        assert response.status_code == 200

    async def test_invalid_share_code_denied(self, client: AsyncClient, test_list):
        """Invalid share code should deny access."""
        response = await client.get(
            f"/api/lists/{test_list.id}",
            params={"share_code": uuid.uuid4()},
        )
        assert response.status_code == 401


class TestPrivateListAccess:
    """Tests for private list access denial."""

    async def test_private_list_denied_without_auth(self, client: AsyncClient, test_list):
        """Private list should deny access without auth."""
        response = await client.get(f"/api/lists/{test_list.id}")
        assert response.status_code == 401

    async def test_private_list_items_denied_without_auth(self, client: AsyncClient, test_list):
        """Private list items should deny access without auth."""
        response = await client.get(f"/api/lists/{test_list.id}/items")
        assert response.status_code == 401

    async def test_private_list_update_denied_without_auth(self, client: AsyncClient, test_list):
        """Private list should deny updates without auth."""
        response = await client.put(
            f"/api/lists/{test_list.id}",
            json={"name": "Hacked"},
        )
        assert response.status_code == 401


class TestAnonymousListAccess:
    """Tests for lists with no owner."""

    async def test_anonymous_list_accessible_with_auth(self, authenticated_client: AsyncClient, test_list_no_owner):
        """Authenticated user should access list with no owner."""
        response = await authenticated_client.get(f"/api/lists/{test_list_no_owner.id}")
        assert response.status_code == 200

    async def test_anonymous_list_items_accessible_with_auth(self, authenticated_client: AsyncClient, test_list_no_owner):
        """Authenticated user should access items of list with no owner."""
        response = await authenticated_client.get(f"/api/lists/{test_list_no_owner.id}/items")
        assert response.status_code == 200
