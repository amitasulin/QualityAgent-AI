"""Nonconformity (NCR) schemas"""
from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal

from app.schemas.base import TimestampSchema, PaginatedResponse
from app.models.nonconformity import NCRStatus, NCRSeverity


class NCRAttachmentResponse(BaseModel):
    id: UUID
    ncr_id: UUID
    file_key: str
    file_name: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    description: Optional[str] = None
    uploaded_by_id: Optional[UUID] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NonconformityBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="NCR title")
    description: str = Field(..., min_length=1, description="NCR description")
    severity: NCRSeverity = Field(NCRSeverity.MINOR, description="Severity level")
    product_id: Optional[UUID] = Field(None, description="Product ID")
    site_id: Optional[UUID] = Field(None, description="Site ID")
    customer_id: Optional[UUID] = Field(None, description="Customer ID")
    supplier_id: Optional[UUID] = Field(None, description="Supplier ID")
    lot_number: Optional[str] = Field(None, max_length=100, description="Lot/Batch number")
    serial_number: Optional[str] = Field(None, max_length=100, description="Serial number")
    defect_code: Optional[str] = Field(None, max_length=50, description="Defect code")
    defect_description: Optional[str] = Field(None, description="Defect description")
    measured_value: Optional[Decimal] = Field(None, description="Measured value")
    unit: Optional[str] = Field(None, max_length=20, description="Unit of measure")
    requirement_version_id: Optional[UUID] = Field(None, description="Requirement document version ID")


class NonconformityCreate(NonconformityBase):
    pass


class NonconformityUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    severity: Optional[NCRSeverity] = None
    product_id: Optional[UUID] = None
    site_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    supplier_id: Optional[UUID] = None
    lot_number: Optional[str] = Field(None, max_length=100)
    serial_number: Optional[str] = Field(None, max_length=100)
    defect_code: Optional[str] = Field(None, max_length=50)
    defect_description: Optional[str] = None
    measured_value: Optional[Decimal] = None
    unit: Optional[str] = Field(None, max_length=20)
    requirement_version_id: Optional[UUID] = None


class NonconformityResponse(NonconformityBase, TimestampSchema):
    id: UUID
    tenant_id: UUID
    number: str
    status: NCRStatus
    detected_by_id: Optional[UUID] = None
    detected_at: datetime
    assigned_to_id: Optional[UUID] = None
    contained_at: Optional[datetime] = None
    contained_by_id: Optional[UUID] = None
    containment_action: Optional[str] = None
    root_cause: Optional[str] = None
    root_cause_analysis_method: Optional[str] = None
    closed_at: Optional[datetime] = None
    closed_by_id: Optional[UUID] = None
    closure_notes: Optional[str] = None
    attachments: List[NCRAttachmentResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class NonconformityListResponse(PaginatedResponse[NonconformityResponse]):
    pass


# Status transition schema
class NCRStatusTransition(BaseModel):
    status: NCRStatus = Field(..., description="New status")
    notes: Optional[str] = Field(None, description="Transition notes")
    containment_action: Optional[str] = Field(None, description="Containment action (for contained status)")
    root_cause: Optional[str] = Field(None, description="Root cause (for investigating status)")
    root_cause_analysis_method: Optional[str] = Field(None, max_length=100, description="Analysis method")
    closure_notes: Optional[str] = Field(None, description="Closure notes (for closed status)")