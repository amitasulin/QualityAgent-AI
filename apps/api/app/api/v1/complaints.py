"""Customer complaint routes"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_current_user, get_current_tenant
from app.api.v1.nonconformities import generate_ncr_number
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.models.complaint import (
    Complaint,
    ComplaintSeverity,
    ComplaintStatus,
)
from app.models.customer import Customer
from app.models.nonconformity import NCRSeverity, NCRStatus, Nonconformity
from app.models.product import Product
from app.models.user import User
from app.schemas.base import PaginationParams
from app.schemas.complaint import (
    ComplaintCreate,
    ComplaintListResponse,
    ComplaintResponse,
    ComplaintStats,
    ComplaintUpdate,
)

router = APIRouter()

OPEN_STATUSES = [
    ComplaintStatus.NEW,
    ComplaintStatus.UNDER_REVIEW,
    ComplaintStatus.INVESTIGATING,
    ComplaintStatus.ACTION_PENDING,
]

SEVERITY_MAP = {
    ComplaintSeverity.CRITICAL: NCRSeverity.CRITICAL,
    ComplaintSeverity.MAJOR: NCRSeverity.MAJOR,
    ComplaintSeverity.MINOR: NCRSeverity.MINOR,
    ComplaintSeverity.OBSERVATION: NCRSeverity.OBSERVATION,
}


# ---------------------------------------------------------------- helpers
def _now() -> datetime:
    return datetime.now(timezone.utc)


def _load_options():
    return (
        selectinload(Complaint.customer),
        selectinload(Complaint.product),
        selectinload(Complaint.assigned_to),
        selectinload(Complaint.ncr),
    )


async def load_complaint(db: AsyncSession, complaint_id: UUID) -> Complaint:
    """Reload a complaint with all nested data eagerly loaded."""
    result = await db.execute(
        select(Complaint).options(*_load_options()).where(Complaint.id == complaint_id)
    )
    return result.scalar_one()


async def generate_complaint_number(tenant_id: UUID, db: AsyncSession) -> str:
    """Generate next complaint number for tenant (CMP-YYYY-####)."""
    year = _now().year
    prefix = f"CMP-{year}-"
    result = await db.execute(
        select(Complaint.number)
        .where(Complaint.tenant_id == tenant_id, Complaint.number.like(f"{prefix}%"))
        .order_by(desc(Complaint.number))
        .limit(1)
    )
    max_number = result.scalar()
    next_num = 1
    if max_number:
        try:
            next_num = int(max_number.split("-")[-1]) + 1
        except (ValueError, IndexError):
            next_num = 1
    return f"{prefix}{next_num:04d}"


async def _validate_relations(
    db: AsyncSession,
    tenant_id: UUID,
    customer_id: Optional[UUID],
    product_id: Optional[UUID],
    assigned_to_id: Optional[UUID],
) -> None:
    if customer_id:
        exists = await db.scalar(
            select(Customer.id).where(
                Customer.id == customer_id, Customer.tenant_id == tenant_id
            )
        )
        if not exists:
            raise NotFoundError("Customer", str(customer_id))
    if product_id:
        exists = await db.scalar(
            select(Product.id).where(
                Product.id == product_id, Product.tenant_id == tenant_id
            )
        )
        if not exists:
            raise NotFoundError("Product", str(product_id))
    if assigned_to_id:
        exists = await db.scalar(select(User.id).where(User.id == assigned_to_id))
        if not exists:
            raise NotFoundError("User", str(assigned_to_id))


def _apply_status_timestamps(complaint: Complaint, new_status: ComplaintStatus) -> None:
    now = _now()
    if complaint.acknowledged_at is None and new_status != ComplaintStatus.NEW:
        complaint.acknowledged_at = now
    if new_status == ComplaintStatus.RESOLVED and complaint.resolved_at is None:
        complaint.resolved_at = now
    if new_status == ComplaintStatus.CLOSED:
        if complaint.resolved_at is None:
            complaint.resolved_at = now
        if complaint.closed_at is None:
            complaint.closed_at = now


# ---------------------------------------------------------------- stats
@router.get("/stats", response_model=ComplaintStats)
async def get_complaint_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Aggregated complaint KPIs for the tenant."""
    rows = await db.execute(
        select(Complaint.status, func.count(Complaint.id))
        .where(Complaint.tenant_id == tenant.id)
        .group_by(Complaint.status)
    )
    counts = {status: count for status, count in rows.all()}

    severity_rows = await db.execute(
        select(Complaint.severity, func.count(Complaint.id))
        .where(Complaint.tenant_id == tenant.id)
        .group_by(Complaint.severity)
    )
    severity_counts = {severity: count for severity, count in severity_rows.all()}

    overdue = (
        await db.scalar(
            select(func.count(Complaint.id)).where(
                Complaint.tenant_id == tenant.id,
                Complaint.due_date.isnot(None),
                Complaint.due_date < _now(),
                Complaint.status.notin_(
                    [
                        ComplaintStatus.RESOLVED,
                        ComplaintStatus.CLOSED,
                        ComplaintStatus.REJECTED,
                    ]
                ),
            )
        )
        or 0
    )

    avg_satisfaction = (
        await db.scalar(
            select(func.avg(Complaint.satisfaction_rating)).where(
                Complaint.tenant_id == tenant.id,
                Complaint.satisfaction_rating.isnot(None),
            )
        )
        or 0
    )

    resolution_rows = await db.execute(
        select(Complaint.received_at, Complaint.resolved_at).where(
            Complaint.tenant_id == tenant.id,
            Complaint.resolved_at.isnot(None),
        )
    )
    durations = [
        (resolved_at - received_at).total_seconds() / 86400
        for received_at, resolved_at in resolution_rows.all()
        if received_at and resolved_at
    ]

    open_count = sum(counts.get(status, 0) for status in OPEN_STATUSES)

    return ComplaintStats(
        total=sum(counts.values()),
        new=counts.get(ComplaintStatus.NEW, 0),
        under_review=counts.get(ComplaintStatus.UNDER_REVIEW, 0),
        investigating=counts.get(ComplaintStatus.INVESTIGATING, 0),
        action_pending=counts.get(ComplaintStatus.ACTION_PENDING, 0),
        resolved=counts.get(ComplaintStatus.RESOLVED, 0),
        closed=counts.get(ComplaintStatus.CLOSED, 0),
        rejected=counts.get(ComplaintStatus.REJECTED, 0),
        open=open_count,
        critical=severity_counts.get(ComplaintSeverity.CRITICAL, 0),
        major=severity_counts.get(ComplaintSeverity.MAJOR, 0),
        high_severity=severity_counts.get(ComplaintSeverity.CRITICAL, 0)
        + severity_counts.get(ComplaintSeverity.MAJOR, 0),
        overdue=overdue,
        avg_satisfaction=round(float(avg_satisfaction), 2),
        avg_resolution_days=round(sum(durations) / len(durations), 1) if durations else 0.0,
    )


# ---------------------------------------------------------------- list
@router.get("", response_model=ComplaintListResponse)
async def list_complaints(
    pagination: PaginationParams = Depends(),
    status_filter: Optional[ComplaintStatus] = Query(None, alias="status"),
    severity: Optional[ComplaintSeverity] = Query(None),
    customer_id: Optional[UUID] = Query(None),
    assigned_to_id: Optional[UUID] = Query(None),
    overdue: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    query = select(Complaint).where(Complaint.tenant_id == tenant.id)

    if status_filter:
        query = query.where(Complaint.status == status_filter)
    if severity:
        query = query.where(Complaint.severity == severity)
    if customer_id:
        query = query.where(Complaint.customer_id == customer_id)
    if assigned_to_id:
        query = query.where(Complaint.assigned_to_id == assigned_to_id)
    if overdue:
        query = query.where(
            Complaint.due_date.isnot(None),
            Complaint.due_date < _now(),
            Complaint.status.notin_(
                [
                    ComplaintStatus.RESOLVED,
                    ComplaintStatus.CLOSED,
                    ComplaintStatus.REJECTED,
                ]
            ),
        )
    if search:
        query = query.where(
            or_(
                Complaint.number.ilike(f"%{search}%"),
                Complaint.title.ilike(f"%{search}%"),
                Complaint.description.ilike(f"%{search}%"),
                Complaint.lot_number.ilike(f"%{search}%"),
                Complaint.customer_reference.ilike(f"%{search}%"),
            )
        )
    if date_from:
        query = query.where(Complaint.received_at >= date_from)
    if date_to:
        query = query.where(Complaint.received_at <= date_to)

    total = await db.scalar(select(func.count()).select_from(query.subquery())) or 0

    result = await db.execute(
        query.order_by(desc(Complaint.received_at))
        .offset((pagination.page - 1) * pagination.page_size)
        .limit(pagination.page_size)
        .options(*_load_options())
    )
    complaints = result.scalars().all()

    return ComplaintListResponse.create(
        items=[ComplaintResponse.model_validate(c) for c in complaints],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


# ---------------------------------------------------------------- create
@router.post("", response_model=ComplaintResponse, status_code=status.HTTP_201_CREATED)
async def create_complaint(
    data: ComplaintCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    await _validate_relations(
        db, tenant.id, data.customer_id, data.product_id, data.assigned_to_id
    )

    payload = data.model_dump()
    received_at = payload.pop("received_at", None) or _now()
    assigned_to_id = payload.pop("assigned_to_id", None) or current_user.id

    complaint = Complaint(
        **payload,
        received_at=received_at,
        tenant_id=tenant.id,
        number=await generate_complaint_number(tenant.id, db),
        status=ComplaintStatus.NEW,
        assigned_to_id=assigned_to_id,
    )
    db.add(complaint)
    await db.flush()
    return await load_complaint(db, complaint.id)


# ---------------------------------------------------------------- detail
@router.get("/{complaint_id}", response_model=ComplaintResponse)
async def get_complaint(
    complaint_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    result = await db.execute(
        select(Complaint)
        .options(*_load_options())
        .where(Complaint.id == complaint_id, Complaint.tenant_id == tenant.id)
    )
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise NotFoundError("Complaint", str(complaint_id))
    return complaint


# ---------------------------------------------------------------- update
@router.patch("/{complaint_id}", response_model=ComplaintResponse)
async def update_complaint(
    complaint_id: UUID,
    data: ComplaintUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    result = await db.execute(
        select(Complaint).where(
            Complaint.id == complaint_id, Complaint.tenant_id == tenant.id
        )
    )
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise NotFoundError("Complaint", str(complaint_id))

    update = data.model_dump(exclude_unset=True)
    await _validate_relations(
        db,
        tenant.id,
        update.get("customer_id"),
        update.get("product_id"),
        update.get("assigned_to_id"),
    )

    new_status = update.get("status")
    for field, value in update.items():
        setattr(complaint, field, value)

    if new_status is not None:
        _apply_status_timestamps(complaint, new_status)

    await db.flush()
    return await load_complaint(db, complaint.id)


# ---------------------------------------------------------------- create NCR
@router.post(
    "/{complaint_id}/create-ncr",
    response_model=ComplaintResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_ncr_from_complaint(
    complaint_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    result = await db.execute(
        select(Complaint).where(
            Complaint.id == complaint_id, Complaint.tenant_id == tenant.id
        )
    )
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise NotFoundError("Complaint", str(complaint_id))
    if complaint.ncr_id:
        return await load_complaint(db, complaint.id)

    ncr = Nonconformity(
        tenant_id=tenant.id,
        number=await generate_ncr_number(tenant.id, db),
        title=f"×ª×œ×•× ×ª ×œ×§×•×— {complaint.number}: {complaint.title}",
        description=complaint.description,
        severity=SEVERITY_MAP.get(complaint.severity, NCRSeverity.MINOR),
        status=NCRStatus.OPEN,
        customer_id=complaint.customer_id,
        product_id=complaint.product_id,
        lot_number=complaint.lot_number,
        detected_by_id=current_user.id,
        detected_at=complaint.received_at,
        assigned_to_id=complaint.assigned_to_id,
    )
    db.add(ncr)
    await db.flush()

    complaint.ncr_id = ncr.id
    if complaint.status in (ComplaintStatus.NEW, ComplaintStatus.UNDER_REVIEW):
        complaint.status = ComplaintStatus.INVESTIGATING
        _apply_status_timestamps(complaint, ComplaintStatus.INVESTIGATING)

    await db.flush()
    return await load_complaint(db, complaint.id)
