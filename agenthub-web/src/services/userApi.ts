import type { UserInfo, UserLite, UserProfile } from '../types';
import { request } from './base';

export const userApi = {
  registerByPassword: (phone: string, password: string) => request<string>('/user/register', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  }),
  loginByPassword: (phone: string, password: string) => request<string>('/user/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  }),
  logout: () => request<void>('/user/logout', { method: 'POST' }),
  me: () => request<UserProfile>('/user/me'),
  updateProfile: (nickName: string) => request<UserProfile>('/user/profile', {
    method: 'PUT',
    body: JSON.stringify({ nickName }),
  }),
  uploadAvatar: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const token = localStorage.getItem('agenthub-token') || '';
    const headers = new Headers();
    if (token) headers.set('authorization', token);
    const response = await fetch('/api/user/avatar', { method: 'POST', body: form, headers });
    const payload = await response.json() as { success: boolean; data?: UserProfile; errorMsg?: string };
    if (!response.ok || payload.success === false) {
      throw new Error(payload.errorMsg || '上传失败');
    }
    return payload.data!;
  },
  sign: () => request<void>('/user/sign', { method: 'POST' }),
  signCount: () => request<number>('/user/sign/count'),
  userById: (id: number) => request<UserLite>(`/user/${id}`),
  userInfo: (id: number) => request<UserInfo>(`/user/info/${id}`),
};
