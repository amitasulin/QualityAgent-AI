"""AI Agent routes"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.dependencies import get_current_user, get_current_tenant, require_role
from app.models.agent import AgentRun, AgentRecommendation, AgentRunStatus, AgentRecommendationType, AgentRecommendationStatus
from app.models.nonconformity import Nonconformity, NCRStatus
from app.models.corrective_action import CorrectiveAction, CAPAStatus
from app.models.user import User
from app.schemas.agent import (
    AgentRunCreate,
    AgentRunResponse,
    AgentRecommendationResponse,
    AgentRecommendationAction,
    AgentChatRequest,
    AgentChatResponse,
)
from app.core.exceptions import NotFoundError
from app.schemas.base import PaginationParams

router = APIRouter()


@router.post("/runs", response_model=AgentRunResponse, status_code=status.HTTP_201_CREATED)
async def create_agent_run(
    run_data: AgentRunCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """Trigger a new agent run"""
    run = AgentRun(
        **run_data.model_dump(),
        tenant_id=tenant.id,
        status=AgentRunStatus.PENDING,
    )
    db.add(run)
    await db.flush()
    await db.refresh(run)

    # In production, this would trigger a background task
    # For demo, we'll run a simple check synchronously
    await run_proactive_checks(run, db, tenant.id)

    return run


@router.get("/runs", response_model=List[AgentRunResponse])
async def list_agent_runs(
    pagination: PaginationParams = Depends(),
    status_filter: Optional[AgentRunStatus] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """List agent runs for current tenant"""
    query = select(AgentRun).where(AgentRun.tenant_id == tenant.id)

    if status_filter:
        query = query.where(AgentRun.status == status_filter)

    query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)
    query = query.order_by(AgentRun.created_at.desc())

    result = await db.execute(query)
    runs = result.scalars().all()

    return [AgentRunResponse.model_validate(r) for r in runs]


@router.get("/runs/{run_id}", response_model=AgentRunResponse)
async def get_agent_run(
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Get agent run by ID"""
    result = await db.execute(
        select(AgentRun)
        .options(selectinload(AgentRun.recommendations))
        .where(AgentRun.id == run_id, AgentRun.tenant_id == tenant.id)
    )
    run = result.scalar_one_or_none()

    if not run:
        raise NotFoundError("AgentRun", str(run_id))

    return run


@router.get("/recommendations", response_model=List[AgentRecommendationResponse])
async def list_recommendations(
    status_filter: Optional[AgentRecommendationStatus] = Query(None, alias="status"),
    type_filter: Optional[AgentRecommendationType] = Query(None, alias="type"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """List agent recommendations for current tenant"""
    query = select(AgentRecommendation).where(AgentRecommendation.tenant_id == tenant.id)

    if status_filter:
        query = query.where(AgentRecommendation.status == status_filter)
    if type_filter:
        query = query.where(AgentRecommendation.type == type_filter)

    query = query.order_by(AgentRecommendation.created_at.desc())

    result = await db.execute(query)
    recommendations = result.scalars().all()

    return [AgentRecommendationResponse.model_validate(r) for r in recommendations]


@router.post("/recommendations/{rec_id}/action", response_model=AgentRecommendationResponse)
async def act_on_recommendation(
    rec_id: UUID,
    action: AgentRecommendationAction,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Act on agent recommendation (approve/reject/implement)"""
    result = await db.execute(
        select(AgentRecommendation).where(
            AgentRecommendation.id == rec_id, AgentRecommendation.tenant_id == tenant.id
        )
    )
    rec = result.scalar_one_or_none()

    if not rec:
        raise NotFoundError("AgentRecommendation", str(rec_id))

    if action.action == "approve":
        rec.status = AgentRecommendationStatus.APPROVED
        rec.approved_by_id = current_user.id
        rec.approved_at = datetime.now(timezone.utc)

        # If recommendation is for START_RCA, create a task
        if rec.recommended_action.get("type") == "START_RCA":
            from app.models.task import Task, TaskStatus, TaskPriority
            task = Task(
                tenant_id=tenant.id,
                title=f"RCA Investigation: {rec.title}",
                description=rec.description or "",
                task_type="ncr_review",
                status=TaskStatus.TODO,
                priority=TaskPriority.HIGH,
                assignee_id=current_user.id,
                reporter_id=current_user.id,
                related_entity_type="agent_recommendation",
                related_entity_id=rec.id,
                due_date=datetime.now(timezone.utc) + timedelta(days=7),
            )
            db.add(task)

    elif action.action == "reject":
        rec.status = AgentRecommendationStatus.REJECTED
        rec.approved_by_id = current_user.id
        rec.approved_at = datetime.now(timezone.utc)

    elif action.action == "implement":
        rec.status = AgentRecommendationStatus.IMPLEMENTED
        rec.implemented_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(rec)
    return rec


@router.post("/chat", response_model=AgentChatResponse)
async def chat_with_agent(
    request: AgentChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Chat with the AI agent"""
    # In production, this would call the AI agent with tools
    # For demo, return a mock response based on keywords
    message = request.message.lower()

    response_text = ""
    recommendations = []

    if (
        "חריגה" in message
        or "חריגות" in message
        or "אי התאמה" in message
        or "אי-התאמה" in message
        or "פגם" in message
        or "ncr" in message
        or "nonconform" in message
    ):
        # Query recent NCRs
        ncr_result = await db.execute(
            select(Nonconformity)
            .where(Nonconformity.tenant_id == tenant.id)
            .order_by(Nonconformity.detected_at.desc())
            .limit(5)
        )
        ncrs = ncr_result.scalars().all()

        if ncrs:
            response_text = f"מצאתי {len(ncrs)} חריגות אחרונות:\n"
            for ncr in ncrs:
                response_text += f"- {ncr.number}: {ncr.title} ({ncr.status.value})\n"
        else:
            response_text = "לא נמצאו חריגות במערכת."

    elif "מתקנ" in message or "capa" in message:
        capa_result = await db.execute(
            select(CorrectiveAction)
            .where(CorrectiveAction.tenant_id == tenant.id)
            .order_by(CorrectiveAction.due_date.asc())
            .limit(5)
        )
        capas = capa_result.scalars().all()

        if capas:
            response_text = f"מצאתי {len(capas)} פעולות מתקנות:\n"
            for capa in capas:
                response_text += f"- {capa.title}: תאריך יעד {capa.due_date} ({capa.status.value})\n"
        else:
            response_text = "לא נמצאו פעולות מתקנות במערכת."

    elif "המלצ" in message or "recommend" in message:
        rec_result = await db.execute(
            select(AgentRecommendation)
            .where(
                AgentRecommendation.tenant_id == tenant.id,
                AgentRecommendation.status == AgentRecommendationStatus.PENDING,
            )
            .order_by(AgentRecommendation.created_at.desc())
            .limit(5)
        )
        recs = rec_result.scalars().all()

        if recs:
            response_text = f"יש {len(recs)} המלצות ממתינות:\n"
            for rec in recs:
                response_text += f"- {rec.title} ({rec.severity})\n"
                recommendations.append(AgentRecommendationResponse.model_validate(rec))
        else:
            response_text = "אין המלצות ממתינות כרגע."

    else:
        response_text = (
            "אני הסוכן הפרואקטיבי של QualityAgent. "
            "אני יכול לעזור לך עם:\n"
            "- חיפוש חריגות (NCR)\n"
            "- מעקב פעולות מתקנות (CAPA)\n"
            "- הצגת המלצות אוטומטיות\n"
            "- ניתוח מגמות איכות\n\n"
            "מה תרצה לדעת?"
        )

    return AgentChatResponse(
        response=response_text,
        sources=[],
        recommendations=recommendations,
    )


async def run_proactive_checks(run: AgentRun, db: AsyncSession, tenant_id: UUID):
    """Run proactive quality checks and generate recommendations"""
    from app.models.agent import AgentRecommendation, AgentRecommendationType, AgentRecommendationStatus
    from app.models.nonconformity import Nonconformity, NCRSeverity
    from app.models.corrective_action import CorrectiveAction, CAPAStatus
    from datetime import date

    run.status = AgentRunStatus.RUNNING
    run.started_at = datetime.now(timezone.utc)

    findings = 0
    recommendations_created = 0

    # Check 1: Repeated defects (same product + defect code in last 7 days)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    ncr_result = await db.execute(
        select(Nonconformity)
        .where(
            Nonconformity.tenant_id == tenant_id,
            Nonconformity.detected_at >= week_ago,
            Nonconformity.defect_code.isnot(None),
            Nonconformity.product_id.isnot(None),
        )
    )
    recent_ncrs = ncr_result.scalars().all()

    # Group by product + defect_code
    from collections import defaultdict
    defect_groups = defaultdict(list)
    for ncr in recent_ncrs:
        key = (ncr.product_id, ncr.defect_code)
        defect_groups[key].append(ncr)

    for (product_id, defect_code), ncrs in defect_groups.items():
        if len(ncrs) >= 3:  # Threshold: 3 or more
            # Check if recommendation already exists
            existing = await db.execute(
                select(AgentRecommendation).where(
                    AgentRecommendation.tenant_id == tenant_id,
                    AgentRecommendation.type == AgentRecommendationType.REPEATED_DEFECT,
                    AgentRecommendation.status == AgentRecommendationStatus.PENDING,
                )
            )
            # Simple check - in production, check more specifically
            rec = AgentRecommendation(
                run_id=run.id,
                tenant_id=tenant_id,
                type=AgentRecommendationType.REPEATED_DEFECT,
                severity="warning",
                title=f"פגם חוזר: {defect_code} במוצר {product_id}",
                description=f"זוהו {len(ncrs)} חריגות של {defect_code} ב-7 ימים אחרונים",
                rationale="אותו קוד פגם חוזר באותו מוצר, מצביע על בעיה שיטתית",
                confidence="high",
                evidence=[{"type": "ncr", "id": str(n.id), "number": n.number} for n in ncrs],
                missing_information=["נתוני כיול תבנית עדכניים", "רשומות משמרת מפעיל"],
                recommended_action={"type": "START_RCA", "reason": "Recurring dimensional deviation", "requires_approval": True},
                status=AgentRecommendationStatus.PENDING,
            )
            db.add(rec)
            recommendations_created += 1
            findings += 1

    # Check 2: Overdue CAPAs
    overdue_capas = await db.execute(
        select(CorrectiveAction).where(
            CorrectiveAction.tenant_id == tenant_id,
            CorrectiveAction.due_date < date.today(),
            CorrectiveAction.status.in_([CAPAStatus.ASSIGNED, CAPAStatus.IN_PROGRESS]),
        )
    )
    overdue = overdue_capas.scalars().all()

    for capa in overdue:
        rec = AgentRecommendation(
            run_id=run.id,
            tenant_id=tenant_id,
            type=AgentRecommendationType.OVERDUE_CAPA,
            severity="info",
            title=f"פעולה מתקנת באיחור: {capa.title}",
            description=f"CAPA עבור NCR {capa.ncr_id} אמורה להסתיים ב-{capa.due_date}, טרם הושלמה",
            rationale="מועד היעד עבר והפעולה לא הסתיימה",
            confidence="medium",
            evidence=[{"type": "capa", "id": str(capa.id)}],
            missing_information=[],
            recommended_action={"type": "REMIND_OWNER", "reason": "Due date passed", "requires_approval": False},
            status=AgentRecommendationStatus.PENDING,
        )
        db.add(rec)
        recommendations_created += 1
        findings += 1

    run.status = AgentRunStatus.COMPLETED
    run.completed_at = datetime.now(timezone.utc)
    run.result_summary = {
        "findings": findings,
        "recommendations_created": recommendations_created,
        "checks_performed": ["repeated_defects", "overdue_capas"],
    }

    await db.flush()