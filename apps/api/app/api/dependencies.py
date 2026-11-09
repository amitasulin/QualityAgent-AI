"""Dependencies for authentication and authorization"""
from typing import Optional
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_token
from app.models.user import User
from app.models.organization import Organization


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not authorization or not authorization.startswith("Bearer "):
        raise credentials_exception

    token = authorization.split(" ")[1]
    payload = verify_token(token, "access")

    if not payload:
        raise credentials_exception

    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise credentials_exception

    return user


async def get_current_tenant(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    """Get current tenant (organization) using the request's existing DB session."""
    # Reuse the session opened by get_current_user instead of creating a second
    # connection/transaction for every request.
    result = await db.execute(
        select(Organization).where(Organization.id == current_user.tenant_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    return org


def require_role(*allowed_roles: str):
    """Dependency to require specific role(s)"""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.value not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {', '.join(allowed_roles)}",
            )
        return current_user
    return role_checker


# Demo login: signs in as the seeded demo user without credentials.
# Enabled by default so the deployed demo works; set ALLOW_DEMO_LOGIN=false to disable.
async def get_demo_user(
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get the seeded demo user (used by the demo login endpoint)"""
    from app.core.config import settings

    if not settings.ALLOW_DEMO_LOGIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo login is disabled",
        )

    result = await db.execute(
        select(User).where(User.identity_id == "demo-quality-mgr")
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Demo user not found",
        )

    return user


async def get_demo_tenant(
    db: AsyncSession = Depends(get_db),
) -> Organization:
    """Get demo tenant (used only by development tooling, not by API routes)"""
    from app.core.config import settings

    if settings.ENVIRONMENT != "development":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo tenant is only available in development",
        )

    result = await db.execute(
        select(Organization).where(Organization.id == UUID(settings.DEMO_TENANT_ID))
    )
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Demo organization not found",
        )

    return org