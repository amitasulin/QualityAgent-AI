"""User schemas"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, EmailStr, ConfigDict

from app.schemas.base import TimestampSchema, PaginatedResponse
from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr = Field(..., description="User email")
    full_name: str = Field(..., min_length=1, max_length=255, description="Full name")
    role: UserRole = Field(UserRole.VIEWER, description="User role")
    site_id: Optional[UUID] = Field(None, description="Assigned site ID")
    phone: Optional[str] = Field(None, max_length=50, description="Phone number")
    is_active: bool = Field(True, description="Whether the user is active")


class UserCreate(UserBase):
    identity_id: str = Field(..., min_length=1, max_length=255, description="External identity provider ID")


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    role: Optional[UserRole] = None
    site_id: Optional[UUID] = None
    phone: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


class UserResponse(UserBase, TimestampSchema):
    id: UUID
    tenant_id: UUID
    identity_id: str
    last_login_at: Optional[datetime] = None
    avatar_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UserListResponse(PaginatedResponse[UserResponse]):
    pass


# Current user profile (includes permissions)
class CurrentUserResponse(UserResponse):
    permissions: list[str] = Field(default_factory=list)