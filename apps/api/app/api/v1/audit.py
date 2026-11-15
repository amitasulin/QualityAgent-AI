"""Audit trail read API. Only managers may inspect the log."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_tenant, require_role
from app.core.database import get_db
from app.models.audit import AuditEvent
from app.models.user import User
from app.schemas.audit import AuditEventResponse
from app.schemas.base import PaginatedResponse

router = APIRouter()


@router.get("", response_model=PaginatedResponse[AuditEventResponse])
async def list_audit_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    entity_type: Optional[str] = Query(None, max_length=100),
    action: Optional[str] = Query(None, max_length=100),
    actor_id: Optional[UUID] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """List audit events for the current organization, newest first."""
    filters = [AuditEvent.tenant_id == tenant.id]
    if entity_type:
        filters.append(func.lower(AuditEvent.entity_type) == entity_type.lower())
    if action:
        filters.append(func.lower(AuditEvent.action) == action.lower())
    if actor_id:
        filters.append(AuditEvent.actor_id == actor_id)
    if date_from:
        filters.append(AuditEvent.created_at >= date_from)
    if date_to:
        filters.append(AuditEvent.created_at <= date_to)

    total = (
        await db.scalar(select(func.count()).select_from(AuditEvent).where(*filters))
    ) or 0

    result = await db.execute(
        select(AuditEvent, User.full_name)
        .outerjoin(User, User.id == AuditEvent.actor_id)
        .where(*filters)
        .order_by(AuditEvent.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    items = []
    for event, actor_name in result.all():
        item = AuditEventResponse.model_validate(event)
        item.actor_name = actor_name
        items.append(item)

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )
