"""Site routes"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import get_current_user, get_current_tenant, require_role
from app.models.site import Site
from app.models.user import User
from app.schemas.site import SiteCreate, SiteUpdate, SiteResponse, SiteListResponse
from app.schemas.base import PaginationParams

router = APIRouter()


@router.post("", response_model=SiteResponse, status_code=status.HTTP_201_CREATED)
async def create_site(
    site_data: SiteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """Create a new site"""
    site = Site(**site_data.model_dump(), tenant_id=tenant.id)
    db.add(site)
    await db.flush()
    await db.refresh(site)
    return site


@router.get("", response_model=SiteListResponse)
async def list_sites(
    pagination: PaginationParams = Depends(),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None, max_length=255),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """List sites for current tenant"""
    query = select(Site).where(Site.tenant_id == tenant.id)

    if is_active is not None:
        query = query.where(Site.is_active == is_active)
    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Site.name.ilike(term),
                Site.code.ilike(term),
                Site.address.ilike(term),
            )
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Apply ordering and pagination
    query = query.order_by(Site.created_at.desc())
    query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)

    result = await db.execute(query)
    sites = result.scalars().all()

    return SiteListResponse.create(
        items=[SiteResponse.model_validate(s) for s in sites],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{site_id}", response_model=SiteResponse)
async def get_site(
    site_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Get site by ID"""
    result = await db.execute(
        select(Site).where(Site.id == site_id, Site.tenant_id == tenant.id)
    )
    site = result.scalar_one_or_none()

    if not site:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Site", str(site_id))

    return site


@router.patch("/{site_id}", response_model=SiteResponse)
async def update_site(
    site_id: UUID,
    site_data: SiteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """Update site"""
    result = await db.execute(
        select(Site).where(Site.id == site_id, Site.tenant_id == tenant.id)
    )
    site = result.scalar_one_or_none()

    if not site:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Site", str(site_id))

    update_data = site_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(site, field, value)

    await db.flush()
    await db.refresh(site)
    return site