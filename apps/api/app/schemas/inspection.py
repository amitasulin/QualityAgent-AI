"""Quality inspection schemas"""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.inspection import (
    InspectionResultValue,
    InspectionStatus,
    InspectionType,
)
from app.schemas.base import PaginatedResponse, TimestampSchema


class ProductRef(BaseModel):
    id: UUID
    sku: str
    name: str

    model_config = ConfigDict(from_attributes=True)


class SiteRef(BaseModel):
    id: UUID
    name: str
    code: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UserRef(BaseModel):
    id: UUID
    full_name: str

    model_config = ConfigDict(from_attributes=True)


class PlanRef(BaseModel):
    id: UUID
    code: str
    name: str

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------- Plans
class InspectionPlanCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    inspection_type: InspectionType = InspectionType.IN_PROCESS
    frequency: str = Field("per_lot", max_length=50)
    sample_size: int = Field(5, ge=1, le=1000)
    characteristics: List[str] = Field(default_factory=list)
    product_id: Optional[UUID] = None
    site_id: Optional[UUID] = None
    is_active: bool = True


class InspectionPlanUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    inspection_type: Optional[InspectionType] = None
    frequency: Optional[str] = Field(None, max_length=50)
    sample_size: Optional[int] = Field(None, ge=1, le=1000)
    characteristics: Optional[List[str]] = None
    product_id: Optional[UUID] = None
    site_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class InspectionPlanResponse(TimestampSchema):
    id: UUID
    tenant_id: UUID
    code: str
    name: str
    description: Optional[str] = None
    inspection_type: InspectionType
    frequency: str
    sample_size: int
    characteristics: List[str] = Field(default_factory=list)
    product_id: Optional[UUID] = None
    site_id: Optional[UUID] = None
    is_active: bool
    product: Optional[ProductRef] = None
    site: Optional[SiteRef] = None
    inspections_count: int = 0


class InspectionPlanListResponse(PaginatedResponse[InspectionPlanResponse]):
    pass


# ---------------------------------------------------------------- Results
class InspectionResultCreate(BaseModel):
    characteristic: str = Field(..., min_length=1, max_length=255)
    result: InspectionResultValue = InspectionResultValue.PASS
    nominal: Optional[Decimal] = None
    tolerance_plus: Optional[Decimal] = None
    tolerance_minus: Optional[Decimal] = None
    measured_value: Optional[Decimal] = None
    unit: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None


class InspectionResultResponse(TimestampSchema):
    id: UUID
    inspection_id: UUID
    characteristic: str
    nominal: Optional[Decimal] = None
    tolerance_plus: Optional[Decimal] = None
    tolerance_minus: Optional[Decimal] = None
    measured_value: Optional[Decimal] = None
    unit: Optional[str] = None
    result: InspectionResultValue
    notes: Optional[str] = None


# ---------------------------------------------------------------- Inspections
class InspectionCreate(BaseModel):
    inspection_type: InspectionType = InspectionType.IN_PROCESS
    plan_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    site_id: Optional[UUID] = None
    lot_number: Optional[str] = Field(None, max_length=100)
    inspector_id: Optional[UUID] = None
    sample_size: int = Field(5, ge=1, le=1000)
    inspected_at: Optional[datetime] = None
    notes: Optional[str] = None


class InspectionUpdate(BaseModel):
    inspection_type: Optional[InspectionType] = None
    plan_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    site_id: Optional[UUID] = None
    lot_number: Optional[str] = Field(None, max_length=100)
    inspector_id: Optional[UUID] = None
    sample_size: Optional[int] = Field(None, ge=1, le=1000)
    inspected_at: Optional[datetime] = None
    notes: Optional[str] = None
    status: Optional[InspectionStatus] = None


class InspectionResponse(TimestampSchema):
    id: UUID
    tenant_id: UUID
    number: str
    inspection_type: InspectionType
    status: InspectionStatus
    plan_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    site_id: Optional[UUID] = None
    lot_number: Optional[str] = None
    inspector_id: Optional[UUID] = None
    inspected_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    sample_size: int
    passed_count: int
    failed_count: int
    notes: Optional[str] = None
    ncr_id: Optional[UUID] = None
    pass_rate: Optional[float] = None
    plan: Optional[PlanRef] = None
    product: Optional[ProductRef] = None
    site: Optional[SiteRef] = None
    inspector: Optional[UserRef] = None
    results: List[InspectionResultResponse] = Field(default_factory=list)


class InspectionListResponse(PaginatedResponse[InspectionResponse]):
    pass


class InspectionStats(BaseModel):
    total: int = 0
    planned: int = 0
    in_progress: int = 0
    passed: int = 0
    failed: int = 0
    on_hold: int = 0
    pass_rate: float = 0.0
    results_total: int = 0
    results_failed: int = 0
    open_findings: int = 0
