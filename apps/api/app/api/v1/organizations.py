"""Organization routes"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import get_current_user, get_current_tenant, require_role
from app.models.organization import Organization, OrganizationStatus
from app.models.user import User
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationListResponse,
)
from app.schemas.base import PaginationParams

router = APIRouter()


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    org_data: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Create a new organization (admin only)"""
    org = Organization(**org_data.model_dump())
    db.add(org)
    await db.flush()
    await db.refresh(org)
    return org


@router.get("", response_model=OrganizationListResponse)
async def list_organizations(
    pagination: PaginationParams = Depends(),
    status_filter: Optional[OrganizationStatus] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """List all organizations (admin only)"""
    query = select(Organization)

    if status_filter:
        query = query.where(Organization.status == status_filter)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Apply pagination
    query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)
    query = query.order_by(Organization.created_at.desc())

    result = await db.execute(query)
    organizations = result.scalars().all()

    return OrganizationListResponse.create(
        items=[OrganizationResponse.model_validate(o) for o in organizations],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get organization by ID"""
    # Users can only access their own organization
    if current_user.role.value != "admin" and current_user.tenant_id != org_id:
        from app.core.exceptions import AuthorizationError
        raise AuthorizationError("Access denied to this organization")

    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if not org:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Organization", str(org_id))

    return org


@router.patch("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: UUID,
    org_data: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Update organization (admin only)"""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if not org:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Organization", str(org_id))

    update_data = org_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(org, field, value)

    await db.flush()
    await db.refresh(org)
    return org


@router.get("/demo/current", response_model=OrganizationResponse)
async def get_demo_organization(
    org: Organization = Depends(get_current_tenant),
):
    """Get demo organization (development only)"""
    return org