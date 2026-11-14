"""Global search across every module of the current tenant.

The endpoint returns grouped, ready-to-render results so the header search box
can show them without extra requests per module.
"""
from typing import Any, Callable, Optional, Sequence

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_tenant, get_current_user
from app.core.database import get_db
from app.models.complaint import Complaint
from app.models.corrective_action import CorrectiveAction
from app.models.customer import Customer
from app.models.document import Document
from app.models.inspection import Inspection
from app.models.nonconformity import Nonconformity
from app.models.product import Product
from app.models.site import Site
from app.models.supplier import Supplier
from app.models.task import Task
from app.models.user import User
from app.schemas.search import SearchGroup, SearchResponse, SearchResultItem

router = APIRouter()

MAX_RESULTS = 20
PER_GROUP = 5


def escape_like(term: str) -> str:
    """Escape LIKE wildcards so typing ``%`` or ``_`` searches for them."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _enum_value(value: Any) -> Optional[str]:
    if value is None:
        return None
    return getattr(value, "value", value)


async def _search_group(
    db: AsyncSession,
    tenant_id,
    pattern: str,
    *,
    key: str,
    label: str,
    model,
    columns: Sequence,
    href: Callable[[Any], str],
    title: Callable[[Any], str],
    subtitle: Optional[Callable[[Any], Optional[str]]] = None,
    status: Optional[str] = None,
    limit: int = PER_GROUP,
) -> SearchGroup:
    stmt = (
        select(model)
        .where(model.tenant_id == tenant_id)
        .where(or_(*[column.ilike(pattern, escape="\\") for column in columns]))
        .order_by(model.updated_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    items = [
        SearchResultItem(
            id=str(row.id),
            title=title(row),
            subtitle=subtitle(row) if subtitle else None,
            status=_enum_value(getattr(row, status)) if status else None,
            href=href(row),
        )
        for row in rows
    ]
    return SearchGroup(type=key, label=label, items=items)


@router.get("", response_model=SearchResponse)
async def global_search(
    q: str = Query(..., min_length=1, max_length=100, description="Free text query"),
    limit: int = Query(MAX_RESULTS, ge=1, le=MAX_RESULTS, description="Maximum results per module"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Search NCRs, CAPAs, documents, tasks, complaints and master data."""
    term = q.strip()
    if not term:
        return SearchResponse(query=q, total=0, groups=[])

    pattern = f"%{escape_like(term)}%"
    per_group = min(limit, PER_GROUP)

    groups = [
        await _search_group(
            db,
            tenant.id,
            pattern,
            key="nonconformity",
            label="אי התאמות",
            model=Nonconformity,
            columns=(Nonconformity.number, Nonconformity.title, Nonconformity.description),
            title=lambda row: row.title,
            subtitle=lambda row: row.number,
            status="status",
            href=lambda row: f"/nonconformities/{row.id}",
            limit=per_group,
        ),
        await _search_group(
            db,
            tenant.id,
            pattern,
            key="corrective_action",
            label="פעולות מתקנות",
            model=CorrectiveAction,
            columns=(CorrectiveAction.title, CorrectiveAction.description),
            title=lambda row: row.title,
            status="status",
            href=lambda row: f"/corrective-actions/{row.id}",
            limit=per_group,
        ),
        await _search_group(
            db,
            tenant.id,
            pattern,
            key="document",
            label="מסמכים",
            model=Document,
            columns=(Document.code, Document.title, Document.description),
            title=lambda row: row.title,
            subtitle=lambda row: row.code,
            status="status",
            href=lambda row: f"/documents/{row.id}",
            limit=per_group,
        ),
        await _search_group(
            db,
            tenant.id,
            pattern,
            key="task",
            label="משימות",
            model=Task,
            columns=(Task.title, Task.description),
            title=lambda row: row.title,
            status="status",
            href=lambda row: f"/tasks/{row.id}",
            limit=per_group,
        ),
        await _search_group(
            db,
            tenant.id,
            pattern,
            key="complaint",
            label="תלונות לקוח",
            model=Complaint,
            columns=(Complaint.number, Complaint.title, Complaint.description),
            title=lambda row: row.title,
            subtitle=lambda row: row.number,
            status="status",
            href=lambda row: f"/complaints/{row.id}",
            limit=per_group,
        ),
        await _search_group(
            db,
            tenant.id,
            pattern,
            key="inspection",
            label="בדיקות איכות",
            model=Inspection,
            columns=(Inspection.number, Inspection.lot_number),
            title=lambda row: row.number,
            subtitle=lambda row: row.lot_number,
            status="status",
            href=lambda row: f"/inspections/{row.id}",
            limit=per_group,
        ),
        await _search_group(
            db,
            tenant.id,
            pattern,
            key="product",
            label="מוצרים",
            model=Product,
            columns=(Product.name, Product.description),
            title=lambda row: row.name,
            href=lambda row: f"/products/{row.id}",
            limit=per_group,
        ),
        await _search_group(
            db,
            tenant.id,
            pattern,
            key="customer",
            label="לקוחות",
            model=Customer,
            columns=(Customer.code, Customer.name),
            title=lambda row: row.name,
            subtitle=lambda row: row.code,
            href=lambda row: f"/customers/{row.id}",
            limit=per_group,
        ),
        await _search_group(
            db,
            tenant.id,
            pattern,
            key="supplier",
            label="ספקים",
            model=Supplier,
            columns=(Supplier.code, Supplier.name),
            title=lambda row: row.name,
            subtitle=lambda row: row.code,
            href=lambda row: f"/suppliers/{row.id}",
            limit=per_group,
        ),
        await _search_group(
            db,
            tenant.id,
            pattern,
            key="site",
            label="אתרים",
            model=Site,
            columns=(Site.name, Site.code),
            title=lambda row: row.name,
            subtitle=lambda row: row.code,
            href=lambda row: "/sites",
            limit=per_group,
        ),
    ]

    groups = [group for group in groups if group.items]
    total = sum(len(group.items) for group in groups)
    return SearchResponse(query=term, total=total, groups=groups)
