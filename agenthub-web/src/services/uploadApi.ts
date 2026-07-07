import { request } from './base';

export const uploadApi = {
  uploadBlogImage: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<string>('/upload/blog', { method: 'POST', body: form });
  },
  deleteBlogImage: (name: string) => request<void>(`/upload/blog/delete?name=${encodeURIComponent(name)}`),
};
