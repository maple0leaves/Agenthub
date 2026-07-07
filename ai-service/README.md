# AGENTHUB AI Service

This is the Python AI/Agent sidecar for the Java AGENTHUB project. Java remains the business system, while this service handles natural-language understanding, tool orchestration, and model calls.

## What it does

- Exposes `POST /api/chat` for the Java `/ai/chat` proxy.
- Uses LangGraph to route a user message into a small workflow.
- Uses an OpenAI-compatible chat model when configured.
- Falls back to a deterministic answer when no API key is configured, so local wiring can be tested first.
- Exposes AgentHub vector APIs:
  - `POST /api/agents/index` creates or refreshes a Milvus vector record.
  - `POST /api/agents/search` returns semantically similar Agent IDs.

## Start on Linux

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

`OPENAI_API_KEY` can stay empty for local smoke tests. AgentHub vector search will use deterministic hash embeddings when no model key is configured.

Then start the Java service on port `8081` and call:

```http
POST http://127.0.0.1:8081/ai/chat
Content-Type: application/json

{
  "message": "帮我找一个适合总结论文的 Agent"
}
```

AgentHub semantic search APIs can be tested directly:

```bash
curl http://127.0.0.1:8000/health

curl -X POST http://127.0.0.1:8000/api/agents/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"帮我总结论文","limit":10}'
```

## Environment

- `AGENTHUB_JAVA_BASE_URL`: Java service base URL, default `http://127.0.0.1:8081`.
- `OPENAI_API_KEY`: model API key. Leave empty to test fallback mode.
- `OPENAI_BASE_URL`: OpenAI-compatible endpoint.
- `OPENAI_MODEL`: chat model name.
- `AI_REQUEST_TIMEOUT`: HTTP timeout in seconds.
- `MILVUS_HOST`: Milvus host, default `127.0.0.1`.
- `MILVUS_PORT`: Milvus port, default `19530`.
- `MILVUS_COLLECTION`: collection name, default `agent_vectors`.
- `EMBEDDING_API_KEY`: embedding API key (independent of chat). Falls back to `OPENAI_API_KEY` when empty.
- `EMBEDDING_BASE_URL`: embedding endpoint, default `https://api.siliconflow.cn/v1` (SiliconFlow).
- `EMBEDDING_MODEL`: OpenAI-compatible embedding model, default `BAAI/bge-m3`.
- `EMBEDDING_DIM`: vector dimension, default `1024` (matches `bge-m3`).
- `RERANK_ENABLED`: enable two-stage retrieval (vector recall -> reranker), default `true`.
- `RERANK_MODEL`: reranker model, default `BAAI/bge-reranker-v2-m3`.
- `RERANK_BASE_URL` / `RERANK_API_KEY`: reranker endpoint/key; fall back to `EMBEDDING_*` when empty.
- `RERANK_CANDIDATES`: how many candidates the vector stage recalls before reranking, default `20`.

> Changing `EMBEDDING_DIM` (e.g. switching embedding models) makes the Milvus collection
> incompatible. The service auto-detects the mismatch and rebuilds the collection on next use;
> you then need to re-index existing Agents (re-publish/update them, which re-calls
> `POST /api/agents/index`).
