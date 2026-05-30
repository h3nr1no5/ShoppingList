"""
FastAPI application with all routes for the shopping list app.
"""
import logging
import os
import uuid
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

# Configure logging - default to INFO, can be overridden by LOG_LEVEL env var
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

# Rate limiting configuration — overridable via env vars
REGISTER_RATE_LIMIT = os.getenv("REGISTER_RATE_LIMIT", "5/minute")
LOGIN_RATE_LIMIT = os.getenv("LOGIN_RATE_LIMIT", "10/minute")
SHARED_LIST_RATE_LIMIT = os.getenv("SHARED_LIST_RATE_LIMIT", "30/minute")
FORGOT_PASSWORD_RATE_LIMIT = os.getenv("FORGOT_PASSWORD_RATE_LIMIT", "3/minute")
RESET_PASSWORD_RATE_LIMIT = os.getenv("RESET_PASSWORD_RATE_LIMIT", "5/minute")


logger = logging.getLogger(__name__)

from fastapi import FastAPI, Depends, status, Query
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import Scope
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, init_db
from models import User, ShoppingList, ListItem
from schemas import (
    UserCreate,
    TokenResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
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
    create_password_reset_token,
    verify_password_reset_token,
    get_password_hash,
)
from crud import (
    create_user,
    authenticate_user,
    get_user_by_email,
    update_password,
    create_shopping_list,
    get_user_lists,
    get_list_by_id,
    get_list_by_share_code,
    get_list_for_access,
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

# Rate limiting setup
def get_client_ip(request: Request) -> str:
    """Extract real client IP from X-Forwarded-For (set by Azure Container Apps).
    Falls back to request.client.host if header is absent."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2
        # The leftmost is the original client
        return forwarded.split(",")[0].strip()
    return request.client.host or "127.0.0.1"


RATELIMIT_ENABLED = os.getenv("RATELIMIT_ENABLED", "true").lower() != "false"
limiter = Limiter(key_func=get_client_ip, enabled=RATELIMIT_ENABLED)
app.state.limiter = limiter


async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Custom 429 handler with Retry-After header."""
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please try again later."},
        headers={"Retry-After": "60"},
    )


app.add_exception_handler(RateLimitExceeded, rate_limit_handler)


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
    """
    # Try to get list by ID (no items needed — access check only)
    shopping_list = await get_list_for_access(db, list_id)
    
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
@limiter.limit(REGISTER_RATE_LIMIT)
async def register(
    request: Request,
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new user and return JWT token.
    Requires valid registration key if REGISTRATION_KEY is set.
    """
    # Check registration key - only enforce if REGISTRATION_KEY is set
    registration_key = os.getenv("REGISTRATION_KEY")
    if registration_key and user_data.invite_code != registration_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid invite code",
        )
    
    try:
        user = await create_user(db, user_data)
    except ValueError as e:
        error_msg = str(e)
        # Pass through known registration errors
        if "Email already registered" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        # For unknown errors (e.g. bcrypt issues), return a clear error
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg,
        )

    access_token = create_access_token(user.id, user.email)
    return TokenResponse(access_token=access_token)


@app.post("/api/auth/login", response_model=TokenResponse, tags=["auth"])
@limiter.limit(LOGIN_RATE_LIMIT)
async def login(
    request: Request,
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


@app.post("/api/auth/forgot-password", response_model=MessageResponse, tags=["auth"])
@limiter.limit(FORGOT_PASSWORD_RATE_LIMIT)
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Request a password reset email.
    Always returns 200 to prevent email enumeration.
    If the email exists, sends a reset link via Resend.
    """
    user = await get_user_by_email(db, data.email)

    if user:
        # Generate reset token (15 min expiry)
        reset_token = create_password_reset_token(user.email)

        # Get frontend URL from env (default for local dev)
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        reset_link = f"{frontend_url}/reset-password/{reset_token}"

        # Send email via Resend
        resend_api_key = os.getenv("RESEND_API_KEY")
        from_email = os.getenv("FROM_EMAIL", "noreply@example.com")

        if resend_api_key:
            try:
                import resend
                resend.api_key = resend_api_key

                params = {
                    "from": from_email,
                    "to": [user.email],
                    "subject": "Reset your Shopping List password",
                    "html": f"""
                        <p>You requested a password reset.</p>
                        <p>Click the link below to reset your password. This link expires in 15 minutes.</p>
                        <p><a href="{reset_link}">{reset_link}</a></p>
                        <p>If you didn't request this, you can ignore this email.</p>
                    """,
                }
                await resend.Emails.send_async(params)
                logger.info("Password reset email sent to %s", user.email)
            except Exception as e:
                logger.error("Failed to send reset email to %s: %s", user.email, e)
        else:
            # Fallback: log minimal info (useful for development)
            # NOTE: reset_link is intentionally NOT logged to avoid leaking the JWT
            # into server logs. Developers should check the application logs for
            # the email address if a reset link wasn't received.
            logger.info(
                "Password reset link generated for %s (RESEND_API_KEY not set)",
                user.email,
            )

    return MessageResponse(
        message="If an account with that email exists, a password reset link has been sent."
    )


@app.post("/api/auth/reset-password", response_model=MessageResponse, tags=["auth"])
@limiter.limit(RESET_PASSWORD_RATE_LIMIT)
async def reset_password(
    request: Request,
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Reset password using a valid reset token.
    """
    # Verify token and extract email
    email = verify_password_reset_token(data.token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    # Hash new password and update
    new_password_hash = get_password_hash(data.password)
    success = await update_password(db, email, new_password_hash)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found",
        )

    logger.info("Password reset successful for %s", email)
    return MessageResponse(message="Password has been reset successfully. You can now log in with your new password.")


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
    Access: auth user (owner) or share_code.
    """
    # Check access (lightweight, no items loaded)
    await get_list_access(list_id, share_code, current_user, db)
    # Re-query with items for the response
    shopping_list = await get_list_by_id(db, list_id)
    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shopping list not found",
        )
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
    Access: auth user (owner) or share_code.
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
    shopping_list = await get_list_for_access(db, list_id)
    
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
    shopping_list = await get_list_for_access(db, list_id)
    
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
@limiter.limit(SHARED_LIST_RATE_LIMIT)
async def get_shared_list(
    request: Request,
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
    Access: auth user (owner) or share_code.
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
    Access: auth user (owner) or share_code.
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
    Access: auth user (owner) or share_code.
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
    Access: auth user (owner) or share_code.
    """
    item, _ = await get_item_with_list_access(item_id, share_code, current_user, db)
    await delete_list_item(db, item)
    return MessageResponse(message="Item deleted successfully")


# ==================== Health Check ====================


@app.api_route("/health", methods=["GET", "OPTIONS"], tags=["health"])
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Readiness health check endpoint.
    Returns 200 only if the application and database are reachable.
    Returns 503 if the database is unreachable (container will be restarted).
    """
    db_ok = False
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        logger.warning("Health check DB probe failed: %s", e)

    status_code = 200 if db_ok else 503
    return JSONResponse(
        content={
            "status": "healthy" if db_ok else "degraded",
            "database": "ok" if db_ok else "unreachable",
        },
        status_code=status_code,
    )


# ==================== Static File Serving ====================


class SPAStaticFiles(StaticFiles):
    """StaticFiles with SPA fallback — serves index.html for unmatched paths."""
    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as e:
            if e.status_code == status.HTTP_404_NOT_FOUND and self.html:
                return await super().get_response("index.html", scope)
            raise


# Mount static files AFTER all API routes so /api/* and /health take priority
STATIC_DIR = os.getenv("STATIC_DIR", "static")
if os.path.isdir(STATIC_DIR):
    static_app = SPAStaticFiles(directory=STATIC_DIR, html=True)
    app.mount("/", static_app, name="static")
else:
    logger.warning("Static directory '%s' not found — frontend SPA will not be served", STATIC_DIR)


# ==================== App Startup ====================


@app.on_event("startup")
async def startup_event():
    """Initialize database tables on startup."""
    logger.info("Application starting up...")
    await init_db()
    logger.info("Startup complete")