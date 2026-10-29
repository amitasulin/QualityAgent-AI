"""Supplier routes"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import get_current_user, get_current_tenant, require_role
from app.models.supplier import Supplier
from app.models.user import User
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierResponse, SupplierListResponse
from app.schemas.base import PaginationParams

router = APIRouter()


@router.post("", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    supplier_data: SupplierCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """Create a new supplier"""
    existing = await db.execute(
        select(Supplier).where(Supplier.tenant_id == tenant.id, Supplier.code == supplier_data.code)
    )
    if existing.scalar_one_or_none():
        from app.core.exceptions import ConflictError
        raise ConflictError("Supplier with this code already exists")

    supplier = Supplier(**supplier_data.model_dump(), tenant_id=tenant.id)
    db.add(supplier)
    await db.flush()
    await db.refresh(supplier)
    return supplier


@router.get("", response_model=SupplierListResponse)
async def list_suppliers(
    pagination: PaginationParams = Depends(),
    search: Optional[str] = Query(None),
    is_approved: Optional[bool] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """List suppliers for current tenant"""
    query = select(Supplier).where(Supplier.tenant_id == tenant.id)

    if search:
        query = query.where(
            or_(
                Supplier.code.ilike(f"%{search}%"),
                Supplier.name.ilike(f"%{search}%"),
                Supplier.contact_person.ilike(f"%{search}%"),
            )
        )
    if is_approved is not None:
        query = query.where(Supplier.is_approved == is_approved)
    if is_active is not None:
        query = query.where(Supplier.is_active == is_active)

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)
    query = query.order_by(Supplier.created_at.desc())

    result = await db.execute(query)
    suppliers = result.scalars().all()

    return SupplierListResponse.create(
        items=[SupplierResponse.model_validate(s) for s in suppliers],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(
    supplier_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Get supplier by ID"""
    result = await db.execute(
        select(Supplier).where(Supplier.id == supplier_id, Supplier.tenant_id == tenant.id)
    )
    supplier = result.scalar_one_or_none()

    if not supplier:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Supplier", str(supplier_id))

    return supplier


@router.patch("/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: UUID,
    supplier_data: SupplierUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """Update supplier"""
    result = await db.execute(
        select(Supplier).where(Supplier.id == supplier_id, Supplier.tenant_id == tenant.id)
    )
    supplier = result.scalar_one_or_none()

    if not supplier:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Supplier", str(supplier_id))

    if supplier_data.code and supplier_data.code != supplier.code:
        existing = await db.execute(
            select(Supplier).where(
                Supplier.tenant_id == tenant.id,
                Supplier.code == supplier_data.code,
                Supplier.id != supplier_id,
            )
        )
        if existing.scalar_one_or_none():
            from app.core.exceptions import ConflictError
            raise ConflictError("Supplier with this code already exists")

    update_data = supplier_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(supplier, field, value)

    await db.flush()
    await db.refresh(supplier)
    return supplier