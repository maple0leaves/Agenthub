import type { BlogComment, BlogFeedResponse, BlogPost, UserLite } from '../types';
import { request } from './base';

export const blogApi = {
  blogHot: (current = 1) => request<BlogPost[]>(`/blog/hot?current=${current}`),
  blogFollow: () => request<BlogFeedResponse>(`/blog/of/follow?lastId=${Date.now()}&offset=0`),
  blogMine: (current = 1) => request<BlogPost[]>(`/blog/of/me?current=${current}`),
  blogById: (id: number) => request<BlogPost>(`/blog/${id}`),
  blogLikes: (id: number) => request<UserLite[]>(`/blog/likes/${id}`),
  blogByUser: (userId: number, current = 1) => request<BlogPost[]>(`/blog/of/user?id=${userId}&current=${current}`),
  createBlog: (payload: { title: string; content: string; images?: string; shopId?: number /* agentId */ }) => request<number>('/blog', {
    method: 'POST',
    body: JSON.stringify({ ...payload, images: payload.images AgentHub '' }),
  }),
  likeBlog: (id: number) => request<void>(`/blog/like/${id}`, { method: 'PUT' }),
  deleteBlog: (id: number) => request<void>(`/blog/${id}`, { method: 'DELETE' }),
  blogComments: (blogId: number) => request<BlogComment[]>(`/blog-comments/${blogId}`),
  addBlogComment: (blogId: number, content: string) => request<BlogComment>(`/blog-comments/${blogId}`, { method: 'POST', body: JSON.stringify({ content }) }),
  deleteBlogComment: (commentId: number) => request<void>(`/blog-comments/${commentId}`, { method: 'DELETE' }),
  likeBlogComment: (commentId: number) => request<boolean>(`/blog-comments/${commentId}/like`, { method: 'PUT' }),
};
