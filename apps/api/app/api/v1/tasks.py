"""Task routes"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.sorting import apply_sorting
from app.api.dependencies import get_current_user, get_current_tenant, require_role
from app.models.task import Task, TaskStatus, TaskPriority
from app.models.user import User
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse, TaskListResponse
from app.schemas.base import PaginationParams
from app.core.exceptions import NotFoundError, ValidationError as AppValidationError

router = APIRouter()

TASK_SORT_COLUMNS = {
    "title": Task.title,
    "status": Task.status,
    "priority": Task.priority,
    "due_date": Task.due_date,
    "created_at": Task.created_at,
    "updated_at": Task.updated_at,
    "completed_at": Task.completed_at,
}


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_data: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Create a new task"""
    # Verify assignee belongs to tenant if provided
    if task_data.assignee_id:
        user_result = await db.execute(
            select(User).where(User.id == task_data.assignee_id, User.tenant_id == tenant.id)
        )
        if not user_result.scalar_one_or_none():
            raise NotFoundError("User", str(task_data.assignee_id))

    task = Task(
        **task_data.model_dump(),
        tenant_id=tenant.id,
        reporter_id=current_user.id,
        status=TaskStatus.TODO,
    )
    db.add(task)
    await db.flush()
    await db.refresh(task)
    return task


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    pagination: PaginationParams = Depends(),
    status_filter: Optional[TaskStatus] = Query(None, alias="status"),
    priority: Optional[TaskPriority] = Query(None),
    assignee_id: Optional[UUID] = Query(None),
    task_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search in title and description"),
    my_tasks: bool = Query(False, description="Filter to current user's tasks"),
    overdue: bool = Query(False, description="Filter overdue tasks"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """List tasks for current tenant"""
    query = select(Task).where(Task.tenant_id == tenant.id)

    if my_tasks:
        query = query.where(
            or_(Task.assignee_id == current_user.id, Task.reporter_id == current_user.id)
        )
    elif assignee_id:
        query = query.where(Task.assignee_id == assignee_id)

    if status_filter:
        query = query.where(Task.status == status_filter)
    if priority:
        query = query.where(Task.priority == priority)
    if task_type:
        query = query.where(Task.task_type == task_type)
    if search:
        query = query.where(
            or_(Task.title.ilike(f"%{search}%"), Task.description.ilike(f"%{search}%"))
        )
    if overdue:
        query = query.where(
            Task.due_date < datetime.now(timezone.utc),
            Task.status.not_in([TaskStatus.DONE, TaskStatus.CANCELLED]),
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    query = apply_sorting(
        query,
        TASK_SORT_COLUMNS,
        pagination.sort_by,
        pagination.sort_order,
        default_order=(Task.due_date.asc().nullslast(), Task.created_at.desc()),
    )
    query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)

    result = await db.execute(query)
    tasks = result.scalars().all()

    return TaskListResponse.create(
        items=[TaskResponse.model_validate(t) for t in tasks],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/stats")
async def task_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Aggregate task counts for the current tenant in a single query."""
    now = datetime.now(timezone.utc)
    counts = (
        await db.execute(
            select(
                func.count(Task.id).label("total"),
                func.count(Task.id).filter(Task.status == TaskStatus.TODO).label("todo"),
                func.count(Task.id)
                .filter(Task.status == TaskStatus.IN_PROGRESS)
                .label("in_progress"),
                func.count(Task.id).filter(Task.status == TaskStatus.REVIEW).label("review"),
                func.count(Task.id).filter(Task.status == TaskStatus.DONE).label("done"),
                func.count(Task.id)
                .filter(
                    Task.due_date.isnot(None),
                    Task.due_date < now,
                    Task.status.not_in([TaskStatus.DONE, TaskStatus.CANCELLED]),
                )
                .label("overdue"),
                func.count(Task.id)
                .filter(
                    Task.assignee_id == current_user.id,
                    Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW]),
                )
                .label("my_open"),
            ).where(Task.tenant_id == tenant.id)
        )
    ).one()

    return {
        "total": counts.total or 0,
        "todo": counts.todo or 0,
        "in_progress": counts.in_progress or 0,
        "review": counts.review or 0,
        "done": counts.done or 0,
        "overdue": counts.overdue or 0,
        "my_open": counts.my_open or 0,
    }


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Get task by ID"""
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.tenant_id == tenant.id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise NotFoundError("Task", str(task_id))

    return task


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    task_data: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Update task"""
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.tenant_id == tenant.id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise NotFoundError("Task", str(task_id))

    # Permission check: assignee, reporter, or quality manager/admin can update
    can_update = (
        current_user.role.value in ["admin", "quality_manager"]
        or task.assignee_id == current_user.id
        or task.reporter_id == current_user.id
    )

    if not can_update:
        from app.core.exceptions import AuthorizationError
        raise AuthorizationError("Not authorized to update this task")

    # Non-managers can only update status and progress
    if current_user.role.value not in ["admin", "quality_manager"]:
        allowed_fields = {"status"}
        update_data = task_data.model_dump(exclude_unset=True)
        for field in list(update_data.keys()):
            if field not in allowed_fields:
                del update_data[field]
    else:
        update_data = task_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(task, field, value)

    # Auto-set completed_at when status changes to DONE
    if task_data.status == TaskStatus.DONE and task.completed_at is None:
        task.completed_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(task)
    return task


@router.post("/{task_id}/complete", response_model=TaskResponse)
async def complete_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Mark task as complete"""
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.tenant_id == tenant.id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise NotFoundError("Task", str(task_id))

    if task.assignee_id != current_user.id and current_user.role.value not in ["admin", "quality_manager"]:
        from app.core.exceptions import AuthorizationError
        raise AuthorizationError("Only assignee or managers can complete task")

    task.status = TaskStatus.DONE
    task.completed_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(task)
    return task