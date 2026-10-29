"""Dashboard routes"""
from typing import List
from uuid import UUID
from datetime import datetime, timezone, timedelta, date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import get_current_user, get_current_tenant
from app.models.nonconformity import Nonconformity, NCRStatus
from app.models.corrective_action import CorrectiveAction, CAPAStatus
from app.models.task import Task, TaskStatus
from app.models.agent import AgentRecommendation, AgentRecommendationStatus
from app.models.inspection import Inspection, InspectionResult, InspectionResultValue
from app.models.user import User
from app.schemas.dashboard import DashboardMetricsResponse

router = APIRouter()


@router.get("/metrics", response_model=DashboardMetricsResponse)
async def get_dashboard_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Get dashboard metrics for current tenant"""
    # Open NCRs
    open_ncrs_result = await db.execute(
        select(func.count(Nonconformity.id)).where(
            Nonconformity.tenant_id == tenant.id,
            Nonconformity.status.in_([NCRStatus.OPEN, NCRStatus.CONTAINED, NCRStatus.INVESTIGATING, NCRStatus.ACTION_PENDING, NCRStatus.EFFECTIVENESS_REVIEW]),
        )
    )
    open_ncrs = open_ncrs_result.scalar() or 0

    # Open CAPAs
    open_capas_result = await db.execute(
        select(func.count(CorrectiveAction.id)).where(
            CorrectiveAction.tenant_id == tenant.id,
            CorrectiveAction.status.in_([CAPAStatus.DRAFT, CAPAStatus.ASSIGNED, CAPAStatus.IN_PROGRESS, CAPAStatus.PENDING_REVIEW, CAPAStatus.EFFECTIVENESS_CHECK]),
        )
    )
    open_capas = open_capas_result.scalar() or 0

    # Overdue tasks
    overdue_tasks_result = await db.execute(
        select(func.count(Task.id)).where(
            Task.tenant_id == tenant.id,
            Task.due_date < datetime.now(timezone.utc),
            Task.status.not_in([TaskStatus.DONE, TaskStatus.CANCELLED]),
        )
    )
    overdue_tasks = overdue_tasks_result.scalar() or 0

    # Inspection pass rate computed from recorded inspection results
    results_total = await db.scalar(
        select(func.count(InspectionResult.id))
        .join(Inspection, Inspection.id == InspectionResult.inspection_id)
        .where(Inspection.tenant_id == tenant.id)
    ) or 0
    results_failed = await db.scalar(
        select(func.count(InspectionResult.id))
        .join(Inspection, Inspection.id == InspectionResult.inspection_id)
        .where(
            Inspection.tenant_id == tenant.id,
            InspectionResult.result == InspectionResultValue.FAIL,
        )
    ) or 0
    inspection_pass_rate = (
        round((results_total - results_failed) / results_total * 100, 1) if results_total else 0.0
    )

    # NCR Trend (last 6 months)
    six_months_ago = datetime.now(timezone.utc) - timedelta(days=180)
    trend_result = await db.execute(
        select(
            func.date_trunc('month', Nonconformity.detected_at).label('month'),
            func.count(Nonconformity.id).label('count')
        )
        .where(
            Nonconformity.tenant_id == tenant.id,
            Nonconformity.detected_at >= six_months_ago,
        )
        .group_by('month')
        .order_by('month')
    )
    trend_rows = trend_result.all()

    # Ensure we have 6 months (fill missing with 0)
    months_hebrew = ["×™× ×•", "×¤×‘×¨", "×ž×¨×¥", "××¤×¨", "×ž××™", "×™×•× ", "×™×•×œ", "××•×’", "×¡×¤×˜", "××•×§", "× ×•×‘", "×“×¦×ž"]
    trend_counts = {row.month.month: row.count for row in trend_rows}
    current_month = datetime.now(timezone.utc).month
    trend_data = []
    for i in range(5, -1, -1):
        month_number = ((current_month - i - 1) % 12) + 1
        month_name = months_hebrew[month_number - 1]
        trend_data.append({"month": month_name, "count": trend_counts.get(month_number, 0)})

    # AI Insight (generate based on data)
    ai_insight = generate_ai_insight(open_ncrs, open_capas, overdue_tasks, recent_ncrs_count=open_ncrs)

    # Recent NCRs
    recent_ncrs_result = await db.execute(
        select(Nonconformity)
        .where(Nonconformity.tenant_id == tenant.id)
        .order_by(Nonconformity.detected_at.desc())
        .limit(5)
    )
    recent_ncrs = recent_ncrs_result.scalars().all()
    recent_ncrs_data = [
        {
            "id": str(n.id),
            "number": n.number,
            "title": n.title,
            "status": n.status.value,
            "severity": n.severity.value,
            "detected_at": n.detected_at.isoformat(),
        }
        for n in recent_ncrs
    ]

    # Recent recommendations
    recent_recs_result = await db.execute(
        select(AgentRecommendation)
        .where(
            AgentRecommendation.tenant_id == tenant.id,
            AgentRecommendation.status == AgentRecommendationStatus.PENDING,
        )
        .order_by(AgentRecommendation.created_at.desc())
        .limit(5)
    )
    recent_recs = recent_recs_result.scalars().all()
    recent_recs_data = [
        {
            "id": str(r.id),
            "type": r.type.value,
            "title": r.title,
            "severity": r.severity,
            "created_at": r.created_at.isoformat(),
        }
        for r in recent_recs
    ]

    # Upcoming due dates
    upcoming_due_result = await db.execute(
        select(CorrectiveAction)
        .where(
            CorrectiveAction.tenant_id == tenant.id,
            CorrectiveAction.due_date >= date.today(),
            CorrectiveAction.due_date <= date.today() + timedelta(days=14),
            CorrectiveAction.status.not_in([CAPAStatus.COMPLETED, CAPAStatus.REJECTED]),
        )
        .order_by(CorrectiveAction.due_date.asc())
        .limit(5)
    )
    upcoming_due = upcoming_due_result.scalars().all()
    upcoming_due_data = [
        {
            "id": str(c.id),
            "title": c.title,
            "due_date": c.due_date.isoformat(),
            "days_remaining": (c.due_date - date.today()).days,
        }
        for c in upcoming_due
    ]

    return DashboardMetricsResponse(
        open_ncrs=open_ncrs,
        open_capas=open_capas,
        inspection_pass_rate=inspection_pass_rate,
        overdue_tasks=overdue_tasks,
        ncr_trend=trend_data,
        ai_insight=ai_insight,
        recent_ncrs=recent_ncrs_data,
        recent_recommendations=recent_recs_data,
        upcoming_due_dates=upcoming_due_data,
    )


def generate_ai_insight(open_ncrs: int, open_capas: int, overdue_tasks: int, recent_ncrs_count: int) -> str:
    """Generate AI insight based on current metrics"""
    insights = []

    if open_ncrs > 10:
        insights.append(f"×™×© {open_ncrs} ×—×¨×™×’×•×ª ×¤×ª×•×—×•×ª - ×ž×•×ž×œ×¥ ×œ×ª×¢×“×£ ×˜×™×¤×•×œ ×‘×—×¨×™×’×•×ª ×—×ž×•×¨×•×ª.")

    if open_capas > 5:
        insights.append(f"{open_capas} ×¤×¢×•×œ×•×ª ×ž×ª×§× ×•×ª ×¤×ª×•×—×•×ª - ×‘×“×•×§ ×”×ª×§×“×ž×•×ª ×•××¤×§×˜×™×‘×™×•×ª.")

    if overdue_tasks > 0:
        insights.append(f"{overdue_tasks} ×ž×©×™×ž×•×ª ×‘××™×—×•×¨ - × ×“×¨×©×ª ×”×ª×¢×¨×‘×•×ª × ×™×”×•×œ×™×ª.")

    # Check for repeated defects (would need more complex query in production)
    if recent_ncrs_count >= 3:
        insights.append("×–×•×”×• ×ž×¡×¤×¨ ×—×¨×™×’×•×ª ×‘×™×ž×™× ×”××—×¨×•× ×™× - ×”×¡×•×›×Ÿ ×‘×•×“×§ ×ª×‘× ×™×•×ª ×—×•×–×¨×•×ª.")

    if not insights:
        insights.append("×ž×“×“×™ ×”××™×›×•×ª ×‘×˜×•×•×— ×”×ª×§×™×Ÿ. ×”×ž×©×š ×ž×¢×§×‘ ×©×•×˜×£.")

    return " ".join(insights)