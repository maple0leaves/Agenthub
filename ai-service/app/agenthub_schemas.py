from typing import List, Optional

from pydantic import BaseModel, Field


class AgentIndexRequest(BaseModel):
    agentId: int
    versionId: int
    title: str = Field(..., min_length=1, max_length=256)
    content: str = Field(..., min_length=1)


class AgentSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    limit: int = Field(default=10, ge=1, le=50)


class AgentSearchHit(BaseModel):
    agentId: int
    versionId: Optional[int] = None
    title: str = ""
    content: str = ""
    score: float = 0.0


class AgentSearchResponse(BaseModel):
    agentIds: List[int]
    results: List[AgentSearchHit]
    degraded: bool = False
    error: Optional[str] = None