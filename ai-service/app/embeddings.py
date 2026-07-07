import hashlib
import math
import re
from typing import List

from openai import OpenAI

from .config import settings


_TOKEN_RE = re.compile(r"[\w\u4e00-\u9fff]+", re.UNICODE)


def _embedding_api_key() -> str:
    # 优先用独立的 embedding key（如硅基流动），未配置时回退到 chat 的 key。
    return settings.embedding_api_key or settings.openai_api_key


def embed_text(text: str) -> List[float]:
    api_key = _embedding_api_key()
    if api_key and api_key != "replace_me":
        try:
            return _api_embedding(text, api_key)
        except Exception:
            return _hash_embedding(text)
    return _hash_embedding(text)


def _api_embedding(text: str, api_key: str) -> List[float]:
    # BGE 等模型输出固定维度，不接受 dimensions 参数，因此这里不传，靠下方对齐兜底。
    client = OpenAI(api_key=api_key, base_url=settings.embedding_base_url)
    response = client.embeddings.create(model=settings.embedding_model, input=text)
    vector = list(response.data[0].embedding)
    if len(vector) == settings.embedding_dim:
        return _normalize(vector)
    if len(vector) > settings.embedding_dim:
        return _normalize(vector[: settings.embedding_dim])
    return _normalize(vector + [0.0] * (settings.embedding_dim - len(vector)))


def _hash_embedding(text: str) -> List[float]:
    dim = settings.embedding_dim
    vector = [0.0] * dim
    tokens = _tokenize(text or "")
    if not tokens:
        tokens = [text or "empty"]
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        idx = int.from_bytes(digest[:4], "little") % dim
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[idx] += sign
    return _normalize(vector)


def _tokenize(text: str) -> List[str]:
    tokens = _TOKEN_RE.findall(text.lower())
    expanded: List[str] = []
    for token in tokens:
        expanded.append(token)
        if any("\u4e00" <= char <= "\u9fff" for char in token):
            chars = [char for char in token if "\u4e00" <= char <= "\u9fff"]
            expanded.extend(chars)
            expanded.extend("".join(chars[index : index + 2]) for index in range(max(len(chars) - 1, 0)))
    return expanded


def _normalize(vector: List[float]) -> List[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [float(value / norm) for value in vector]
