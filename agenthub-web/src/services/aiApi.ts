import type { AiChatPayload, ChatMessage } from '../types';
import { request } from './base';

export const aiApi = {
  aiChat: (payload: AiChatPayload) => request<Record<string, unknown>>('/ai/chat', { method: 'POST', body: JSON.stringify(payload) }),
  /** RAG-powered chat — returns assistant message with source refs */
  chatRag: (message: string, history: ChatMessage[] = []) =>
    request<ChatMessage>('/ai/chat/rag', { method: 'POST', body: JSON.stringify({ message, history }) }),
  /** Deepseek-v4 chat — direct Deepseek API */
  chatDeepseek: (message: string, history: ChatMessage[] = []) =>
    request<ChatMessage>('/ai/chat/deepseek', { method: 'POST', body: JSON.stringify({ message, history }) }),
  /**
   * SSE streaming chat — returns an async generator that yields chunks.
   * Usage: for await (const chunk of api.chatStream(msg, history)) { ... }
   */
  chatStream: async function* (message: string, history: ChatMessage[] = []): AsyncGenerator<{ type: 'token' | 'sources' | 'done' | 'error'; data: any }> {
    const token = localStorage.getItem('agenthub-token') || '';
    const response = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'authorization': token },
      body: JSON.stringify({ message, history }),
    });
    if (!response.ok) {
      yield { type: 'error', data: `HTTP ${response.status}` };
      return;
    }
    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', data: '无法读取响应流' };
      return;
    }
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('event:') || !line.trim()) continue;
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          // 需要根据上一个 event: 行判断类型
          // 简化处理：解析 data 内容
          try {
            const parsed = JSON.parse(data);
            // 根据上下文判断类型
            if (typeof parsed === 'string') {
              yield { type: 'error', data: parsed };
            } else if (parsed.agentName !== undefined) {
              yield { type: 'sources', data: parsed };
            } else if (parsed.content !== undefined) {
              yield { type: 'done', data: parsed };
            }
          } catch {
            // 纯文本 token
            if (data && data !== '[DONE]') {
              yield { type: 'token', data };
            }
          }
        }
      }
    }
    // 处理剩余 buffer
    if (buffer.trim()) {
      const line = buffer.trim();
      if (line.startsWith('data:')) {
        const data = line.slice(5).trim();
        if (data && data !== '[DONE]' && !data.startsWith('{')) {
          yield { type: 'token', data };
        }
      }
    }
  },
};
