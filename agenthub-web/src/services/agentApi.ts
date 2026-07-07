import type { AgentCard, AgentComment, AgentDetail, AgentVersion, Category, CopyResponse, FeedResponse } from '../types';
import { request } from './base';

export const agentApi = {
  categories: () => request<Category[]>('/agent/categories'),
  list: (params: { categoryId?: number; keyword?: string; sortBy?: string; current?: number }) => {
    const query = new URLSearchParams();
    if (params.categoryId) query.set('categoryId', String(params.categoryId));
    if (params.keyword) query.set('keyword', params.keyword);
    if (params.sortBy) query.set('sortBy', params.sortBy);
    query.set('current', String(params.current || 1));
    return request<AgentCard[]>(`/agent/list?${query.toString()}`);
  },
  rank: (scope: string) => request<AgentCard[]>(`/agent/rank?scope=${encodeURIComponent(scope)}`),
  detail: (id: number) => request<AgentDetail>(`/agent/${id}`),
  versions: (id: number) => request<AgentVersion[]>(`/agent/${id}/versions`),
  semanticSearch: (query: string) => request<AgentCard[]>('/agent/search/semantic', {
    method: 'POST',
    body: JSON.stringify({ query, limit: 12 }),
  }),
  create: (payload: unknown) => request<number>('/agent', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: number, payload: unknown) => request<void>(`/agent/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  delete: (id: number) => request<void>(`/agent/${id}`, { method: 'DELETE' }),
  version: (id: number, payload: unknown) => request<number>(`/agent/${id}/versions`, { method: 'POST', body: JSON.stringify(payload) }),
  star: (id: number) => request<boolean>(`/agent/${id}/star`, { method: 'PUT' }),
  fork: (id: number, payload: unknown) => request<number>(`/agent/${id}/fork`, { method: 'POST', body: JSON.stringify(payload) }),
  copy: (id: number, versionId?: number) => {
    const suffix = versionId ? `?versionId=${versionId}` : '';
    return request<CopyResponse>(`/agent/${id}/copy${suffix}`, { method: 'POST' });
  },
  mine: () => request<AgentCard[]>('/agent/of/me'),
  stars: () => request<AgentCard[]>('/agent/of/star'),
  forks: () => request<AgentCard[]>('/agent/of/fork'),
  feed: () => request<FeedResponse>(`/agent/of/follow?lastId=${Date.now()}&offset=0`),
  comments: (agentId: number) => request<AgentComment[]>(`/agent/${agentId}/comments`),
  addComment: (agentId: number, content: string, parentId?: number) =>
    request<AgentComment>(`/agent/${agentId}/comments`, { method: 'POST', body: JSON.stringify({ content, parentId }) }),
  editComment: (commentId: number, content: string) =>
    request<void>(`/agent/comments/${commentId}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  deleteComment: (commentId: number) =>
    request<void>(`/agent/comments/${commentId}`, { method: 'DELETE' }),
  likeComment: (commentId: number) =>
    request<boolean>(`/agent/comments/${commentId}/like`, { method: 'PUT' }),
};
