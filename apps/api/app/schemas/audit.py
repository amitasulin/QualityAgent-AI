"""Audit trail schemas."""
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import field_validator

from app.schemas.base import BaseSchema


class AuditEventResponse(BaseSchema):
    id: UUID
    actor_id: Optional[UUID] = None
    actor_name: Optional[str] = None
    actor_type: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[UUID] = None
    old_values: Optional[dict[str, Any]] = None
    new_values: Optional[dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    correlation_id: Optional[UUID] = None
    created_at: datetime

    @field_validator("ip_address", mode="before")
    @classmethod
    def _ip_to_string(cls, value: Any) -> Optional[str]:
        """Postgres INET values arrive as ipaddress objects; serialise them."""
        return str(value) if value is not None else None
