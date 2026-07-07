from typing import List, Optional

from .agenthub_schemas import AgentIndexRequest, AgentSearchHit
from .config import settings
from .embeddings import embed_text
from .rerank import rerank_available, rerank_documents


class MilvusAgentStore:
    def __init__(self) -> None:
        self._collection = None

    def health(self) -> dict:
        try:
            collection = self._get_collection()
            return {
                "enabled": True,
                "connected": True,
                "collection": collection.name,
                "embedding_dim": settings.embedding_dim,
            }
        except Exception as exc:
            return {
                "enabled": True,
                "connected": False,
                "collection": settings.milvus_collection,
                "embedding_dim": settings.embedding_dim,
                "error": str(exc),
            }

    def upsert_agent(self, request: AgentIndexRequest) -> None:
        collection = self._get_collection()
        vector = embed_text(f"{request.title}\n{request.content}")
        expr = f"agent_id == {int(request.agentId)}"
        try:
            collection.delete(expr)
        except Exception:
            pass
        collection.insert([
            [int(request.agentId)],
            [int(request.versionId)],
            [request.title[:512]],
            [request.content[:8192]],
            [vector],
        ])
        collection.flush()

    def search(self, query: str, limit: int) -> List[AgentSearchHit]:
        collection = self._get_collection()
        vector = embed_text(query)
        # 第一阶段：向量召回。开启 rerank 时多召回一批候选，交给第二阶段精排。
        use_rerank = rerank_available()
        candidate_k = max(limit, settings.rerank_candidates) if use_rerank else limit
        hits = collection.search(
            data=[vector],
            anns_field="embedding",
            param={"metric_type": "COSINE", "params": {"nprobe": 10}},
            limit=candidate_k,
            output_fields=["agent_id", "version_id", "title", "content"],
        )
        candidates: List[AgentSearchHit] = []
        for hit in hits[0]:
            entity = hit.entity
            candidates.append(
                AgentSearchHit(
                    agentId=int(entity.get("agent_id")),
                    versionId=int(entity.get("version_id")),
                    title=str(entity.get("title") or ""),
                    content=str(entity.get("content") or ""),
                    score=float(hit.score),
                )
            )
        # 第二阶段：reranker 精排；不可用或失败时降级为向量召回顺序。
        if use_rerank and len(candidates) > 1:
            reranked = self._apply_rerank(query, candidates, limit)
            if reranked is not None:
                return reranked
        return candidates[:limit]

    @staticmethod
    def _apply_rerank(query: str, candidates: List[AgentSearchHit], limit: int) -> Optional[List[AgentSearchHit]]:
        documents = [f"{hit.title}\n{hit.content}"[:1024] for hit in candidates]
        ranked = rerank_documents(query, documents, limit)
        if not ranked:
            return None
        results: List[AgentSearchHit] = []
        for index, score in ranked[:limit]:
            if 0 <= index < len(candidates):
                hit = candidates[index]
                results.append(
                    AgentSearchHit(
                        agentId=hit.agentId,
                        versionId=hit.versionId,
                        title=hit.title,
                        content=hit.content,
                        score=score,
                    )
                )
        return results or None

    def _get_collection(self):
        if self._collection is not None:
            return self._collection
        from pymilvus import Collection, CollectionSchema, DataType, FieldSchema, connections, utility

        connections.connect(alias="default", host=settings.milvus_host, port=settings.milvus_port)
        # 若已存在的 collection 维度与当前 embedding 维度不一致（如换了 embedding 模型），
        # 直接 drop 重建：向量数据可从业务库重新灌入，无需保留。
        if utility.has_collection(settings.milvus_collection):
            existing_dim = self._existing_embedding_dim(Collection(settings.milvus_collection))
            if existing_dim is not None and existing_dim != settings.embedding_dim:
                utility.drop_collection(settings.milvus_collection)
        if not utility.has_collection(settings.milvus_collection):
            fields = [
                FieldSchema(name="agent_id", dtype=DataType.INT64, is_primary=True, auto_id=False),
                FieldSchema(name="version_id", dtype=DataType.INT64),
                FieldSchema(name="title", dtype=DataType.VARCHAR, max_length=512),
                FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=8192),
                FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=settings.embedding_dim),
            ]
            schema = CollectionSchema(fields=fields, description="AgentHub semantic search vectors")
            collection = Collection(settings.milvus_collection, schema=schema)
            collection.create_index(
                field_name="embedding",
                index_params={"metric_type": "COSINE", "index_type": "IVF_FLAT", "params": {"nlist": 128}},
            )
        else:
            collection = Collection(settings.milvus_collection)
        collection.load()
        self._collection = collection
        return collection

    @staticmethod
    def _existing_embedding_dim(collection):
        for field in collection.schema.fields:
            if field.name == "embedding":
                return field.params.get("dim")
        return None


milvus_store = MilvusAgentStore()