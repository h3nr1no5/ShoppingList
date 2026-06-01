"""
Pydantic schemas for request/response validation.
"""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, ConfigDict, Field


# ==================== Auth Schemas ====================


class UserCreate(BaseModel):
    """Schema for user registration."""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    invite_code: Optional[str] = None


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


class ForgotPasswordRequest(BaseModel):
    """Schema for forgot password request."""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Schema for password reset."""
    token: str
    password: str = Field(..., min_length=8, max_length=128)


class DeleteAccountRequest(BaseModel):
    """Schema for delete account confirmation."""
    password: str


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


class ShoppingListResponse(ShoppingListBase):
    """Schema for shopping list response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    owner_id: Optional[uuid.UUID]
    share_code: Optional[uuid.UUID]
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
    
    name: str = Field(..., max_length=255)
    quantity: float = 1
    unit: str = Field(default="pcs", max_length=20)
    is_checked: bool = False


class ListItemCreate(ListItemBase):
    """Schema for creating a list item."""
    model_config = ConfigDict(from_attributes=True)
    quantity: float = Field(default=1, ge=0.1, le=9999)


class ListItemUpdate(BaseModel):
    """Schema for updating a list item."""
    model_config = ConfigDict(from_attributes=True)
    
    name: Optional[str] = Field(None, max_length=255)
    quantity: Optional[float] = Field(default=None, ge=0.1, le=9999)
    unit: Optional[str] = Field(default=None, max_length=20)
    is_checked: Optional[bool] = None
    sort_order: Optional[int] = Field(None, ge=0)


class ListItemResponse(ListItemBase):
    """Schema for list item response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    list_id: uuid.UUID
    sort_order: int
    created_at: datetime
    updated_at: Optional[datetime] = None


# ==================== Error Schemas ====================


class ErrorResponse(BaseModel):
    """Standard error response."""
    detail: str


class MessageResponse(BaseModel):
    """Standard message response."""
    message: str