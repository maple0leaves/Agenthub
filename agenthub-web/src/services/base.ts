import type { Result } from '../types';

const API_BASE = '/api';
const TOKEN_KEY = 'agenthub-token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token.trim());
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const maxAttempts = method === 'GET' ? 2 : 1;
  const retryDelayMs = 400;
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('authorization', token);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
      const payload = (await response.json()) as Result<T>;
      if (!response.ok || payload.success === false) {
        throw new Error(payload.errorMsg || `Request failed: ${response.status}`);
      }
      return payload.data as T;
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;
      if (isLastAttempt) {
        if (error instanceof TypeError) {
          throw new Error('服务暂未就绪，请稍后刷新重试');
        }
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  throw new Error('服务暂未就绪，请稍后刷新重试');
}
