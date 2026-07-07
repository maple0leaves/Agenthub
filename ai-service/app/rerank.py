from typing import List, Optional, Tuple

import httpx

from .config import settings


def rerank_api_key() -> str:
    # 复用 embedding / chat 的 key：rerank 与 embedding 一般在同一家（硅基流动）。
    return settings.rerank_api_key or settings.embedding_api_key or settings.openai_api_key


def rerank_available() -> bool:
    key = rerank_api_key()
    return bool(settings.rerank_enabled and key and key != "replace_me")


def rerank_documents(query: str, documents: List[str], top_n: int) -> Optional[List[Tuple[int, float]]]:
    """调用 BGE reranker 对候选文档精排。

    返回 [(原始下标, 相关性分数)]，按相关性降序；不可用或失败时返回 None（调用方降级）。
    """
    if not rerank_available() or not documents:
        return None

    base_url = settings.rerank_base_url or settings.embedding_base_url
    url = f"{base_url}/rerank"
    payload = {
        "model": settings.rerank_model,
        "query": query,
        "documents": documents,
        "top_n": min(top_n, len(documents)),
    }
    headers = {"Authorization": f"Bearer {rerank_api_key()}"}
    try:
        response = httpx.post(url, json=payload, headers=headers, timeout=settings.request_timeout)
        response.raise_for_status()
        results = response.json().get("results") or []
        ranked: List[Tuple[int, float]] = []
        for item in results:
            index = item.get("index")
            if index is None:
                continue
            ranked.append((int(index), float(item.get("relevance_score", 0.0))))
        return ranked or None
    except Exception:
        return None
