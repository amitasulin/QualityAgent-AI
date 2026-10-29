"""Document and DocumentVersion schemas"""
from datetime import datetime, date
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict

from app.schemas.base import TimestampSchema, PaginatedResponse
from app.models.document import DocumentStatus


class DocumentBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Document title")
    code: str = Field(..., min_length=1, max_length=100, description="Document code")
    category: Optional[str] = Field(None, max_length=100, description="Document category")
    description: Optional[str] = Field(None, description="Document description")
    status: DocumentStatus = Field(DocumentStatus.DRAFT, description="Document status")
    owner_id: Optional[UUID] = Field(None, description="Document owner user ID")
    effective_from: Optional[date] = Field(None, description="Effective from date")
    effective_until: Optional[date] = Field(None, description="Effective until date")
    tags: List[str] = Field(default_factory=list, description="Document tags")


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    code: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    status: Optional[DocumentStatus] = None
    owner_id: Optional[UUID] = None
    effective_from: Optional[date] = None
    effective_until: Optional[date] = None
    tags: Optional[List[str]] = None


class DocumentResponse(DocumentBase, TimestampSchema):
    id: UUID
    tenant_id: UUID
    current_version_id: Optional[UUID] = None
    approved_by_id: Optional[UUID] = None
    approved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DocumentListResponse(PaginatedResponse[DocumentResponse]):
    pass


# Document Version schemas
class DocumentVersionBase(BaseModel):
    version: str = Field(..., min_length=1, max_length=50, description="Version number")
    file_key: str = Field(..., min_length=1, max_length=500, description="Storage file key")
    file_name: str = Field(..., min_length=1, max_length=255, description="Original file name")
    file_size: Optional[int] = Field(None, description="File size in bytes")
    mime_type: Optional[str] = Field(None, max_length=100, description="MIME type")
    checksum: Optional[str] = Field(None, max_length=64, description="File checksum")
    change_summary: Optional[str] = Field(None, description="Summary of changes")
    is_current: bool = Field(False, description="Whether this is the current version")


class DocumentVersionCreate(DocumentVersionBase):
    document_id: UUID = Field(..., description="Parent document ID")


class DocumentVersionResponse(DocumentVersionBase, TimestampSchema):
    id: UUID
    document_id: UUID
    uploaded_by_id: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)