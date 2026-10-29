"""Product schemas"""
from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict

from app.schemas.base import TimestampSchema, PaginatedResponse


class ProductBase(BaseModel):
    sku: str = Field(..., min_length=1, max_length=100, description="Product SKU")
    name: str = Field(..., min_length=1, max_length=255, description="Product name")
    description: Optional[str] = Field(None, description="Product description")
    revision: str = Field("1.0", max_length=50, description="Product revision")
    unit: Optional[str] = Field(None, max_length=20, description="Unit of measure")
    category: Optional[str] = Field(None, max_length=100, description="Product category")
    drawing_number: Optional[str] = Field(None, max_length=100, description="Drawing number")
    specification: Dict[str, Any] = Field(default_factory=dict, description="Product specifications")
    is_active: bool = Field(True, description="Whether the product is active")


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    sku: Optional[str] = Field(None, min_length=1, max_length=100)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    revision: Optional[str] = Field(None, max_length=50)
    unit: Optional[str] = Field(None, max_length=20)
    category: Optional[str] = Field(None, max_length=100)
    drawing_number: Optional[str] = Field(None, max_length=100)
    specification: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class ProductResponse(ProductBase, TimestampSchema):
    id: UUID
    tenant_id: UUID

    model_config = ConfigDict(from_attributes=True)


class ProductListResponse(PaginatedResponse[ProductResponse]):
    pass