"""Agent schemas"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict

from app.schemas.base import TimestampSchema, PaginatedResponse
from app.models.agent import AgentRunStatus, AgentRecommendationType, AgentRecommendationStatus


class AgentRunBase(BaseModel):
    trigger_type: str = Field(..., max_length=50, description="Trigger type: scheduled, manual, event")
    trigger_details: Dict[str, Any] = Field(default_factory=dict, description="Trigger details")


class AgentRunCreate(AgentRunBase):
    pass


class AgentRunResponse(AgentRunBase, TimestampSchema):
    id: UUID
    tenant_id: UUID
    status: AgentRunStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    result_summary: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class AgentRecommendationBase(BaseModel):
    type: AgentRecommendationType = Field(..., description="Recommendation type")
    severity: str = Field(..., max_length=20, description="Severity: info, warning, critical")
    title: str = Field(..., min_length=1, max_length=255, description="Recommendation title")
    description: Optional[str] = Field(None, description="Detailed description")
    rationale: Optional[str] = Field(None, description="Rationale for the recommendation")
    confidence: Optional[str] = Field(None, max_length=20, description="Confidence: low, medium, high")
    evidence: List[Dict[str, Any]] = Field(default_factory=list, description="Supporting evidence")
    missing_information: List[str] = Field(default_factory=list, description="Missing information")
    recommended_action: Dict[str, Any] = Field(default_factory=dict, description="Recommended action")


class AgentRecommendationResponse(AgentRecommendationBase, TimestampSchema):
    id: UUID
    tenant_id: UUID
    run_id: UUID
    status: AgentRecommendationStatus
    approved_by_id: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    implemented_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AgentRecommendationAction(BaseModel):
    action: str = Field(..., pattern="^(approve|reject|implement)$", description="Action to take")
    notes: Optional[str] = Field(None, description="Action notes")


class AgentChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User message")
    context: Optional[Dict[str, Any]] = Field(None, description="Additional context")


class AgentChatResponse(BaseModel):
    response: str = Field(..., description="Agent response")
    sources: List[Dict[str, Any]] = Field(default_factory=list, description="Information sources")
    recommendations: List[AgentRecommendationResponse] = Field(default_factory=list, description="Generated recommendations")