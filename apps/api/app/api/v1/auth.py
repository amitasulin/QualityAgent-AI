"""Authentication routes"""
import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import write_audit_event
from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import RateLimitError
from app.core.login_guard import client_ip, login_guard, login_keys
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
)
from app.api.dependencies import get_current_user, get_demo_user
from app.models.user import User
from app.models.organization import Organization
from app.schemas.auth import (
    Token,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    ChangePasswordRequest,
)
from app.schemas.user import UserResponse

router = APIRouter()
logger = logging.getLogger("qualityagent.auth")


def _invalid_credentials() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def _audit_failed_login(
    user: User,
    email: str,
    request: Request,
    reason: str,
) -> None:
    """Record a failed sign-in attempt in the audit trail (best effort)."""
    try:
        await write_audit_event(
            tenant_id=user.tenant_id,
            user_id=None,
            action="login_failed",
            entity_type="user",
            entity_id=user.id,
            method="POST",
            path="/api/v1/auth/login",
            status_code=status.HTTP_401_UNAUTHORIZED,
            ip_address=client_ip(request),
            user_agent=(request.headers.get("user-agent") or "")[:1000] or None,
            actor_type="anonymous",
            details={"email": email.strip().lower(), "reason": reason},
        )
    except Exception:
        logger.exception("Failed to audit a failed login attempt")


@router.post("/login", response_model=Token)
async def login(
    credentials: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Login with email and password"""
    keys = login_keys(request, credentials.email)
    retry_after = login_guard.check(keys)
    if retry_after:
        raise RateLimitError(retry_after)

    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if not user:
        login_guard.record_failure(keys)
        raise _invalid_credentials()

    if not user.is_active:
        login_guard.record_failure(keys)
        await _audit_failed_login(user, credentials.email, request, "inactive")
        raise _invalid_credentials()

    # Demo mode: seeded demo users authenticate with the documented demo password
    is_demo_user = user.identity_id.startswith("demo-")
    password_ok = False
    if user.password_hash:
        password_ok = verify_password(credentials.password, user.password_hash)
    if not password_ok and is_demo_user and credentials.password == "demo123":
        password_ok = True

    if not password_ok:
        login_guard.record_failure(keys)
        await _audit_failed_login(user, credentials.email, request, "bad_password")
        raise _invalid_credentials()

    login_guard.reset(keys)

    access_token = create_access_token(
        data={"sub": str(user.id), "tenant_id": str(user.tenant_id), "role": user.role.value}
    )
    refresh_token = create_refresh_token(
        data={"sub": str(user.id), "tenant_id": str(user.tenant_id)}
    )

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Refresh access token using refresh token"""
    from app.core.security import verify_token

    payload = verify_token(request.refresh_token, "refresh")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    access_token = create_access_token(
        data={"sub": str(user.id), "tenant_id": str(user.tenant_id), "role": user.role.value}
    )
    new_refresh_token = create_refresh_token(
        data={"sub": str(user.id), "tenant_id": str(user.tenant_id)}
    )

    return Token(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    """Get current user profile"""
    return current_user


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change the password of the authenticated user"""
    current_ok = False
    if current_user.password_hash:
        current_ok = verify_password(payload.current_password, current_user.password_hash)
    elif current_user.identity_id.startswith("demo-") and payload.current_password == "demo123":
        current_ok = True

    if not current_ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.password_hash = get_password_hash(payload.new_password)
    await db.flush()
    return {"message": "Password updated"}


@router.api_route("/demo-login", methods=["GET", "POST"], response_model=Token)
async def demo_login(
    db: AsyncSession = Depends(get_db),
):
    """Demo login - returns a token for the seeded demo user.

    Enabled unless ALLOW_DEMO_LOGIN is false, so the public demo keeps working
    in production.
    """
    if not settings.ALLOW_DEMO_LOGIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo login is disabled",
        )

    user = await get_demo_user(db)

    access_token = create_access_token(
        data={"sub": str(user.id), "tenant_id": str(user.tenant_id), "role": user.role.value}
    )
    refresh_token = create_refresh_token(
        data={"sub": str(user.id), "tenant_id": str(user.tenant_id)}
    )

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )