"""Dashboard schemas"""
from datetime import date
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class DashboardMetricsResponse(BaseModel):
    open_ncrs: int = Field(..., description="Number of open NCRs")
    open_capas: int = Field(..., description="Number of open CAPAs")
    inspection_pass_rate: float = Field(..., description="Inspection pass rate percentage")
    overdue_tasks: int = Field(..., description="Number of overdue tasks")
    ncr_trend: List[dict] = Field(default_factory=list, description="NCR trend data")
    ai_insight: Optional[str] = Field(None, description="AI-generated insight")
    recent_ncrs: List[dict] = Field(default_factory=list, description="Recent NCRs")
    recent_recommendations: List[dict] = Field(default_factory=list, description="Recent AI recommendations")
    upcoming_due_dates: List[dict] = Field(default_factory=list, description="Upcoming CAPA and task due dates")
    new_ncrs_30d: int = Field(0, description="NCRs opened in the last 30 days")
    closed_ncrs_30d: int = Field(0, description="NCRs closed in the last 30 days")
    overdue_capas: int = Field(0, description="Open CAPAs past their due date")
    open_tasks: int = Field(0, description="Open tasks in the tenant")
    my_open_tasks: int = Field(0, description="Open tasks assigned to the current user")
    my_tasks: List[dict] = Field(default_factory=list, description="Open tasks assigned to the current user")

    model_config = ConfigDict(from_attributes=True)


class NCRTrendPoint(BaseModel):
    month: str = Field(..., description="Month label (e.g., 'May', 'Jun')")
    count: int = Field(..., description="Number of NCRs")


class CAPADueSoon(BaseModel):
    id: UUID
    title: str
    due_date: date
    owner_name: str
    days_remaining: int