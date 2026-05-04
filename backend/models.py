"""
SQLAlchemy ORM models for the shopping list application.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Boolean, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from database import Base


class User(Base):
    """
    User model for authentication and list ownership.
    """
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    
    # Relationship to shopping lists
    shopping_lists: Mapped[list["ShoppingList"]] = relationship(
        "ShoppingList",
        back_populates="owner",
        cascade="all, delete-orphan",
    )


class ShoppingList(Base):
    """
    Shopping list model with sharing capabilities.
    """
    __tablename__ = "shopping_lists"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    owner_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    share_code: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        unique=True,
        nullable=True,
        index=True,
    )
    # DEPRECATED: is_public flag is no longer used. Column kept for DB compatibility (no migration system).
    is_public: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    
    __table_args__ = (
        Index("ix_lists_owner_updated", "owner_id", "updated_at"),
    )
    
    # Relationship to owner
    owner: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="shopping_lists",
    )
    
    # Relationship to items
    items: Mapped[list["ListItem"]] = relationship(
        "ListItem",
        back_populates="list",
        cascade="all, delete-orphan",
        order_by="ListItem.sort_order",
    )


class ListItem(Base):
    """
    Individual item in a shopping list.
    """
    __tablename__ = "list_items"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    list_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("shopping_lists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    is_checked: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    sort_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    
    # Relationship to shopping list
    list: Mapped["ShoppingList"] = relationship(
        "ShoppingList",
        back_populates="items",
    )