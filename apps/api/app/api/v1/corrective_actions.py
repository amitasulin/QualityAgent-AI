"""Corrective Action (CAPA) routes"""
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, func, or_, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.dependencies import get_current_user, get_current_tenant, require_role
from app.models.corrective_action import CorrectiveAction, EffectivenessCheck, CAPAStatus
from app.models.nonconformity import Nonconformity
from app.models.user import User
from app.schemas.corrective_action import (
    CorrectiveActionCreate,
    CorrectiveActionUpdate,
    CorrectiveActionResponse,
    CorrectiveActionListResponse,
    EffectivenessCheckCreate,
    EffectivenessCheckResponse,
)
from app.schemas.base import PaginationParams
from app.core.exceptions import NotFoundError, ValidationError as AppValidationError
from app.core.sorting import apply_sorting

router = APIRouter()

SORT_COLUMNS = {
    "title": CorrectiveAction.title,
    "status": CorrectiveAction.status,
    "action_type": CorrectiveAction.action_type,
    "due_date": CorrectiveAction.due_date,
    "started_at": CorrectiveAction.started_at,
    "completed_at": CorrectiveAction.completed_at,
    "effectiveness_check_date": CorrectiveAction.effectiveness_check_date,
    "created_at": CorrectiveAction.created_at,
    "updated_at": CorrectiveAction.updated_at,
}


@router.post("", response_model=CorrectiveActionResponse, status_code=status.HTTP_201_CREATED)
async def create_capa(
    capa_data: CorrectiveActionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """Create a new corrective action"""
    # Verify NCR exists and belongs to tenant
    ncr_result = await db.execute(
        select(Nonconformity).where(
            Nonconformity.id == capa_data.ncr_id, Nonconformity.tenant_id == tenant.id
        )
    )
    ncr = ncr_result.scalar_one_or_none()

    if not ncr:
        raise NotFoundError("Nonconformity", str(capa_data.ncr_id))

    # Verify owner belongs to tenant if provided
    if capa_data.owner_id:
        user_result = await db.execute(
            select(User).where(User.id == capa_data.owner_id, User.tenant_id == tenant.id)
        )
        if not user_result.scalar_one_or_none():
            raise NotFoundError("User", str(capa_data.owner_id))

    capa = CorrectiveAction(
        **capa_data.model_dump(),
        tenant_id=tenant.id,
        status=CAPAStatus.DRAFT,
    )
    db.add(capa)
    await db.flush()
    await db.refresh(capa)
    return capa


@router.get("", response_model=CorrectiveActionListResponse)
async def list_capas(
    pagination: PaginationParams = Depends(),
    status_filter: Optional[CAPAStatus] = Query(None, alias="status"),
    ncr_id: Optional[UUID] = Query(None),
    owner_id: Optional[UUID] = Query(None),
    overdue: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """List corrective actions for current tenant"""
    query = select(CorrectiveAction).where(CorrectiveAction.tenant_id == tenant.id)

    # Role-based filtering
    if current_user.role.value == "production_worker":
        query = query.where(CorrectiveAction.owner_id == current_user.id)

    if status_filter:
        query = query.where(CorrectiveAction.status == status_filter)
    if ncr_id:
        query = query.where(CorrectiveAction.ncr_id == ncr_id)
    if owner_id:
        query = query.where(CorrectiveAction.owner_id == owner_id)
    if overdue:
        query = query.where(
            CorrectiveAction.due_date < date.today(),
            CorrectiveAction.status.not_in([CAPAStatus.COMPLETED, CAPAStatus.REJECTED]),
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    query = apply_sorting(
        query,
        SORT_COLUMNS,
        pagination.sort_by,
        pagination.sort_order,
        default_order=asc(CorrectiveAction.due_date),
    )
    query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)

    result = await db.execute(query)
    capas = result.scalars().all()

    return CorrectiveActionListResponse.create(
        items=[CorrectiveActionResponse.model_validate(c) for c in capas],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/stats")
async def capa_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Aggregate CAPA counts for the current tenant."""
    status_rows = await db.execute(
        select(CorrectiveAction.status, func.count())
        .where(CorrectiveAction.tenant_id == tenant.id)
        .group_by(CorrectiveAction.status)
    )
    status_counts = {
        str(getattr(status, "value", status)): count for status, count in status_rows.all()
    }

    overdue = await db.scalar(
        select(func.count())
        .select_from(CorrectiveAction)
        .where(
            CorrectiveAction.tenant_id == tenant.id,
            CorrectiveAction.due_date < date.today(),
            CorrectiveAction.status.not_in([CAPAStatus.COMPLETED, CAPAStatus.REJECTED]),
        )
    )

    total = sum(status_counts.values())
    completed = status_counts.get("completed", 0)
    rejected = status_counts.get("rejected", 0)

    return {
        "total": total,
        "open": total - completed - rejected,
        "overdue": overdue or 0,
        "completed": completed,
        "rejected": rejected,
        "effectiveness_check": status_counts.get("effectiveness_check", 0),
        "pending_review": status_counts.get("pending_review", 0),
    }


@router.get("/{capa_id}", response_model=CorrectiveActionResponse)
async def get_capa(
    capa_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Get corrective action by ID with effectiveness checks"""
    result = await db.execute(
        select(CorrectiveAction)
        .options(selectinload(CorrectiveAction.effectiveness_checks))
        .where(CorrectiveAction.id == capa_id, CorrectiveAction.tenant_id == tenant.id)
    )
    capa = result.scalar_one_or_none()

    if not capa:
        raise NotFoundError("CorrectiveAction", str(capa_id))

    return capa


@router.patch("/{capa_id}", response_model=CorrectiveActionResponse)
async def update_capa(
    capa_id: UUID,
    capa_data: CorrectiveActionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Update corrective action"""
    result = await db.execute(
        select(CorrectiveAction).where(CorrectiveAction.id == capa_id, CorrectiveAction.tenant_id == tenant.id)
    )
    capa = result.scalar_one_or_none()

    if not capa:
        raise NotFoundError("CorrectiveAction", str(capa_id))

    # Role-based permissions
    can_edit = (
        current_user.role.value in ["admin", "quality_manager"]
        or (current_user.role.value == "quality_inspector" and capa.status in [CAPAStatus.DRAFT, CAPAStatus.ASSIGNED])
        or (current_user.id == capa.owner_id and capa.status in [CAPAStatus.ASSIGNED, CAPAStatus.IN_PROGRESS])
    )

    if not can_edit:
        from app.core.exceptions import AuthorizationError
        raise AuthorizationError("Not authorized to edit this CAPA")

    update_data = capa_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(capa, field, value)

    await db.flush()
    await db.refresh(capa)
    return capa


@router.post("/{capa_id}/start", response_model=CorrectiveActionResponse)
async def start_capa(
    capa_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Start working on CAPA (assigned -> in_progress)"""
    result = await db.execute(
        select(CorrectiveAction).where(CorrectiveAction.id == capa_id, CorrectiveAction.tenant_id == tenant.id)
    )
    capa = result.scalar_one_or_none()

    if not capa:
        raise NotFoundError("CorrectiveAction", str(capa_id))

    if capa.status not in [CAPAStatus.DRAFT, CAPAStatus.ASSIGNED]:
        raise AppValidationError("Can only start CAPA in draft or assigned status")

    capa.status = CAPAStatus.IN_PROGRESS
    capa.started_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(capa)
    return capa


@router.post("/{capa_id}/complete", response_model=CorrectiveActionResponse)
async def complete_capa(
    capa_id: UUID,
    verification_notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager", "quality_inspector")),
    tenant=Depends(get_current_tenant),
):
    """Mark CAPA as completed (pending verification)"""
    result = await db.execute(
        select(CorrectiveAction).where(CorrectiveAction.id == capa_id, CorrectiveAction.tenant_id == tenant.id)
    )
    capa = result.scalar_one_or_none()

    if not capa:
        raise NotFoundError("CorrectiveAction", str(capa_id))

    if capa.status != CAPAStatus.IN_PROGRESS:
        raise AppValidationError("Can only complete CAPA in progress")

    capa.status = CAPAStatus.PENDING_REVIEW
    capa.completed_at = datetime.now(timezone.utc)
    if verification_notes:
        capa.verification_notes = verification_notes

    await db.flush()
    await db.refresh(capa)
    return capa


@router.post("/{capa_id}/verify", response_model=CorrectiveActionResponse)
async def verify_capa(
    capa_id: UUID,
    verification_notes: str,
    effectiveness_check_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """Verify CAPA completion (quality manager only)"""
    result = await db.execute(
        select(CorrectiveAction).where(CorrectiveAction.id == capa_id, CorrectiveAction.tenant_id == tenant.id)
    )
    capa = result.scalar_one_or_none()

    if not capa:
        raise NotFoundError("CorrectiveAction", str(capa_id))

    if capa.status != CAPAStatus.PENDING_REVIEW:
        raise AppValidationError("Can only verify CAPA pending review")

    capa.status = CAPAStatus.EFFECTIVENESS_CHECK
    capa.verified_by_id = current_user.id
    capa.verified_at = datetime.now(timezone.utc)
    capa.verification_notes = verification_notes
    if effectiveness_check_date:
        capa.effectiveness_check_date = effectiveness_check_date

    await db.flush()
    await db.refresh(capa)
    return capa


@router.post("/{capa_id}/effectiveness", response_model=EffectivenessCheckResponse, status_code=status.HTTP_201_CREATED)
async def create_effectiveness_check(
    capa_id: UUID,
    check_data: EffectivenessCheckCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager", "quality_inspector")),
    tenant=Depends(get_current_tenant),
):
    """Record effectiveness check result"""
    result = await db.execute(
        select(CorrectiveAction).where(CorrectiveAction.id == capa_id, CorrectiveAction.tenant_id == tenant.id)
    )
    capa = result.scalar_one_or_none()

    if not capa:
        raise NotFoundError("CorrectiveAction", str(capa_id))

    if capa.status != CAPAStatus.EFFECTIVENESS_CHECK:
        raise AppValidationError("CAPA must be in effectiveness check status")

    check = EffectivenessCheck(
        **check_data.model_dump(),
        tenant_id=tenant.id,
        capa_id=capa_id,
        checked_by_id=current_user.id,
    )
    db.add(check)

    # Update CAPA based on result
    if check_data.result:
        capa.status = CAPAStatus.COMPLETED
        capa.effectiveness_result = True
        capa.effectiveness_evidence = check_data.evidence
    else:
        capa.status = CAPAStatus.REJECTED
        capa.effectiveness_result = False
        capa.effectiveness_evidence = check_data.evidence

    await db.flush()
    await db.refresh(check)
    return check