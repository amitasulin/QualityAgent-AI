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
    months: int = Query(6, ge=3, le=12, description="Number of months in the NCR trend"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Get dashboard metrics for current tenant"""
    now = datetime.now(timezone.utc)
    today = date.today()
    thirty_days_ago = now - timedelta(days=30)

    open_ncr_statuses = [
        NCRStatus.OPEN,
        NCRStatus.CONTAINED,
        NCRStatus.INVESTIGATING,
        NCRStatus.ACTION_PENDING,
        NCRStatus.EFFECTIVENESS_REVIEW,
    ]
    open_capa_statuses = [
        CAPAStatus.DRAFT,
        CAPAStatus.ASSIGNED,
        CAPAStatus.IN_PROGRESS,
        CAPAStatus.PENDING_REVIEW,
        CAPAStatus.EFFECTIVENESS_CHECK,
    ]
    open_task_statuses = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW]

    # One aggregate query per table instead of one query per metric.
    ncr_counts = (
        await db.execute(
            select(
                func.count(Nonconformity.id)
                .filter(Nonconformity.status.in_(open_ncr_statuses))
                .label("open"),
                func.count(Nonconformity.id)
                .filter(Nonconformity.detected_at >= thirty_days_ago)
                .label("new_30d"),
                func.count(Nonconformity.id)
                .filter(
                    Nonconformity.closed_at.isnot(None),
                    Nonconformity.closed_at >= thirty_days_ago,
                )
                .label("closed_30d"),
            ).where(Nonconformity.tenant_id == tenant.id)
        )
    ).one()
    open_ncrs = ncr_counts.open or 0
    new_ncrs_30d = ncr_counts.new_30d or 0
    closed_ncrs_30d = ncr_counts.closed_30d or 0

    capa_counts = (
        await db.execute(
            select(
                func.count(CorrectiveAction.id)
                .filter(CorrectiveAction.status.in_(open_capa_statuses))
                .label("open"),
                func.count(CorrectiveAction.id)
                .filter(
                    CorrectiveAction.due_date < today,
                    CorrectiveAction.status.not_in(
                        [CAPAStatus.COMPLETED, CAPAStatus.REJECTED]
                    ),
                )
                .label("overdue"),
            ).where(CorrectiveAction.tenant_id == tenant.id)
        )
    ).one()
    open_capas = capa_counts.open or 0
    overdue_capas = capa_counts.overdue or 0

    task_counts = (
        await db.execute(
            select(
                func.count(Task.id)
                .filter(Task.status.in_(open_task_statuses))
                .label("open"),
                func.count(Task.id)
                .filter(
                    Task.assignee_id == current_user.id,
                    Task.status.in_(open_task_statuses),
                )
                .label("my_open"),
                func.count(Task.id)
                .filter(
                    Task.due_date < now,
                    Task.status.not_in([TaskStatus.DONE, TaskStatus.CANCELLED]),
                )
                .label("overdue"),
            ).where(Task.tenant_id == tenant.id)
        )
    ).one()
    open_tasks = task_counts.open or 0
    my_open_tasks = task_counts.my_open or 0
    overdue_tasks = task_counts.overdue or 0

    # Inspection pass rate computed from recorded inspection results
    inspection_counts = (
        await db.execute(
            select(
                func.count(InspectionResult.id).label("total"),
                func.count(InspectionResult.id)
                .filter(InspectionResult.result == InspectionResultValue.FAIL)
                .label("failed"),
            )
            .join(Inspection, Inspection.id == InspectionResult.inspection_id)
            .where(Inspection.tenant_id == tenant.id)
        )
    ).one()
    results_total = inspection_counts.total or 0
    results_failed = inspection_counts.failed or 0
    inspection_pass_rate = (
        round((results_total - results_failed) / results_total * 100, 1) if results_total else 0.0
    )

    # NCR Trend (last N months, including the current one)
    months_hebrew = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"]
    month_keys: list[tuple[int, int]] = []
    cursor_year, cursor_month = now.year, now.month
    for _ in range(months):
        month_keys.append((cursor_year, cursor_month))
        cursor_month -= 1
        if cursor_month == 0:
            cursor_month = 12
            cursor_year -= 1
    month_keys.reverse()

    start_year, start_month = month_keys[0]
    trend_start = datetime(start_year, start_month, 1, tzinfo=timezone.utc)
    trend_result = await db.execute(
        select(
            func.date_trunc('month', Nonconformity.detected_at).label('month'),
            func.count(Nonconformity.id).label('count')
        )
        .where(
            Nonconformity.tenant_id == tenant.id,
            Nonconformity.detected_at >= trend_start,
        )
        .group_by('month')
        .order_by('month')
    )
    trend_rows = trend_result.all()
    trend_counts = {(row.month.year, row.month.month): row.count for row in trend_rows}
    trend_data = [
        {
            "month": months_hebrew[month_number - 1],
            "year": year,
            "count": trend_counts.get((year, month_number), 0),
        }
        for year, month_number in month_keys
    ]

    # AI Insight (generate based on data)
    ai_insight = generate_ai_insight(
        open_ncrs,
        open_capas,
        overdue_tasks,
        recent_ncrs_count=new_ncrs_30d,
        new_ncrs_30d=new_ncrs_30d,
        closed_ncrs_30d=closed_ncrs_30d,
        overdue_capas=overdue_capas,
        my_open_tasks=my_open_tasks,
    )

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

    # My open tasks (personal work queue)
    my_tasks_result = await db.execute(
        select(Task)
        .where(
            Task.tenant_id == tenant.id,
            Task.assignee_id == current_user.id,
            Task.status.in_(open_task_statuses),
        )
        .order_by(Task.due_date.asc().nullslast())
        .limit(5)
    )
    my_tasks = my_tasks_result.scalars().all()
    my_tasks_data = [
        {
            "id": str(t.id),
            "title": t.title,
            "status": t.status.value,
            "priority": t.priority.value,
            "due_date": t.due_date.isoformat() if t.due_date else None,
        }
        for t in my_tasks
    ]

    # Upcoming and overdue due dates, combining CAPAs and tasks
    upcoming_limit = today + timedelta(days=14)
    capa_due_result = await db.execute(
        select(CorrectiveAction)
        .where(
            CorrectiveAction.tenant_id == tenant.id,
            CorrectiveAction.due_date <= upcoming_limit,
            CorrectiveAction.status.not_in([CAPAStatus.COMPLETED, CAPAStatus.REJECTED]),
        )
        .order_by(CorrectiveAction.due_date.asc())
        .limit(8)
    )
    task_due_result = await db.execute(
        select(Task)
        .where(
            Task.tenant_id == tenant.id,
            Task.due_date.isnot(None),
            Task.due_date <= datetime.combine(upcoming_limit, datetime.max.time(), tzinfo=timezone.utc),
            Task.status.not_in([TaskStatus.DONE, TaskStatus.CANCELLED]),
        )
        .order_by(Task.due_date.asc())
        .limit(8)
    )

    combined_due: list[dict] = []
    for c in capa_due_result.scalars().all():
        combined_due.append(
            {
                "id": str(c.id),
                "kind": "capa",
                "title": c.title,
                "due_date": c.due_date.isoformat(),
                "days_remaining": (c.due_date - today).days,
            }
        )
    for t in task_due_result.scalars().all():
        due = t.due_date.date() if t.due_date else None
        if due is None:
            continue
        combined_due.append(
            {
                "id": str(t.id),
                "kind": "task",
                "title": t.title,
                "due_date": due.isoformat(),
                "days_remaining": (due - today).days,
            }
        )
    combined_due.sort(key=lambda item: item["due_date"])
    upcoming_due_data = combined_due[:6]

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
        new_ncrs_30d=new_ncrs_30d,
        closed_ncrs_30d=closed_ncrs_30d,
        overdue_capas=overdue_capas,
        open_tasks=open_tasks,
        my_open_tasks=my_open_tasks,
        my_tasks=my_tasks_data,
    )


def generate_ai_insight(
    open_ncrs: int,
    open_capas: int,
    overdue_tasks: int,
    recent_ncrs_count: int,
    new_ncrs_30d: int = 0,
    closed_ncrs_30d: int = 0,
    overdue_capas: int = 0,
    my_open_tasks: int = 0,
) -> str:
    """Generate AI insight based on current metrics"""
    insights = []

    if open_ncrs > 10:
        insights.append(f"יש {open_ncrs} חריגות פתוחות - מומלץ לתעדף טיפול בחריגות חמורות.")

    if open_capas > 5:
        insights.append(f"{open_capas} פעולות מתקנות פתוחות - בדוק התקדמות ואפקטיביות.")

    if overdue_capas > 0:
        insights.append(f"{overdue_capas} פעולות מתקנות באיחור - יש לעדכן מועדי יעד או לסגור אותן.")

    if overdue_tasks > 0:
        insights.append(f"{overdue_tasks} משימות באיחור - נדרשת התערבות ניהולית.")

    if new_ncrs_30d > closed_ncrs_30d:
        insights.append(
            f"ב-30 הימים האחרונים נפתחו {new_ncrs_30d} חריגות ונסגרו {closed_ncrs_30d} - קצב הפתיחה גבוה מקצב הסגירה."
        )

    # Check for repeated defects (would need more complex query in production)
    if recent_ncrs_count >= 3:
        insights.append("זוהו מספר חריגות בימים האחרונים - הסוכן בודק תבניות חוזרות.")

    if my_open_tasks > 0:
        insights.append(f"מוקצות לך {my_open_tasks} משימות פתוחות.")

    if not insights:
        insights.append("מדדי האיכות בטווח התקין. המשך מעקב שוטף.")

    return " ".join(insights)