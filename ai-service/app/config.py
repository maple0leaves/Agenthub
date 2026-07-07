import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    java_base_url: str = os.getenv("AGENTHUB_JAVA_BASE_URL", "http://127.0.0.1:8081").rstrip("/")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    request_timeout: int = _int_env("AI_REQUEST_TIMEOUT", 8)
    milvus_host: str = os.getenv("MILVUS_HOST", "127.0.0.1")
    milvus_port: str = os.getenv("MILVUS_PORT", "19530")
    milvus_collection: str = os.getenv("MILVUS_COLLECTION", "agent_vectors")
    # Embedding 独立于 chat 模型：默认走硅基流动的 BGE（OpenAI 兼容接口）。
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
    embedding_dim: int = _int_env("EMBEDDING_DIM", 1024)
    embedding_api_key: str = os.getenv("EMBEDDING_API_KEY", "")
    embedding_base_url: str = os.getenv("EMBEDDING_BASE_URL", "https://api.siliconflow.cn/v1").rstrip("/")
    # 两阶段检索的第二阶段：向量召回后用 reranker 精排。默认走硅基流动的 BGE reranker。
    rerank_enabled: bool = _bool_env("RERANK_ENABLED", True)
    rerank_model: str = os.getenv("RERANK_MODEL", "BAAI/bge-reranker-v2-m3")
    rerank_base_url: str = os.getenv("RERANK_BASE_URL", "").rstrip("/")
    rerank_api_key: str = os.getenv("RERANK_API_KEY", "")
    rerank_candidates: int = _int_env("RERANK_CANDIDATES", 20)


settings = Settings()