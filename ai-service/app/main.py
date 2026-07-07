from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware

from .agent import run_agent
from .agenthub_schemas import AgentIndexRequest, AgentSearchRequest, AgentSearchResponse
from .config import settings
from .milvus_store import milvus_store
from .rerank import rerank_available
from .schemas import ChatRequest, ChatResponse


app = FastAPI(title="AgentHub AI Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "java_base_url": settings.java_base_url,
        "model": settings.openai_model,
        "model_configured": bool(settings.openai_api_key and settings.openai_api_key != "replace_me"),
        "embedding": {
            "model": settings.embedding_model,
            "dim": settings.embedding_dim,
            "base_url": settings.embedding_base_url,
            "configured": bool(
                (settings.embedding_api_key or settings.openai_api_key)
                and (settings.embedding_api_key or settings.openai_api_key) != "replace_me"
            ),
        },
        "rerank": {
            "enabled": settings.rerank_enabled,
            "model": settings.rerank_model,
            "candidates": settings.rerank_candidates,
            "active": rerank_available(),
        },
        "milvus": milvus_store.health(),
    }


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, authorization: str = Header(default=None)):
    return await run_agent(request, authorization)


@app.post("/api/agents/index")
def index_agent(request: AgentIndexRequest):
    milvus_store.upsert_agent(request)
    return {"success": True, "agentId": request.agentId, "versionId": request.versionId}


@app.post("/api/agents/search", response_model=AgentSearchResponse)
def search_agents(request: AgentSearchRequest):
    try:
        results = milvus_store.search(request.query, request.limit)
        return AgentSearchResponse(agentIds=[item.agentId for item in results], results=results)
    except Exception as exc:
        return AgentSearchResponse(agentIds=[], results=[], degraded=True, error=str(exc))
