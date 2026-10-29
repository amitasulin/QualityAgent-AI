"""Customer routes"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import get_current_user, get_current_tenant, require_role
from app.models.customer import Customer
from app.models.user import User
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse, CustomerListResponse
from app.schemas.base import PaginationParams

router = APIRouter()


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    customer_data: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """Create a new customer"""
    existing = await db.execute(
        select(Customer).where(Customer.tenant_id == tenant.id, Customer.code == customer_data.code)
    )
    if existing.scalar_one_or_none():
        from app.core.exceptions import ConflictError
        raise ConflictError("Customer with this code already exists")

    customer = Customer(**customer_data.model_dump(), tenant_id=tenant.id)
    db.add(customer)
    await db.flush()
    await db.refresh(customer)
    return customer


@router.get("", response_model=CustomerListResponse)
async def list_customers(
    pagination: PaginationParams = Depends(),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """List customers for current tenant"""
    query = select(Customer).where(Customer.tenant_id == tenant.id)

    if search:
        query = query.where(
            or_(
                Customer.code.ilike(f"%{search}%"),
                Customer.name.ilike(f"%{search}%"),
                Customer.contact_person.ilike(f"%{search}%"),
            )
        )
    if is_active is not None:
        query = query.where(Customer.is_active == is_active)

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)
    query = query.order_by(Customer.created_at.desc())

    result = await db.execute(query)
    customers = result.scalars().all()

    return CustomerListResponse.create(
        items=[CustomerResponse.model_validate(c) for c in customers],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Get customer by ID"""
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant.id)
    )
    customer = result.scalar_one_or_none()

    if not customer:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Customer", str(customer_id))

    return customer


@router.patch("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: UUID,
    customer_data: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """Update customer"""
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant.id)
    )
    customer = result.scalar_one_or_none()

    if not customer:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Customer", str(customer_id))

    if customer_data.code and customer_data.code != customer.code:
        existing = await db.execute(
            select(Customer).where(
                Customer.tenant_id == tenant.id,
                Customer.code == customer_data.code,
                Customer.id != customer_id,
            )
        )
        if existing.scalar_one_or_none():
            from app.core.exceptions import ConflictError
            raise ConflictError("Customer with this code already exists")

    update_data = customer_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(customer, field, value)

    await db.flush()
    await db.refresh(customer)
    return customer