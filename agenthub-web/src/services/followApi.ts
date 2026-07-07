import type { UserLite } from '../types';
import { request } from './base';

export const followApi = {
  follow: (userId: number, isFollow: boolean) => request<void>(`/follow/${userId}/${isFollow}`, { method: 'PUT' }),
  isFollow: (userId: number) => request<boolean>(`/follow/or/not/${userId}`),
  followCommons: (userId: number) => request<UserLite[]>(`/follow/common/${userId}`),
};
