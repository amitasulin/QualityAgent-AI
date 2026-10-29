"""Corrective Action (CAPA) and Effectiveness Check schemas"""
from datetime import datetime, date
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict

from app.schemas.base import TimestampSchema, PaginatedResponse
from app.models.corrective_action import CAPAStatus


class CorrectiveActionBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="CAPA title")
    description: str = Field(..., min_length=1, description="CAPA description")
    action_type: str = Field(..., max_length=50, description="Action type: correction, corrective_action, preventive_action")
    owner_id: Optional[UUID] = Field(None, description="Responsible user ID")
    due_date: date = Field(..., description="Due date")
    effectiveness_check_date: Optional[date] = Field(None, description="Planned effectiveness check date")


class CorrectiveActionCreate(CorrectiveActionBase):
    ncr_id: UUID = Field(..., description="Related NCR ID")


class CorrectiveActionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    action_type: Optional[str] = Field(None, max_length=50)
    owner_id: Optional[UUID] = None
    due_date: Optional[date] = None
    effectiveness_check_date: Optional[date] = None
    verification_notes: Optional[str] = None
    effectiveness_result: Optional[bool] = None
    effectiveness_evidence: Optional[str] = None


class CorrectiveActionResponse(CorrectiveActionBase, TimestampSchema):
    id: UUID
    tenant_id: UUID
    ncr_id: UUID
    status: CAPAStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    verified_by_id: Optional[UUID] = None
    verified_at: Optional[datetime] = None
    verification_notes: Optional[str] = None
    effectiveness_check_date: Optional[date] = None
    effectiveness_result: Optional[bool] = None
    effectiveness_evidence: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CorrectiveActionListResponse(PaginatedResponse[CorrectiveActionResponse]):
    pass


# Effectiveness Check schemas
class EffectivenessCheckBase(BaseModel):
    check_date: date = Field(..., description="Check date")
    result: bool = Field(..., description="Effectiveness check result")
    evidence: Optional[str] = Field(None, description="Evidence for the check")
    notes: Optional[str] = Field(None, description="Additional notes")


class EffectivenessCheckCreate(EffectivenessCheckBase):
    capa_id: UUID = Field(..., description="Related CAPA ID")


class EffectivenessCheckResponse(EffectivenessCheckBase, TimestampSchema):
    id: UUID
    tenant_id: UUID
    capa_id: UUID
    checked_by_id: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)