"""Attachment schemas."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import ConfigDict

from app.schemas.base import BaseSchema


class AttachmentResponse(BaseSchema):
    id: UUID
    entity_type: str
    entity_id: UUID
    file_name: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    uploaded_by_id: Optional[UUID] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
