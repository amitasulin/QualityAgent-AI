"""Product routes"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import get_current_user, get_current_tenant, require_role
from app.models.product import Product
from app.models.user import User
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse, ProductListResponse
from app.schemas.base import PaginationParams

router = APIRouter()


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    product_data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """Create a new product"""
    # Check if SKU already exists in tenant
    existing = await db.execute(
        select(Product).where(Product.tenant_id == tenant.id, Product.sku == product_data.sku)
    )
    if existing.scalar_one_or_none():
        from app.core.exceptions import ConflictError
        raise ConflictError("Product with this SKU already exists")

    product = Product(**product_data.model_dump(), tenant_id=tenant.id)
    db.add(product)
    await db.flush()
    await db.refresh(product)
    return product


@router.get("", response_model=ProductListResponse)
async def list_products(
    pagination: PaginationParams = Depends(),
    search: Optional[str] = Query(None, description="Search in SKU, name, description"),
    category: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """List products for current tenant"""
    query = select(Product).where(Product.tenant_id == tenant.id)

    if search:
        query = query.where(
            or_(
                Product.sku.ilike(f"%{search}%"),
                Product.name.ilike(f"%{search}%"),
                Product.description.ilike(f"%{search}%"),
            )
        )
    if category:
        query = query.where(Product.category == category)
    if is_active is not None:
        query = query.where(Product.is_active == is_active)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Apply pagination
    query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)
    query = query.order_by(Product.created_at.desc())

    result = await db.execute(query)
    products = result.scalars().all()

    return ProductListResponse.create(
        items=[ProductResponse.model_validate(p) for p in products],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Get product by ID"""
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.tenant_id == tenant.id)
    )
    product = result.scalar_one_or_none()

    if not product:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Product", str(product_id))

    return product


@router.patch("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: UUID,
    product_data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """Update product"""
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.tenant_id == tenant.id)
    )
    product = result.scalar_one_or_none()

    if not product:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Product", str(product_id))

    # Check SKU uniqueness if changed
    if product_data.sku and product_data.sku != product.sku:
        existing = await db.execute(
            select(Product).where(
                Product.tenant_id == tenant.id,
                Product.sku == product_data.sku,
                Product.id != product_id,
            )
        )
        if existing.scalar_one_or_none():
            from app.core.exceptions import ConflictError
            raise ConflictError("Product with this SKU already exists")

    update_data = product_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    await db.flush()
    await db.refresh(product)
    return product