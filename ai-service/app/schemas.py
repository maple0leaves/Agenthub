from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class UserContext(BaseModel):
    id: Optional[int] = None
    nickName: Optional[str] = None
    icon: Optional[str] = None


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    user: Optional[UserContext] = None


class SourceRef(BaseModel):
    """回答引用的模板来源，用于溯源与降低幻觉。"""

    agentId: int
    agentName: str = ""
    score: Optional[float] = None


class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceRef] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    intent: str = "search_template"
    used_tools: List[str] = Field(default_factory=list)
    debug: Dict[str, Any] = Field(default_factory=dict)
