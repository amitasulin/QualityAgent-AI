"""User routes"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import get_current_user, get_current_tenant, require_role
from app.models.user import User, UserRole
from app.models.site import Site
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserListResponse, CurrentUserResponse
from app.schemas.base import PaginationParams
from app.core.security import get_password_hash

router = APIRouter()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """Create a new user"""
    # Check if email already exists in tenant
    existing = await db.execute(
        select(User).where(User.tenant_id == tenant.id, User.email == user_data.email)
    )
    if existing.scalar_one_or_none():
        from app.core.exceptions import ConflictError
        raise ConflictError("User with this email already exists")

    # Check if identity_id already exists in tenant
    existing = await db.execute(
        select(User).where(User.tenant_id == tenant.id, User.identity_id == user_data.identity_id)
    )
    if existing.scalar_one_or_none():
        from app.core.exceptions import ConflictError
        raise ConflictError("User with this identity ID already exists")

    # Verify site belongs to tenant if provided
    if user_data.site_id:
        site_result = await db.execute(
            select(Site).where(Site.id == user_data.site_id, Site.tenant_id == tenant.id)
        )
        if not site_result.scalar_one_or_none():
            from app.core.exceptions import NotFoundError
            raise NotFoundError("Site", str(user_data.site_id))

    user = User(
        **user_data.model_dump(exclude={"password"}),
        tenant_id=tenant.id,
        # In production, hash the password
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.get("", response_model=UserListResponse)
async def list_users(
    pagination: PaginationParams = Depends(),
    role: Optional[UserRole] = Query(None),
    site_id: Optional[UUID] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """List users for current tenant"""
    query = select(User).where(User.tenant_id == tenant.id)

    if role:
        query = query.where(User.role == role)
    if site_id:
        query = query.where(User.site_id == site_id)
    if is_active is not None:
        query = query.where(User.is_active == is_active)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Apply pagination
    query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)
    query = query.order_by(User.created_at.desc())

    result = await db.execute(query)
    users = result.scalars().all()

    return UserListResponse.create(
        items=[UserResponse.model_validate(u) for u in users],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/me", response_model=CurrentUserResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    """Get current user profile with permissions"""
    permissions = get_user_permissions(current_user.role)
    return CurrentUserResponse.model_validate(current_user, update={"permissions": permissions})


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Get user by ID"""
    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == tenant.id)
    )
    user = result.scalar_one_or_none()

    if not user:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("User", str(user_id))

    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """Update user"""
    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == tenant.id)
    )
    user = result.scalar_one_or_none()

    if not user:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("User", str(user_id))

    # Prevent non-admins from changing roles
    if current_user.role.value != "admin" and user_data.role is not None:
        from app.core.exceptions import AuthorizationError
        raise AuthorizationError("Only admins can change user roles")

    # Verify site belongs to tenant if provided
    if user_data.site_id:
        site_result = await db.execute(
            select(Site).where(Site.id == user_data.site_id, Site.tenant_id == tenant.id)
        )
        if not site_result.scalar_one_or_none():
            from app.core.exceptions import NotFoundError
            raise NotFoundError("Site", str(user_data.site_id))

    update_data = user_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    await db.flush()
    await db.refresh(user)
    return user


def get_user_permissions(role: UserRole) -> list[str]:
    """Get permissions for a role"""
    permissions = {
        UserRole.ADMIN: [
            "manage_users",
            "manage_sites",
            "manage_organization",
            "view_all_ncrs",
            "create_ncr",
            "edit_ncr",
            "close_ncr",
            "manage_capa",
            "approve_capa",
            "manage_documents",
            "view_dashboard",
            "manage_agent",
            "view_audit_log",
        ],
        UserRole.QUALITY_MANAGER: [
            "view_all_ncrs",
            "create_ncr",
            "edit_ncr",
            "close_ncr",
            "manage_capa",
            "approve_capa",
            "manage_documents",
            "view_dashboard",
            "view_audit_log",
        ],
        UserRole.QUALITY_INSPECTOR: [
            "view_assigned_ncrs",
            "create_ncr",
            "edit_own_ncr",
            "view_capa",
            "update_capa_progress",
            "view_documents",
            "view_dashboard",
        ],
        UserRole.PRODUCTION_WORKER: [
            "create_ncr",
            "view_own_ncrs",
            "view_assigned_tasks",
            "update_task_progress",
        ],
        UserRole.VIEWER: [
            "view_published_documents",
            "view_dashboard_readonly",
        ],
    }
    return permissions.get(role, [])