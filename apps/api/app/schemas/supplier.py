"""Supplier schemas"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal

from app.schemas.base import TimestampSchema, PaginatedResponse


class SupplierBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=50, description="Supplier code")
    name: str = Field(..., min_length=1, max_length=255, description="Supplier name")
    contact_person: Optional[str] = Field(None, max_length=255, description="Contact person")
    contact_email: Optional[str] = Field(None, max_length=255, description="Contact email")
    contact_phone: Optional[str] = Field(None, max_length=50, description="Contact phone")
    address: Optional[str] = Field(None, description="Supplier address")
    quality_rating: Optional[Decimal] = Field(None, ge=0, le=5, description="Quality rating (0-5)")
    is_approved: bool = Field(False, description="Whether the supplier is approved")
    is_active: bool = Field(True, description="Whether the supplier is active")


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    contact_person: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[str] = Field(None, max_length=255)
    contact_phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None
    quality_rating: Optional[Decimal] = Field(None, ge=0, le=5)
    is_approved: Optional[bool] = None
    is_active: Optional[bool] = None


class SupplierResponse(SupplierBase, TimestampSchema):
    id: UUID
    tenant_id: UUID

    model_config = ConfigDict(from_attributes=True)


class SupplierListResponse(PaginatedResponse[SupplierResponse]):
    pass