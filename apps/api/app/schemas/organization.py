"""Organization schemas"""
from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict

from app.schemas.base import TimestampSchema, PaginatedResponse
from app.models.organization import OrganizationStatus


class OrganizationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Organization name")
    industry: Optional[str] = Field(None, max_length=100, description="Industry type")
    timezone: str = Field("Asia/Jerusalem", max_length=50, description="Timezone")
    settings: Dict[str, Any] = Field(default_factory=dict, description="Organization settings")


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    industry: Optional[str] = Field(None, max_length=100)
    timezone: Optional[str] = Field(None, max_length=50)
    status: Optional[OrganizationStatus] = None
    settings: Optional[Dict[str, Any]] = None


class OrganizationResponse(OrganizationBase, TimestampSchema):
    id: UUID
    status: OrganizationStatus

    model_config = ConfigDict(from_attributes=True)


class OrganizationListResponse(PaginatedResponse[OrganizationResponse]):
    pass