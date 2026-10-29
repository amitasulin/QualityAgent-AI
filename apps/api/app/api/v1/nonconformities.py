"""Nonconformity (NCR) routes"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, status, UploadFile, File
from sqlalchemy import select, func, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.dependencies import get_current_user, get_current_tenant, require_role
from app.models.nonconformity import Nonconformity, NCRAttachment, NCRStatus, NCRSeverity
from app.models.user import User
from app.models.product import Product
from app.models.site import Site
from app.models.customer import Customer
from app.models.supplier import Supplier
from app.schemas.nonconformity import (
    NonconformityCreate,
    NonconformityUpdate,
    NonconformityResponse,
    NonconformityListResponse,
    NCRAttachmentResponse,
    NCRStatusTransition,
)
from app.schemas.base import PaginationParams
from app.core.exceptions import NotFoundError, ValidationError as AppValidationError

router = APIRouter()


async def load_ncr(db: AsyncSession, ncr_id: UUID) -> Nonconformity:
    """Reload an NCR with its attachments eagerly loaded.

    Response serialization reads `attachments`, which cannot be lazy-loaded in
    async SQLAlchemy (raises MissingGreenlet).
    """
    result = await db.execute(
        select(Nonconformity)
        .options(selectinload(Nonconformity.attachments))
        .where(Nonconformity.id == ncr_id)
    )
    return result.scalar_one()


async def generate_ncr_number(tenant_id: UUID, db: AsyncSession) -> str:
    """Generate next NCR number for tenant"""
    from sqlalchemy import select, func
    from app.models.nonconformity import Nonconformity

    # Get the highest NCR number for this tenant
    result = await db.execute(
        select(func.max(Nonconformity.number))
        .where(Nonconformity.tenant_id == tenant_id)
    )
    max_number = result.scalar()

    if max_number:
        # Extract numeric part (assuming format NCR-XXXX)
        try:
            num = int(max_number.split("-")[-1])
            next_num = num + 1
        except (ValueError, IndexError):
            next_num = 1
    else:
        next_num = 1

    return f"NCR-{next_num:04d}"


@router.post("", response_model=NonconformityResponse, status_code=status.HTTP_201_CREATED)
async def create_ncr(
    ncr_data: NonconformityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Create a new nonconformity"""
    # Validate references belong to tenant
    if ncr_data.product_id:
        result = await db.execute(
            select(Product).where(Product.id == ncr_data.product_id, Product.tenant_id == tenant.id)
        )
        if not result.scalar_one_or_none():
            raise NotFoundError("Product", str(ncr_data.product_id))

    if ncr_data.site_id:
        result = await db.execute(
            select(Site).where(Site.id == ncr_data.site_id, Site.tenant_id == tenant.id)
        )
        if not result.scalar_one_or_none():
            raise NotFoundError("Site", str(ncr_data.site_id))

    if ncr_data.customer_id:
        result = await db.execute(
            select(Customer).where(Customer.id == ncr_data.customer_id, Customer.tenant_id == tenant.id)
        )
        if not result.scalar_one_or_none():
            raise NotFoundError("Customer", str(ncr_data.customer_id))

    if ncr_data.supplier_id:
        result = await db.execute(
            select(Supplier).where(Supplier.id == ncr_data.supplier_id, Supplier.tenant_id == tenant.id)
        )
        if not result.scalar_one_or_none():
            raise NotFoundError("Supplier", str(ncr_data.supplier_id))

    # Generate NCR number
    ncr_number = await generate_ncr_number(tenant.id, db)

    # Create NCR
    ncr = Nonconformity(
        **ncr_data.model_dump(),
        tenant_id=tenant.id,
        number=ncr_number,
        detected_by_id=current_user.id,
        detected_at=datetime.now(timezone.utc),
        status=NCRStatus.DRAFT,
    )
    db.add(ncr)
    await db.flush()
    return await load_ncr(db, ncr.id)


@router.get("", response_model=NonconformityListResponse)
async def list_ncrs(
    pagination: PaginationParams = Depends(),
    status_filter: Optional[NCRStatus] = Query(None, alias="status"),
    severity: Optional[NCRSeverity] = Query(None),
    product_id: Optional[UUID] = Query(None),
    site_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None, description="Search in number, title, description"),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """List nonconformities for current tenant"""
    query = select(Nonconformity).where(Nonconformity.tenant_id == tenant.id)

    # Role-based filtering
    if current_user.role.value == "production_worker":
        query = query.where(
            or_(
                Nonconformity.detected_by_id == current_user.id,
                Nonconformity.assigned_to_id == current_user.id,
            )
        )
    elif current_user.role.value == "quality_inspector":
        query = query.where(
            or_(
                Nonconformity.detected_by_id == current_user.id,
                Nonconformity.assigned_to_id == current_user.id,
                Nonconformity.site_id == current_user.site_id,
            )
        )

    if status_filter:
        query = query.where(Nonconformity.status == status_filter)
    if severity:
        query = query.where(Nonconformity.severity == severity)
    if product_id:
        query = query.where(Nonconformity.product_id == product_id)
    if site_id:
        query = query.where(Nonconformity.site_id == site_id)
    if search:
        query = query.where(
            or_(
                Nonconformity.number.ilike(f"%{search}%"),
                Nonconformity.title.ilike(f"%{search}%"),
                Nonconformity.description.ilike(f"%{search}%"),
            )
        )
    if date_from:
        query = query.where(Nonconformity.detected_at >= date_from)
    if date_to:
        query = query.where(Nonconformity.detected_at <= date_to)

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)
    query = query.order_by(desc(Nonconformity.detected_at)).options(
        selectinload(Nonconformity.attachments)
    )

    result = await db.execute(query)
    ncrs = result.scalars().all()

    return NonconformityListResponse.create(
        items=[NonconformityResponse.model_validate(n) for n in ncrs],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/stats")
async def ncr_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Aggregate NCR counts for the current tenant."""
    status_rows = await db.execute(
        select(Nonconformity.status, func.count())
        .where(Nonconformity.tenant_id == tenant.id)
        .group_by(Nonconformity.status)
    )
    status_counts = {
        str(getattr(status, "value", status)): count for status, count in status_rows.all()
    }

    severity_rows = await db.execute(
        select(Nonconformity.severity, func.count())
        .where(Nonconformity.tenant_id == tenant.id)
        .group_by(Nonconformity.severity)
    )
    severity_counts = {
        str(getattr(severity, "value", severity)): count for severity, count in severity_rows.all()
    }

    total = sum(status_counts.values())
    closed = status_counts.get("closed", 0)
    critical = severity_counts.get("critical", 0)
    major = severity_counts.get("major", 0)

    return {
        "total": total,
        "open": total - closed,
        "closed": closed,
        "investigating": status_counts.get("investigating", 0),
        "action_pending": status_counts.get("action_pending", 0),
        "reopened": status_counts.get("reopened", 0),
        "critical": critical,
        "major": major,
        "high_severity": critical + major,
    }


@router.get("/{ncr_id}", response_model=NonconformityResponse)
async def get_ncr(
    ncr_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Get nonconformity by ID with attachments and CAPAs"""
    result = await db.execute(
        select(Nonconformity)
        .options(
            selectinload(Nonconformity.attachments),
            selectinload(Nonconformity.corrective_actions),
        )
        .where(Nonconformity.id == ncr_id, Nonconformity.tenant_id == tenant.id)
    )
    ncr = result.scalar_one_or_none()

    if not ncr:
        raise NotFoundError("Nonconformity", str(ncr_id))

    return ncr


@router.patch("/{ncr_id}", response_model=NonconformityResponse)
async def update_ncr(
    ncr_id: UUID,
    ncr_data: NonconformityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Update nonconformity (only in draft status)"""
    result = await db.execute(
        select(Nonconformity).where(Nonconformity.id == ncr_id, Nonconformity.tenant_id == tenant.id)
    )
    ncr = result.scalar_one_or_none()

    if not ncr:
        raise NotFoundError("Nonconformity", str(ncr_id))

    # Only allow updates in draft status, or by quality manager/admin
    if ncr.status != NCRStatus.DRAFT and current_user.role.value not in ["admin", "quality_manager"]:
        raise AppValidationError("Can only update NCR in draft status")

    # Validate references
    if ncr_data.product_id:
        prod_result = await db.execute(
            select(Product).where(Product.id == ncr_data.product_id, Product.tenant_id == tenant.id)
        )
        if not prod_result.scalar_one_or_none():
            raise NotFoundError("Product", str(ncr_data.product_id))

    update_data = ncr_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ncr, field, value)

    await db.flush()
    return await load_ncr(db, ncr.id)


@router.post("/{ncr_id}/submit", response_model=NonconformityResponse)
async def submit_ncr(
    ncr_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Submit NCR for review (draft -> open)"""
    result = await db.execute(
        select(Nonconformity).where(Nonconformity.id == ncr_id, Nonconformity.tenant_id == tenant.id)
    )
    ncr = result.scalar_one_or_none()

    if not ncr:
        raise NotFoundError("Nonconformity", str(ncr_id))

    if ncr.status != NCRStatus.DRAFT:
        raise AppValidationError("Can only submit NCR in draft status")

    ncr.status = NCRStatus.OPEN
    ncr.assigned_to_id = current_user.id  # Auto-assign to submitter for now

    await db.flush()
    return await load_ncr(db, ncr.id)


@router.post("/{ncr_id}/status", response_model=NonconformityResponse)
async def transition_ncr_status(
    ncr_id: UUID,
    transition: NCRStatusTransition,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager", "quality_inspector")),
    tenant=Depends(get_current_tenant),
):
    """Transition NCR status with validation"""
    result = await db.execute(
        select(Nonconformity).where(Nonconformity.id == ncr_id, Nonconformity.tenant_id == tenant.id)
    )
    ncr = result.scalar_one_or_none()

    if not ncr:
        raise NotFoundError("Nonconformity", str(ncr_id))

    # Validate status transition
    valid_transitions = {
        NCRStatus.DRAFT: [NCRStatus.OPEN],
        NCRStatus.OPEN: [NCRStatus.CONTAINED, NCRStatus.INVESTIGATING],
        NCRStatus.CONTAINED: [NCRStatus.INVESTIGATING],
        NCRStatus.INVESTIGATING: [NCRStatus.ACTION_PENDING],
        NCRStatus.ACTION_PENDING: [NCRStatus.EFFECTIVENESS_REVIEW],
        NCRStatus.EFFECTIVENESS_REVIEW: [NCRStatus.CLOSED],
        NCRStatus.CLOSED: [NCRStatus.REOPENED],
        NCRStatus.REOPENED: [NCRStatus.OPEN, NCRStatus.INVESTIGATING],
    }

    if transition.status not in valid_transitions.get(ncr.status, []):
        raise AppValidationError(
            f"Invalid status transition from {ncr.status.value} to {transition.status.value}"
        )

    # Update fields based on transition
    ncr.status = transition.status
    now = datetime.now(timezone.utc)

    if transition.status == NCRStatus.CONTAINED:
        ncr.contained_at = now
        ncr.contained_by_id = current_user.id
        if transition.containment_action:
            ncr.containment_action = transition.containment_action

    if transition.status == NCRStatus.INVESTIGATING:
        if transition.root_cause:
            ncr.root_cause = transition.root_cause
        if transition.root_cause_analysis_method:
            ncr.root_cause_analysis_method = transition.root_cause_analysis_method

    if transition.status == NCRStatus.CLOSED:
        ncr.closed_at = now
        ncr.closed_by_id = current_user.id
        if transition.closure_notes:
            ncr.closure_notes = transition.closure_notes

    await db.flush()
    return await load_ncr(db, ncr.id)


@router.post("/{ncr_id}/attachments", response_model=NCRAttachmentResponse, status_code=status.HTTP_201_CREATED)
async def upload_ncr_attachment(
    ncr_id: UUID,
    file: UploadFile = File(...),
    description: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Upload attachment for NCR"""
    result = await db.execute(
        select(Nonconformity).where(Nonconformity.id == ncr_id, Nonconformity.tenant_id == tenant.id)
    )
    ncr = result.scalar_one_or_none()

    if not ncr:
        raise NotFoundError("Nonconformity", str(ncr_id))

    # In production, upload to S3 and save file_key
    # For demo, we'll just create a record
    attachment = NCRAttachment(
        ncr_id=ncr_id,
        file_key=f"uploads/{tenant.id}/{ncr_id}/{file.filename}",
        file_name=file.filename,
        file_size=file.size,
        mime_type=file.content_type,
        description=description,
        uploaded_by_id=current_user.id,
    )
    db.add(attachment)
    await db.flush()
    await db.refresh(attachment)
    return attachment


@router.delete("/{ncr_id}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ncr_attachment(
    ncr_id: UUID,
    attachment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """Delete NCR attachment"""
    result = await db.execute(
        select(NCRAttachment)
        .join(Nonconformity)
        .where(
            NCRAttachment.id == attachment_id,
            NCRAttachment.ncr_id == ncr_id,
            Nonconformity.tenant_id == tenant.id,
        )
    )
    attachment = result.scalar_one_or_none()

    if not attachment:
        raise NotFoundError("Attachment", str(attachment_id))

    await db.delete(attachment)