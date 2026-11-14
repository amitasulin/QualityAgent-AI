"""Schemas for the global search endpoint."""
from typing import List, Optional

from pydantic import Field

from app.schemas.base import BaseSchema


class SearchResultItem(BaseSchema):
    id: str
    title: str
    subtitle: Optional[str] = None
    status: Optional[str] = None
    href: str


class SearchGroup(BaseSchema):
    type: str
    label: str
    items: List[SearchResultItem]


class SearchResponse(BaseSchema):
    query: str
    total: int = Field(0, ge=0)
    groups: List[SearchGroup] = Field(default_factory=list)
