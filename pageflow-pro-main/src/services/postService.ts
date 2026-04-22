import { api } from '@/lib/api';
import type { Post } from '@/lib/mockData';

const toPost = (post: any): Post => ({
  id: String(post.id),
  pageIds: Array.isArray(post.pages) ? post.pages.map((page: any) => String(page.id)) : [],
  pageNames: Array.isArray(post.pages) ? post.pages.map((page: any) => page.name) : [],
  content: post.full_content || post.content || '',
  mediaUrl: post.media_url || undefined,
  status: post.status,
  createdAt: post.created_at,
  scheduledFor: post.scheduled_time || undefined,
  publishResults: Array.isArray(post.results)
    ? post.results.map((result: any) => ({
        page: result.page,
        success: Boolean(result.success),
        fbPostId: result.fb_post_id || undefined,
        error: result.error || undefined,
      }))
    : undefined,
});

export interface PublishResult {
  page: string;
  success: boolean;
  fb_post_id?: string | null;
  error?: string | null;
}

export interface PublishResponse {
  message: string;
  post_id: number;
  success_count: number;
  failed_count: number;
  results: PublishResult[];
}

export interface PublishPayload {
  page_ids: string[];
  content: string;
  media_url?: string;
  media_type?: string;
  file?: File;
}

export const postService = {
  list: async (): Promise<Post[]> => {
    const { data } = await api.get('/posts/');
    return Array.isArray(data) ? data.map(toPost) : [];
  },
  publish: async (payload: PublishPayload): Promise<PublishResponse> => {
    if (payload.file) {
      const formData = new FormData();
      payload.page_ids.forEach((pageId) => formData.append('page_ids', pageId));
      formData.append('content', payload.content);
      if (payload.media_type) formData.append('media_type', payload.media_type);
      formData.append('file', payload.file);
      return (await api.post('/posts/publish/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })).data;
    }

    return (await api.post('/posts/publish/', payload)).data;
  },
  schedule: async (payload: { page_ids: string[]; content: string; media_url?: string; scheduled_time: string }) => {
    return (await api.post('/posts/schedule/', payload)).data;
  },
  remove: async (id: string) => {
    return (await api.delete(`/posts/${id}/`)).data;
  },
};
