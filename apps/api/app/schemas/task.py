"""Task schemas"""
from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict

from app.schemas.base import TimestampSchema, PaginatedResponse
from app.models.task import TaskStatus, TaskPriority


class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Task title")
    description: Optional[str] = Field(None, description="Task description")
    task_type: Optional[str] = Field(None, max_length=50, description="Task type")
    priority: TaskPriority = Field(TaskPriority.MEDIUM, description="Task priority")
    assignee_id: Optional[UUID] = Field(None, description="Assignee user ID")
    related_entity_type: Optional[str] = Field(None, max_length=100, description="Related entity type")
    related_entity_id: Optional[UUID] = Field(None, description="Related entity ID")
    due_date: Optional[datetime] = Field(None, description="Due date")


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    task_type: Optional[str] = Field(None, max_length=50)
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assignee_id: Optional[UUID] = None
    related_entity_type: Optional[str] = Field(None, max_length=100)
    related_entity_id: Optional[UUID] = None
    due_date: Optional[datetime] = None


class TaskResponse(TaskBase, TimestampSchema):
    id: UUID
    tenant_id: UUID
    status: TaskStatus
    reporter_id: Optional[UUID] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TaskListResponse(PaginatedResponse[TaskResponse]):
    pass