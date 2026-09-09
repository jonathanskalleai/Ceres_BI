"""Typed HTTP and persistence models for the conversational BI assistant."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class YaFilters(BaseModel):
    from_date: Optional[str] = Field(default=None, alias="from", max_length=10)
    to_date: Optional[str] = Field(default=None, alias="to", max_length=10)
    categoria: Optional[str] = Field(default=None, max_length=120)
    funil: Optional[str] = Field(default=None, max_length=120)
    funis: list[str] = Field(default_factory=list, max_length=10)
    vendedor: Optional[str] = Field(default=None, max_length=120)
    cidade: Optional[str] = Field(default=None, max_length=120)
    produto: Optional[str] = Field(default=None, max_length=120)
    condicao: Optional[str] = Field(default=None, max_length=120)
    origem: Optional[str] = Field(default=None, max_length=120)
    banco: Optional[str] = Field(default=None, max_length=120)
    motivo_perda: Optional[str] = Field(default=None, alias="motivoPerda", max_length=120)

    model_config = {"populate_by_name": True}


class YaContext(BaseModel):
    route: str = Field(default="/bi/painel", max_length=120)
    filters: YaFilters = Field(default_factory=YaFilters)


class YaChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2_000)
    conversation_id: Optional[str] = None
    context: YaContext = Field(default_factory=YaContext)

    @field_validator("message")
    @classmethod
    def message_must_contain_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("message must contain non-whitespace text")
        return value


class YaSource(BaseModel):
    id: str
    label: str
    filters: dict[str, Any] = Field(default_factory=dict)
    requested_filters: dict[str, Any] = Field(default_factory=dict)
    refreshed_at: Optional[str] = None
    intent: str = ""
    metric_definitions: list[dict[str, Any]] = Field(default_factory=list)
    applied_scope: dict[str, Any] = Field(default_factory=dict)
    freshness: dict[str, Any] = Field(default_factory=dict)
    lineage: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    drilldown_ref: Optional[str] = None
    execution_metrics: dict[str, Any] = Field(default_factory=dict)
    preview: Any = None


class YaChatResponse(BaseModel):
    conversation_id: str
    assistant_message_id: str
    answer: str
    sources: list[YaSource]
    evidence: list[YaSource] = Field(default_factory=list)
    query_spec: dict[str, Any] = Field(default_factory=dict)
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    choices: list[dict[str, Any]] = Field(default_factory=list)
    generated_at: str


class FeedbackRequest(BaseModel):
    feedback_type: Literal["useful", "incorrect_number", "insufficient_source"]


class ConversationPreview(BaseModel):
    id: str
    title: str
    status: str
    updated_at: str
    last_message_at: Optional[str] = None


class ConversationMessage(BaseModel):
    id: str
    role: str
    content: str
    sources: list[YaSource] = Field(default_factory=list)
    query_spec: dict[str, Any] = Field(default_factory=dict)
    evidence: list[YaSource] = Field(default_factory=list)
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    choices: list[dict[str, Any]] = Field(default_factory=list)
    created_at: str


class ConversationDetail(BaseModel):
    id: str
    title: str
    status: str
    summary: str = ""
    conversation_state: dict[str, Any] = Field(default_factory=dict)
    updated_at: str
    messages: list[ConversationMessage]


@dataclass
class PreparedTurn:
    conversation_id: str
    user_message_id: str
    history: list[dict[str, str]]
    summary: str
    conversation_state: dict[str, Any]
    query_spec: dict[str, Any]
    sources: list[YaSource]
    executed: list[dict[str, Any]]
    answer_override: Optional[str]
    db_ms: int
    cache_hits: int
    row_count: int
    last_sources: list[YaSource] = field(default_factory=list)
