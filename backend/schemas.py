"""
Pydantic schemas for request/response validation.
"""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, ConfigDict, field_validator


# ==================== Auth Schemas ====================


class UserCreate(BaseModel):
    """Schema for user registration."""
    email: EmailStr
    password: str
    invite_code: Optional[str] = None
    
    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v


class UserLogin(BaseModel):
    """Schema for user login."""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Schema for token payload data."""
    user_id: Optional[uuid.UUID] = None


# ==================== List Schemas ====================


class ShoppingListBase(BaseModel):
    """Base schema for shopping list."""
    model_config = ConfigDict(from_attributes=True)
    
    name: str


class ShoppingListCreate(ShoppingListBase):
    """Schema for creating a shopping list."""
    pass


class ShoppingListUpdate(BaseModel):
    """Schema for updating a shopping list."""
    model_config = ConfigDict(from_attributes=True)
    
    name: Optional[str] = None
    is_public: Optional[bool] = None


class ShoppingListResponse(ShoppingListBase):
    """Schema for shopping list response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    owner_id: Optional[uuid.UUID]
    share_code: Optional[uuid.UUID]
    is_public: bool
    created_at: datetime
    updated_at: datetime


class ShoppingListWithItemsResponse(ShoppingListResponse):
    """Schema for shopping list with items included."""
    model_config = ConfigDict(
        from_attributes=True,
        # Ensure nested ORM relationships are converted properly
        extra="ignore",
    )

    items: list["ListItemResponse"]


class ShareCodeResponse(BaseModel):
    """Schema for share code response."""
    share_code: uuid.UUID


# ==================== Item Schemas ====================


class ListItemBase(BaseModel):
    """Base schema for list item."""
    model_config = ConfigDict(from_attributes=True)
    
    name: str
    quantity: int = 1
    is_checked: bool = False


class ListItemCreate(ListItemBase):
    """Schema for creating a list item."""
    pass


class ListItemUpdate(BaseModel):
    """Schema for updating a list item."""
    model_config = ConfigDict(from_attributes=True)
    
    name: Optional[str] = None
    quantity: Optional[int] = None
    is_checked: Optional[bool] = None
    sort_order: Optional[int] = None


class ListItemResponse(ListItemBase):
    """Schema for list item response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    list_id: uuid.UUID
    sort_order: int
    created_at: datetime


# ==================== Error Schemas ====================


class ErrorResponse(BaseModel):
    """Standard error response."""
    detail: str


class MessageResponse(BaseModel):
    """Standard message response."""
    message: str