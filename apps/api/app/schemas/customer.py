"""Customer schemas"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict

from app.schemas.base import TimestampSchema, PaginatedResponse


class CustomerBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=50, description="Customer code")
    name: str = Field(..., min_length=1, max_length=255, description="Customer name")
    contact_person: Optional[str] = Field(None, max_length=255, description="Contact person")
    contact_email: Optional[str] = Field(None, max_length=255, description="Contact email")
    contact_phone: Optional[str] = Field(None, max_length=50, description="Contact phone")
    address: Optional[str] = Field(None, description="Customer address")
    quality_requirements: Optional[str] = Field(None, description="Quality requirements")
    is_active: bool = Field(True, description="Whether the customer is active")


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    contact_person: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[str] = Field(None, max_length=255)
    contact_phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None
    quality_requirements: Optional[str] = None
    is_active: Optional[bool] = None


class CustomerResponse(CustomerBase, TimestampSchema):
    id: UUID
    tenant_id: UUID

    model_config = ConfigDict(from_attributes=True)


class CustomerListResponse(PaginatedResponse[CustomerResponse]):
    pass