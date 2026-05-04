"""
CRUD operations for database entities.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models import User, ShoppingList, ListItem
from schemas import (
    UserCreate,
    ShoppingListCreate,
    ShoppingListUpdate,
    ListItemCreate,
    ListItemUpdate,
)
from auth import get_password_hash, verify_password


# ==================== User CRUD ====================


async def create_user(db: AsyncSession, user_data: UserCreate) -> User:
    """
    Create a new user.
    """
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise ValueError("Email already registered")
    
    # Create new user
    user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> Optional[User]:
    """
    Authenticate user by email and password.
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if not user:
        return None
    
    if not verify_password(password, user.password_hash):
        return None
    
    return user


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """
    Get user by email.
    """
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> Optional[User]:
    """
    Get user by ID.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


# ==================== Shopping List CRUD ====================


async def create_shopping_list(
    db: AsyncSession,
    list_data: ShoppingListCreate,
    owner: Optional[User] = None,
) -> ShoppingList:
    """
    Create a new shopping list.
    """
    shopping_list = ShoppingList(
        name=list_data.name,
        owner_id=owner.id if owner else None,
    )
    db.add(shopping_list)
    await db.commit()
    await db.refresh(shopping_list)
    return shopping_list


async def get_user_lists(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[ShoppingList]:
    """
    Get all shopping lists owned by a user.
    """
    result = await db.execute(
        select(ShoppingList)
        .where(ShoppingList.owner_id == user_id)
        .options(selectinload(ShoppingList.items))
        .order_by(ShoppingList.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_list_by_id(
    db: AsyncSession,
    list_id: uuid.UUID,
) -> Optional[ShoppingList]:
    """
    Get shopping list by ID with items loaded.
    """
    result = await db.execute(
        select(ShoppingList)
        .where(ShoppingList.id == list_id)
        .options(selectinload(ShoppingList.items))
    )
    return result.scalar_one_or_none()


async def get_list_for_access(
    db: AsyncSession,
    list_id: uuid.UUID,
) -> Optional[ShoppingList]:
    """Get list without loading items — for access checks only."""
    result = await db.execute(
        select(ShoppingList).where(ShoppingList.id == list_id)
    )
    return result.scalar_one_or_none()


async def get_list_by_share_code(
    db: AsyncSession,
    share_code: uuid.UUID,
) -> Optional[ShoppingList]:
    """
    Get shopping list by share code.
    """
    result = await db.execute(
        select(ShoppingList)
        .where(ShoppingList.share_code == share_code)
        .options(selectinload(ShoppingList.items))
    )
    return result.scalar_one_or_none()


async def update_shopping_list(
    db: AsyncSession,
    shopping_list: ShoppingList,
    list_data: ShoppingListUpdate,
) -> ShoppingList:
    """
    Update shopping list details.
    """
    update_data = list_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(shopping_list, field, value)
    
    shopping_list.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(shopping_list)
    return shopping_list


async def delete_shopping_list(
    db: AsyncSession,
    shopping_list: ShoppingList,
) -> None:
    """
    Delete a shopping list.
    """
    await db.delete(shopping_list)
    await db.commit()


async def generate_share_code(
    db: AsyncSession,
    shopping_list: ShoppingList,
) -> ShoppingList:
    """
    Generate or update share code for a shopping list.
    """
    shopping_list.share_code = uuid.uuid4()
    shopping_list.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(shopping_list)
    return shopping_list


async def bump_list_updated_at(
    db: AsyncSession,
    list_id: uuid.UUID,
) -> None:
    """Bump updated_at with a single UPDATE — no SELECT needed."""
    await db.execute(
        update(ShoppingList)
        .where(ShoppingList.id == list_id)
        .values(updated_at=datetime.now(timezone.utc))
    )


# ==================== List Item CRUD ====================


async def get_items_by_list_id(
    db: AsyncSession,
    list_id: uuid.UUID,
) -> list[ListItem]:
    """
    Get all items in a shopping list.
    """
    result = await db.execute(
        select(ListItem)
        .where(ListItem.list_id == list_id)
        .order_by(ListItem.sort_order)
    )
    return list(result.scalars().all())


async def get_item_by_id(
    db: AsyncSession,
    item_id: uuid.UUID,
) -> Optional[ListItem]:
    """
    Get item by ID.
    """
    result = await db.execute(
        select(ListItem).where(ListItem.id == item_id)
    )
    return result.scalar_one_or_none()


async def get_max_sort_order(
    db: AsyncSession,
    list_id: uuid.UUID,
) -> int:
    """
    Get the maximum sort order for items in a list.
    """
    result = await db.execute(
        select(func.max(ListItem.sort_order)).where(ListItem.list_id == list_id)
    )
    max_order = result.scalar()
    return max_order if max_order is not None else -1


async def create_list_item(
    db: AsyncSession,
    list_id: uuid.UUID,
    item_data: ListItemCreate,
) -> ListItem:
    """
    Create a new item in a shopping list.
    """
    # Get next sort order
    max_order = await get_max_sort_order(db, list_id)
    
    item = ListItem(
        list_id=list_id,
        name=item_data.name,
        quantity=item_data.quantity,
        is_checked=item_data.is_checked,
        sort_order=max_order + 1,
    )
    db.add(item)
    
    # Update list's updated_at with a single UPDATE statement
    await bump_list_updated_at(db, list_id)
    
    await db.commit()
    await db.refresh(item)
    return item


async def update_list_item(
    db: AsyncSession,
    item: ListItem,
    item_data: ListItemUpdate,
) -> ListItem:
    """
    Update a list item.
    """
    update_data = item_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
    
    # Update list's updated_at with a single UPDATE statement
    await bump_list_updated_at(db, item.list_id)
    
    await db.commit()
    await db.refresh(item)
    return item


async def delete_list_item(
    db: AsyncSession,
    item: ListItem,
) -> None:
    """
    Delete a list item.
    """
    list_id = item.list_id
    
    await db.delete(item)
    
    # Update list's updated_at with a single UPDATE statement
    await bump_list_updated_at(db, list_id)
    
    await db.commit()