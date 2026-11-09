"""Quality inspection routes"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from app.api.dependencies import get_current_user, get_current_tenant
from app.api.v1.nonconformities import generate_ncr_number
from app.core.database import get_db
from app.core.exceptions import NotFoundError, ValidationError as AppValidationError
from app.core.sorting import apply_sorting
from app.models.inspection import (
    Inspection,
    InspectionPlan,
    InspectionResult,
    InspectionResultValue,
    InspectionStatus,
    InspectionType,
)
from app.models.nonconformity import NCRSeverity, NCRStatus, Nonconformity
from app.models.product import Product
from app.models.site import Site
from app.models.user import User
from app.schemas.base import PaginationParams
from app.schemas.inspection import (
    InspectionCreate,
    InspectionListResponse,
    InspectionPlanCreate,
    InspectionPlanListResponse,
    InspectionPlanResponse,
    InspectionPlanUpdate,
    InspectionResponse,
    InspectionResultCreate,
    InspectionResultResponse,
    InspectionStats,
    InspectionUpdate,
)

router = APIRouter()

PLAN_SORT_COLUMNS = {
    "code": InspectionPlan.code,
    "name": InspectionPlan.name,
    "inspection_type": InspectionPlan.inspection_type,
    "frequency": InspectionPlan.frequency,
    "sample_size": InspectionPlan.sample_size,
    "is_active": InspectionPlan.is_active,
    "created_at": InspectionPlan.created_at,
    "updated_at": InspectionPlan.updated_at,
}

INSPECTION_SORT_COLUMNS = {
    "number": Inspection.number,
    "inspection_type": Inspection.inspection_type,
    "status": Inspection.status,
    "lot_number": Inspection.lot_number,
    "inspected_at": Inspection.inspected_at,
    "completed_at": Inspection.completed_at,
    "sample_size": Inspection.sample_size,
    "passed_count": Inspection.passed_count,
    "failed_count": Inspection.failed_count,
    "created_at": Inspection.created_at,
    "updated_at": Inspection.updated_at,
}


# ---------------------------------------------------------------- helpers
async def load_inspection(db: AsyncSession, inspection_id: UUID) -> Inspection:
    """Reload an inspection with all nested data eagerly loaded."""
    result = await db.execute(
        select(Inspection)
        .options(
            selectinload(Inspection.results),
            selectinload(Inspection.plan),
            selectinload(Inspection.product),
            selectinload(Inspection.site),
            selectinload(Inspection.inspector),
        )
        .where(Inspection.id == inspection_id)
    )
    return result.scalar_one()


async def generate_inspection_number(tenant_id: UUID, db: AsyncSession) -> str:
    """Generate next inspection number for tenant (INS-YYYY-####)."""
    year = datetime.now(timezone.utc).year
    result = await db.execute(
        select(func.max(Inspection.number)).where(Inspection.tenant_id == tenant_id)
    )
    max_number = result.scalar()
    next_num = 1
    if max_number:
        try:
            next_num = int(max_number.split("-")[-1]) + 1
        except (ValueError, IndexError):
            next_num = 1
    return f"INS-{year}-{next_num:04d}"


async def _validate_product_site(
    db: AsyncSession, tenant_id: UUID, product_id: Optional[UUID], site_id: Optional[UUID]
) -> None:
    if product_id:
        exists = await db.scalar(
            select(Product.id).where(Product.id == product_id, Product.tenant_id == tenant_id)
        )
        if not exists:
            raise NotFoundError("Product", str(product_id))
    if site_id:
        exists = await db.scalar(
            select(Site.id).where(Site.id == site_id, Site.tenant_id == tenant_id)
        )
        if not exists:
            raise NotFoundError("Site", str(site_id))


def _recount(inspection: Inspection) -> None:
    passed = sum(1 for r in inspection.results if r.result == InspectionResultValue.PASS)
    failed = sum(1 for r in inspection.results if r.result == InspectionResultValue.FAIL)
    inspection.passed_count = passed
    inspection.failed_count = failed


# ---------------------------------------------------------------- stats
@router.get("/stats", response_model=InspectionStats)
async def get_inspection_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Aggregated inspection KPIs for the tenant."""
    rows = await db.execute(
        select(Inspection.status, func.count(Inspection.id))
        .where(Inspection.tenant_id == tenant.id)
        .group_by(Inspection.status)
    )
    counts = {status: count for status, count in rows.all()}

    results_total = (
        await db.scalar(
            select(func.count(InspectionResult.id))
            .join(Inspection, Inspection.id == InspectionResult.inspection_id)
            .where(Inspection.tenant_id == tenant.id)
        )
        or 0
    )
    results_failed = (
        await db.scalar(
            select(func.count(InspectionResult.id))
            .join(Inspection, Inspection.id == InspectionResult.inspection_id)
            .where(
                Inspection.tenant_id == tenant.id,
                InspectionResult.result == InspectionResultValue.FAIL,
            )
        )
        or 0
    )
    open_findings = (
        await db.scalar(
            select(func.count(Nonconformity.id)).where(
                Nonconformity.tenant_id == tenant.id,
                Nonconformity.status.notin_([NCRStatus.CLOSED]),
            )
        )
        or 0
    )

    pass_rate = round((results_total - results_failed) / results_total * 100, 1) if results_total else 0.0

    return InspectionStats(
        total=sum(counts.values()),
        planned=counts.get(InspectionStatus.PLANNED, 0),
        in_progress=counts.get(InspectionStatus.IN_PROGRESS, 0),
        passed=counts.get(InspectionStatus.PASSED, 0),
        failed=counts.get(InspectionStatus.FAILED, 0),
        on_hold=counts.get(InspectionStatus.ON_HOLD, 0),
        pass_rate=pass_rate,
        results_total=results_total,
        results_failed=results_failed,
        open_findings=open_findings,
    )


# ---------------------------------------------------------------- plans
@router.get("/plans", response_model=InspectionPlanListResponse)
async def list_plans(
    pagination: PaginationParams = Depends(),
    inspection_type: Optional[InspectionType] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    query = select(InspectionPlan).where(InspectionPlan.tenant_id == tenant.id)
    if inspection_type:
        query = query.where(InspectionPlan.inspection_type == inspection_type)
    if is_active is not None:
        query = query.where(InspectionPlan.is_active == is_active)
    if search:
        query = query.where(
            or_(
                InspectionPlan.code.ilike(f"%{search}%"),
                InspectionPlan.name.ilike(f"%{search}%"),
            )
        )

    total = await db.scalar(select(func.count()).select_from(query.subquery())) or 0
    query = apply_sorting(
        query,
        PLAN_SORT_COLUMNS,
        pagination.sort_by,
        pagination.sort_order,
        default_order=asc(InspectionPlan.code),
    )
    result = await db.execute(
        query.offset((pagination.page - 1) * pagination.page_size)
        .limit(pagination.page_size)
        .options(selectinload(InspectionPlan.product), selectinload(InspectionPlan.site))
    )
    plans = result.scalars().all()

    counts_rows = await db.execute(
        select(Inspection.plan_id, func.count(Inspection.id))
        .where(Inspection.tenant_id == tenant.id, Inspection.plan_id.is_not(None))
        .group_by(Inspection.plan_id)
    )
    counts = {plan_id: count for plan_id, count in counts_rows.all()}

    items = []
    for plan in plans:
        item = InspectionPlanResponse.model_validate(plan)
        item.inspections_count = counts.get(plan.id, 0)
        items.append(item)

    return InspectionPlanListResponse.create(
        items=items, total=total, page=pagination.page, page_size=pagination.page_size
    )


@router.post("/plans", response_model=InspectionPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(
    data: InspectionPlanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    existing = await db.scalar(
        select(InspectionPlan.id).where(
            InspectionPlan.tenant_id == tenant.id, InspectionPlan.code == data.code
        )
    )
    if existing:
        raise AppValidationError(f"תוכנית בדיקה עם קוד {data.code} כבר קיימת")

    await _validate_product_site(db, tenant.id, data.product_id, data.site_id)

    plan = InspectionPlan(**data.model_dump(), tenant_id=tenant.id)
    db.add(plan)
    await db.flush()

    result = await db.execute(
        select(InspectionPlan)
        .options(selectinload(InspectionPlan.product), selectinload(InspectionPlan.site))
        .where(InspectionPlan.id == plan.id)
    )
    return result.scalar_one()


@router.patch("/plans/{plan_id}", response_model=InspectionPlanResponse)
async def update_plan(
    plan_id: UUID,
    data: InspectionPlanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    result = await db.execute(
        select(InspectionPlan).where(
            InspectionPlan.id == plan_id, InspectionPlan.tenant_id == tenant.id
        )
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise NotFoundError("InspectionPlan", str(plan_id))

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)
    await db.flush()

    result = await db.execute(
        select(InspectionPlan)
        .options(selectinload(InspectionPlan.product), selectinload(InspectionPlan.site))
        .where(InspectionPlan.id == plan.id)
    )
    return result.scalar_one()


# ---------------------------------------------------------------- inspections
@router.get("", response_model=InspectionListResponse)
async def list_inspections(
    pagination: PaginationParams = Depends(),
    status_filter: Optional[InspectionStatus] = Query(None, alias="status"),
    inspection_type: Optional[InspectionType] = Query(None),
    product_id: Optional[UUID] = Query(None),
    site_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    query = select(Inspection).where(Inspection.tenant_id == tenant.id)

    if status_filter:
        query = query.where(Inspection.status == status_filter)
    if inspection_type:
        query = query.where(Inspection.inspection_type == inspection_type)
    if product_id:
        query = query.where(Inspection.product_id == product_id)
    if site_id:
        query = query.where(Inspection.site_id == site_id)
    if search:
        query = query.where(
            or_(
                Inspection.number.ilike(f"%{search}%"),
                Inspection.lot_number.ilike(f"%{search}%"),
                Inspection.notes.ilike(f"%{search}%"),
            )
        )
    if date_from:
        query = query.where(Inspection.created_at >= date_from)
    if date_to:
        query = query.where(Inspection.created_at <= date_to)

    total = await db.scalar(select(func.count()).select_from(query.subquery())) or 0

    query = apply_sorting(
        query,
        INSPECTION_SORT_COLUMNS,
        pagination.sort_by,
        pagination.sort_order,
        default_order=desc(Inspection.created_at),
    )

    result = await db.execute(
        query.offset((pagination.page - 1) * pagination.page_size)
        .limit(pagination.page_size)
        .options(
            selectinload(Inspection.results),
            joinedload(Inspection.plan),
            joinedload(Inspection.product),
            joinedload(Inspection.site),
            joinedload(Inspection.inspector),
        )
    )
    inspections = result.scalars().all()

    return InspectionListResponse.create(
        items=[InspectionResponse.model_validate(i) for i in inspections],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.post("", response_model=InspectionResponse, status_code=status.HTTP_201_CREATED)
async def create_inspection(
    data: InspectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    await _validate_product_site(db, tenant.id, data.product_id, data.site_id)

    plan = None
    if data.plan_id:
        plan = await db.scalar(
            select(InspectionPlan).where(
                InspectionPlan.id == data.plan_id, InspectionPlan.tenant_id == tenant.id
            )
        )
        if not plan:
            raise NotFoundError("InspectionPlan", str(data.plan_id))

    payload = data.model_dump()
    # Inherit defaults from the plan when not supplied explicitly
    if plan:
        payload["product_id"] = payload.get("product_id") or plan.product_id
        payload["site_id"] = payload.get("site_id") or plan.site_id
        payload["inspection_type"] = plan.inspection_type
        payload["sample_size"] = payload.get("sample_size") or plan.sample_size

    inspection = Inspection(
        **{k: v for k, v in payload.items() if k != "inspector_id"},
        tenant_id=tenant.id,
        number=await generate_inspection_number(tenant.id, db),
        status=InspectionStatus.PLANNED,
        inspector_id=payload.get("inspector_id") or current_user.id,
    )
    db.add(inspection)
    await db.flush()
    return await load_inspection(db, inspection.id)


@router.get("/{inspection_id}", response_model=InspectionResponse)
async def get_inspection(
    inspection_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    result = await db.execute(
        select(Inspection)
        .options(
            selectinload(Inspection.results),
            selectinload(Inspection.plan),
            selectinload(Inspection.product),
            selectinload(Inspection.site),
            selectinload(Inspection.inspector),
        )
        .where(Inspection.id == inspection_id, Inspection.tenant_id == tenant.id)
    )
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise NotFoundError("Inspection", str(inspection_id))
    return inspection


@router.patch("/{inspection_id}", response_model=InspectionResponse)
async def update_inspection(
    inspection_id: UUID,
    data: InspectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    result = await db.execute(
        select(Inspection).where(
            Inspection.id == inspection_id, Inspection.tenant_id == tenant.id
        )
    )
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise NotFoundError("Inspection", str(inspection_id))

    update = data.model_dump(exclude_unset=True)
    await _validate_product_site(db, tenant.id, update.get("product_id"), update.get("site_id"))

    for field, value in update.items():
        setattr(inspection, field, value)
    await db.flush()
    return await load_inspection(db, inspection.id)


@router.post(
    "/{inspection_id}/results",
    response_model=InspectionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_result(
    inspection_id: UUID,
    data: InspectionResultCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    result = await db.execute(
        select(Inspection)
        .options(selectinload(Inspection.results))
        .where(Inspection.id == inspection_id, Inspection.tenant_id == tenant.id)
    )
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise NotFoundError("Inspection", str(inspection_id))

    if inspection.status in (InspectionStatus.PASSED, InspectionStatus.FAILED):
        raise AppValidationError("לא ניתן להוסיף תוצאות לבדיקה שהסתיימה")

    inspection.results.append(InspectionResult(**data.model_dump(), tenant_id=tenant.id))
    if inspection.status == InspectionStatus.PLANNED:
        inspection.status = InspectionStatus.IN_PROGRESS
    if inspection.inspected_at is None:
        inspection.inspected_at = datetime.now(timezone.utc)

    _recount(inspection)
    await db.flush()
    return await load_inspection(db, inspection.id)


@router.delete("/{inspection_id}/results/{result_id}", response_model=InspectionResponse)
async def delete_result(
    inspection_id: UUID,
    result_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    result = await db.execute(
        select(Inspection)
        .options(selectinload(Inspection.results))
        .where(Inspection.id == inspection_id, Inspection.tenant_id == tenant.id)
    )
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise NotFoundError("Inspection", str(inspection_id))

    target = next((r for r in inspection.results if r.id == result_id), None)
    if not target:
        raise NotFoundError("InspectionResult", str(result_id))

    inspection.results.remove(target)
    _recount(inspection)
    await db.flush()
    return await load_inspection(db, inspection.id)


@router.post("/{inspection_id}/complete", response_model=InspectionResponse)
async def complete_inspection(
    inspection_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Close an inspection; automatically opens an NCR when it has failures."""
    result = await db.execute(
        select(Inspection)
        .options(selectinload(Inspection.results))
        .where(Inspection.id == inspection_id, Inspection.tenant_id == tenant.id)
    )
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise NotFoundError("Inspection", str(inspection_id))

    if inspection.status in (InspectionStatus.PASSED, InspectionStatus.FAILED):
        raise AppValidationError("הבדיקה כבר הושלמה")

    if not inspection.results:
        raise AppValidationError("לא ניתן להשלים בדיקה ללא תוצאות")

    _recount(inspection)
    now = datetime.now(timezone.utc)
    inspection.completed_at = now
    if inspection.inspected_at is None:
        inspection.inspected_at = now

    if inspection.failed_count > 0:
        inspection.status = InspectionStatus.FAILED
        if inspection.ncr_id is None:
            failed_characteristics = [
                r.characteristic
                for r in inspection.results
                if r.result == InspectionResultValue.FAIL
            ]
            ncr = Nonconformity(
                tenant_id=tenant.id,
                number=await generate_ncr_number(tenant.id, db),
                title=f"אי-התאמה בבדיקה {inspection.number}",
                description=(
                    f"בבדיקת איכות {inspection.number} נמצאו {inspection.failed_count} "
                    f"ממצאים חורגים מתוך {inspection.passed_count + inspection.failed_count} בדיקות.\n"
                    f"מאפיינים חורגים: {', '.join(failed_characteristics)}"
                ),
                severity=NCRSeverity.MAJOR,
                status=NCRStatus.OPEN,
                product_id=inspection.product_id,
                site_id=inspection.site_id,
                lot_number=inspection.lot_number,
                detected_by_id=current_user.id,
                detected_at=now,
                assigned_to_id=current_user.id,
                defect_description=", ".join(failed_characteristics),
            )
            db.add(ncr)
            await db.flush()
            inspection.ncr_id = ncr.id
    else:
        inspection.status = InspectionStatus.PASSED

    await db.flush()
    return await load_inspection(db, inspection.id)
