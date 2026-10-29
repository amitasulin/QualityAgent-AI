"""Site schemas"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict

from app.schemas.base import TimestampSchema, PaginatedResponse


class SiteBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Site name")
    code: Optional[str] = Field(None, max_length=50, description="Site code")
    address: Optional[str] = Field(None, description="Site address")
    contact_person: Optional[str] = Field(None, max_length=255, description="Contact person name")
    contact_email: Optional[str] = Field(None, max_length=255, description="Contact email")
    contact_phone: Optional[str] = Field(None, max_length=50, description="Contact phone")
    is_active: bool = Field(True, description="Whether the site is active")


class SiteCreate(SiteBase):
    pass


class SiteUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None
    contact_person: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[str] = Field(None, max_length=255)
    contact_phone: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


class SiteResponse(SiteBase, TimestampSchema):
    id: UUID
    tenant_id: UUID

    model_config = ConfigDict(from_attributes=True)


class SiteListResponse(PaginatedResponse[SiteResponse]):
    pass