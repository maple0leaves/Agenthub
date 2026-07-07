"""AgentHub 模板助手 — 基于 LangGraph 的 RAG 对话 Agent"""
import json
from typing import Any, Dict, List, Optional, TypedDict

import httpx
from langgraph.graph import END, StateGraph

from .config import settings
from .milvus_store import milvus_store
from .schemas import ChatRequest, ChatResponse, SourceRef


class AgentState(TypedDict, total=False):
    request: ChatRequest
    authorization: Optional[str]
    intent: str
    agent_templates: List[Dict[str, Any]]
    sources: List[Dict[str, Any]]
    answer: str
    suggestions: List[str]
    errors: List[str]


INTENT_KEYWORDS = {
    "search_template": ("找", "搜", "推荐", "模板", "Agent", "工作流", "有什么"),
    "write_prompt": ("写", "Prompt", "提示词", "帮我写", "生成"),
    "build_workflow": ("工作流", "多Agent", "协作", "流程", "步骤"),
}


def detect_intent(message: str) -> str:
    for intent, keywords in INTENT_KEYWORDS.items():
        if any(kw in message for kw in keywords):
            return intent
    return "search_template"


def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("route", route_node)
    graph.add_node("search", search_node)
    graph.add_node("generate", generate_node)
    graph.set_entry_point("route")
    graph.add_edge("route", "search")
    graph.add_edge("search", "generate")
    graph.add_edge("generate", END)
    return graph.compile()


_AGENT_GRAPH = None


def get_graph():
    global _AGENT_GRAPH
    if _AGENT_GRAPH is None:
        _AGENT_GRAPH = build_graph()
    return _AGENT_GRAPH


async def run_agent(request: ChatRequest, authorization: Optional[str]) -> ChatResponse:
    state = await get_graph().ainvoke({
        "request": request,
        "authorization": authorization,
        "agent_templates": [],
        "sources": [],
        "errors": [],
    })
    return ChatResponse(
        answer=state.get("answer") or "暂时没有生成有效回答，请稍后再试。",
        sources=[
            SourceRef(agentId=s["agentId"], agentName=s.get("agentName", ""))
            for s in state.get("sources", [])
        ],
        suggestions=state.get("suggestions") or default_suggestions(state.get("intent", "search_template")),
        intent=state.get("intent", "search_template"),
        used_tools=["milvus_search"],
        debug={"errors": state.get("errors", [])},
    )


def route_node(state: AgentState) -> AgentState:
    message = state["request"].message.strip()
    state["intent"] = detect_intent(message)
    return state


def search_node(state: AgentState) -> AgentState:
    message = state["request"].message.strip()
    state.setdefault("errors", [])
    try:
        results = milvus_store.search(message, limit=5)
        state["agent_templates"] = [
            {"agentId": r.agentId, "title": r.title, "content": r.content, "score": r.score}
            for r in results
        ]
        state["sources"] = [
            {"agentId": r.agentId, "agentName": r.title} for r in results
        ]
    except Exception as exc:
        state["errors"].append(f"向量检索失败: {exc}")
        state["agent_templates"] = []
        state["sources"] = []
    return state


async def generate_node(state: AgentState) -> AgentState:
    if settings.openai_api_key and settings.openai_api_key != "replace_me":
        try:
            state["answer"] = await generate_with_llm(state)
        except Exception as exc:
            state.setdefault("errors", []).append(f"LLM调用失败: {exc}")
            state["answer"] = build_fallback_answer(state)
    else:
        state["answer"] = build_fallback_answer(state)
    state["suggestions"] = default_suggestions(state.get("intent", "search_template"))
    return state


async def generate_with_llm(state: AgentState) -> str:
    from langchain_core.messages import HumanMessage, SystemMessage
    from langchain_openai import ChatOpenAI

    llm = ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
        temperature=0.3,
    )

    templates = state.get("agent_templates", [])
    template_text = ""
    if templates:
        template_text = "\n\n检索到的相关模板：\n"
        for i, t in enumerate(templates, 1):
            content_preview = (t.get("content") or "")[:100]
            template_text += f"{i}. {t['title']} — {content_preview} (匹配度:{t.get('score', 0):.2f})\n"

    sys_prompt = (
        "你是 AgentHub 社区的 AI Agent 模板助手。帮助用户发现、创建和使用 AI Agent 模板。"
        "根据检索到的模板信息回答用户问题，推荐最匹配的模板。请用中文回复，格式使用 Markdown。"
        + template_text
    )

    messages = [
        SystemMessage(content=sys_prompt),
        HumanMessage(content=state["request"].message),
    ]
    response = await llm.ainvoke(messages)
    return str(response.content).strip()


def build_fallback_answer(state: AgentState) -> str:
    templates = state.get("agent_templates", [])
    message = state["request"].message

    if not templates:
        return (
            f"关于「{message[:30]}」，我暂时没有在模板库中找到高度匹配的结果。\n\n"
            "建议：\n"
            "1. 尝试用更具体的关键词搜索\n"
            "2. 浏览社区热门模板获取灵感\n"
            "3. 自己创建一个新模板分享给社区"
        )

    lines = ["根据你的需求，推荐以下 Agent 模板：\n"]
    for i, t in enumerate(templates, 1):
        lines.append(f"{i}. **{t['title']}** — {(t.get('content') or '')[:80]}  ")
    lines.append("\n你可以告诉我更具体的需求，我帮你进一步筛选。")
    return "\n".join(lines)


def default_suggestions(intent: str) -> List[str]:
    if intent == "write_prompt":
        return ["帮我写一个客服Agent的提示词", "写一个代码审查的Prompt", "推荐Prompt模板"]
    if intent == "build_workflow":
        return ["设计一个内容创作工作流", "多Agent协作的最佳实践", "看看热门工作流模板"]
    return ["推荐几个热门模板", "帮我找一个客服Agent", "最近有哪些新的工作流模板"]
