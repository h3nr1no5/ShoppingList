"""
FastAPI application with all routes for the shopping list app.
"""
import os
import uuid
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, init_db
from models import User, ShoppingList, ListItem
from schemas import (
    UserCreate,
    UserLogin,
    TokenResponse,
    ShoppingListCreate,
    ShoppingListUpdate,
    ShoppingListResponse,
    ShoppingListWithItemsResponse,
    ShareCodeResponse,
    ListItemCreate,
    ListItemUpdate,
    ListItemResponse,
    MessageResponse,
    ErrorResponse,
)
from auth import (
    get_current_user,
    get_current_user_optional,
    create_access_token,
)
from crud import (
    create_user,
    authenticate_user,
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
)


# ==================== App Configuration ====================


app = FastAPI(
    title="Shopping List API",
    description="Backend API for shopping list application with sharing capabilities",
    version="1.0.0",
)

# Configure CORS - use environment variable for allowed origins
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== Dependency Functions ====================


async def get_list_access(
    list_id: uuid.UUID,
    share_code: Optional[uuid.UUID] = Query(None, alias="share_code"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> ShoppingList:
    """
    Get shopping list with access check.
    Access granted if:
    - User is authenticated and owns the list
    - User is authenticated and list has no owner (anonymous list)
    - Valid share_code provided
    - List is public
    """
    # Try to get list by ID
    shopping_list = await get_list_by_id(db, list_id)
    
    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shopping list not found",
        )
    
    # Check access conditions
    has_access = False
    
    # Owner or anonymous list with authenticated user
    if current_user and (shopping_list.owner_id == current_user.id or shopping_list.owner_id is None):
        has_access = True
    # Share code provided and matches
    elif share_code and shopping_list.share_code == share_code:
        has_access = True
    # Public list
    elif shopping_list.is_public:
        has_access = True
    
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authorized to access this shopping list",
        )
    
    return shopping_list


async def get_item_with_list_access(
    item_id: uuid.UUID,
    share_code: Optional[uuid.UUID] = Query(None, alias="share_code"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> tuple[ListItem, ShoppingList]:
    """
    Get item with access check through its list.
    """
    item = await get_item_by_id(db, item_id)
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )
    
    # Use get_list_access to check access
    shopping_list = await get_list_access(item.list_id, share_code, current_user, db)
    
    return item, shopping_list


# ==================== Auth Routes ====================


@app.post("/api/auth/register", response_model=TokenResponse, tags=["auth"])
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new user and return JWT token.
    Requires valid registration key.
    """
    # Check registration key
    registration_key = os.getenv("REGISTRATION_KEY")
    if not registration_key or user_data.invite_code != registration_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid invite code",
        )
    
    try:
        user = await create_user(db, user_data)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An error occurred during registration",
        )

    access_token = create_access_token(user.id, user.email)
    return TokenResponse(access_token=access_token)


@app.post("/api/auth/login", response_model=TokenResponse, tags=["auth"])
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """
    Login and return JWT token.
    """
    user = await authenticate_user(db, form_data.username, form_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(user.id, user.email)
    return TokenResponse(access_token=access_token)


# ==================== List Routes ====================


@app.get("/api/lists", response_model=list[ShoppingListWithItemsResponse], tags=["lists"])
async def get_lists(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all shopping lists for the authenticated user.
    Requires authentication.
    """
    lists = await get_user_lists(db, current_user.id)
    return lists


@app.post("/api/lists", response_model=ShoppingListResponse, tags=["lists"])
async def create_list(
    list_data: ShoppingListCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new shopping list.
    Requires authentication.
    """
    shopping_list = await create_shopping_list(db, list_data, current_user)
    return shopping_list


@app.get(
    "/api/lists/{list_id}",
    response_model=ShoppingListWithItemsResponse,
    tags=["lists"],
)
async def get_list(
    list_id: uuid.UUID,
    share_code: Optional[uuid.UUID] = Query(None, alias="share_code"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Get shopping list details.
    Access: auth user (owner), share_code, or public list.
    """
    shopping_list = await get_list_access(list_id, share_code, current_user, db)
    return shopping_list


@app.put(
    "/api/lists/{list_id}",
    response_model=ShoppingListResponse,
    tags=["lists"],
)
async def update_list(
    list_id: uuid.UUID,
    list_data: ShoppingListUpdate,
    share_code: Optional[uuid.UUID] = Query(None, alias="share_code"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Update shopping list details.
    Access: auth user (owner), share_code, or public list.
    """
    shopping_list = await get_list_access(list_id, share_code, current_user, db)
    updated_list = await update_shopping_list(db, shopping_list, list_data)
    return updated_list


@app.delete(
    "/api/lists/{list_id}",
    response_model=MessageResponse,
    tags=["lists"],
)
async def delete_list(
    list_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a shopping list.
    Requires authentication and owner must be the list owner.
    """
    shopping_list = await get_list_by_id(db, list_id)
    
    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shopping list not found",
        )
    
    # Check ownership
    if shopping_list.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the list owner can delete this list",
        )
    
    await delete_shopping_list(db, shopping_list)
    return MessageResponse(message="Shopping list deleted successfully")


@app.post(
    "/api/lists/{list_id}/share",
    response_model=ShareCodeResponse,
    tags=["lists"],
)
async def create_share_link(
    list_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate or update share code for a shopping list.
    Requires authentication and owner must be the list owner.
    """
    shopping_list = await get_list_by_id(db, list_id)
    
    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shopping list not found",
        )
    
    # Check ownership
    if shopping_list.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the list owner can generate a share code",
        )
    
    updated_list = await generate_share_code(db, shopping_list)
    return ShareCodeResponse(share_code=updated_list.share_code)


@app.get(
    "/api/lists/shared/{share_code}",
    response_model=ShoppingListWithItemsResponse,
    tags=["lists"],
)
async def get_shared_list(
    share_code: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Get shopping list by share code.
    No authentication required.
    """
    shopping_list = await get_list_by_share_code(db, share_code)
    
    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shopping list not found",
        )
    
    return shopping_list


# ==================== Item Routes ====================


@app.get(
    "/api/lists/{list_id}/items",
    response_model=list[ListItemResponse],
    tags=["items"],
)
async def get_items(
    list_id: uuid.UUID,
    share_code: Optional[uuid.UUID] = Query(None, alias="share_code"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all items in a shopping list.
    Access: auth user (owner), share_code, or public list.
    """
    shopping_list = await get_list_access(list_id, share_code, current_user, db)
    items = await get_items_by_list_id(db, list_id)
    return items


@app.post(
    "/api/lists/{list_id}/items",
    response_model=ListItemResponse,
    tags=["items"],
)
async def add_item(
    list_id: uuid.UUID,
    item_data: ListItemCreate,
    share_code: Optional[uuid.UUID] = Query(None, alias="share_code"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Add a new item to a shopping list.
    Access: auth user (owner), share_code, or public list.
    """
    shopping_list = await get_list_access(list_id, share_code, current_user, db)
    item = await create_list_item(db, list_id, item_data)
    return item


@app.put(
    "/api/items/{item_id}",
    response_model=ListItemResponse,
    tags=["items"],
)
async def update_item(
    item_id: uuid.UUID,
    item_data: ListItemUpdate,
    share_code: Optional[uuid.UUID] = Query(None, alias="share_code"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Update a list item.
    Access: auth user (owner), share_code, or public list.
    """
    item, _ = await get_item_with_list_access(item_id, share_code, current_user, db)
    updated_item = await update_list_item(db, item, item_data)
    return updated_item


@app.delete(
    "/api/items/{item_id}",
    response_model=MessageResponse,
    tags=["items"],
)
async def delete_item(
    item_id: uuid.UUID,
    share_code: Optional[uuid.UUID] = Query(None, alias="share_code"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a list item.
    Access: auth user (owner), share_code, or public list.
    """
    item, _ = await get_item_with_list_access(item_id, share_code, current_user, db)
    await delete_list_item(db, item)
    return MessageResponse(message="Item deleted successfully")


# ==================== Health Check ====================


@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


# ==================== App Startup ====================


@app.on_event("startup")
async def startup_event():
    """Initialize database tables on startup."""
    await init_db()