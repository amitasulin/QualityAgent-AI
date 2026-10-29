"""Customer complaint schemas"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.complaint import ComplaintSeverity, ComplaintStatus
from app.schemas.base import PaginatedResponse, TimestampSchema


class CustomerRef(BaseModel):
    id: UUID
    code: str
    name: str

    model_config = ConfigDict(from_attributes=True)


class ProductRef(BaseModel):
    id: UUID
    sku: str
    name: str

    model_config = ConfigDict(from_attributes=True)


class UserRef(BaseModel):
    id: UUID
    full_name: str

    model_config = ConfigDict(from_attributes=True)


class NcrRef(BaseModel):
    id: UUID
    number: str
    title: str
    status: str

    model_config = ConfigDict(from_attributes=True)


class ComplaintCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    severity: ComplaintSeverity = ComplaintSeverity.MINOR
    customer_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    lot_number: Optional[str] = Field(None, max_length=100)
    customer_reference: Optional[str] = Field(None, max_length=100)
    received_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    assigned_to_id: Optional[UUID] = None


class ComplaintUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, min_length=1)
    status: Optional[ComplaintStatus] = None
    severity: Optional[ComplaintSeverity] = None
    customer_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    lot_number: Optional[str] = Field(None, max_length=100)
    customer_reference: Optional[str] = Field(None, max_length=100)
    received_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    assigned_to_id: Optional[UUID] = None
    resolution: Optional[str] = None
    root_cause: Optional[str] = None
    satisfaction_rating: Optional[int] = Field(None, ge=1, le=5)


class ComplaintResponse(TimestampSchema):
    id: UUID
    tenant_id: UUID
    number: str
    title: str
    description: str
    status: ComplaintStatus
    severity: ComplaintSeverity
    customer_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    lot_number: Optional[str] = None
    customer_reference: Optional[str] = None
    received_at: datetime
    due_date: Optional[datetime] = None
    assigned_to_id: Optional[UUID] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    resolution: Optional[str] = None
    root_cause: Optional[str] = None
    ncr_id: Optional[UUID] = None
    satisfaction_rating: Optional[int] = None
    customer: Optional[CustomerRef] = None
    product: Optional[ProductRef] = None
    assigned_to: Optional[UserRef] = None
    ncr: Optional[NcrRef] = None


class ComplaintListResponse(PaginatedResponse[ComplaintResponse]):
    pass


class ComplaintStats(BaseModel):
    total: int = 0
    new: int = 0
    under_review: int = 0
    investigating: int = 0
    action_pending: int = 0
    resolved: int = 0
    closed: int = 0
    rejected: int = 0
    open: int = 0
    critical: int = 0
    major: int = 0
    high_severity: int = 0
    overdue: int = 0
    avg_satisfaction: float = 0.0
    avg_resolution_days: float = 0.0
