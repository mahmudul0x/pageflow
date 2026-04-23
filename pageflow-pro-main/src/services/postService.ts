import type { AxiosProgressEvent } from 'axios';
import { api } from '@/lib/api';
import type { Post } from '@/lib/mockData';

type ApiPage = {
  id: number | string;
  name: string;
};

type ApiPostResult = {
  page: string;
  page_id?: string | null;
  success: boolean;
  fb_post_id?: string | null;
  error?: string | null;
};

type ApiPost = {
  id: number | string;
  pages?: ApiPage[];
  content?: string;
  full_content?: string;
  media_url?: string | null;
  media_type?: string | null;
  status: Post['status'];
  created_at: string;
  scheduled_time?: string | null;
  published_at?: string | null;
  hidden?: boolean;
  results?: ApiPostResult[];
};

const toPost = (post: ApiPost): Post => ({
  id: String(post.id),
  pageIds: Array.isArray(post.pages) ? post.pages.map((page) => String(page.id)) : [],
  pageNames: Array.isArray(post.pages) ? post.pages.map((page) => page.name) : [],
  content: post.full_content || post.content || '',
  mediaUrl: post.media_url || undefined,
  mediaType: post.media_type || undefined,
  status: post.status,
  createdAt: post.created_at,
  scheduledFor: post.scheduled_time || undefined,
  publishedAt: post.published_at || undefined,
  hidden: Boolean(post.hidden),
  publishResults: Array.isArray(post.results)
    ? post.results.map((result) => ({
        page: result.page,
        pageFbId: result.page_id || undefined,
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

export interface PublishProgressResponse {
  session_id: string;
  progress: number;
  stage: string;
  message: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface PublishPayload {
  page_ids: string[];
  content: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  file?: File;
  publish_session_id?: string;
}

export interface DraftPayload {
  page_ids?: string[];
  content: string;
  media_url?: string;
  media_type?: 'image' | 'video';
}

export interface PostListFilters {
  status?: string;
  page_id?: string;
  page_ids?: string[];
  search?: string;
  date_from?: string;
  date_to?: string;
  hidden?: boolean;
  include_hidden?: boolean;
}

export interface UpdatePostPayload {
  content?: string;
  media_url?: string;
  scheduled_time?: string;
  page_ids?: string[];
  hidden?: boolean;
}

export interface ExistingPostActionResponse {
  message: string;
  post: Post;
}

export const postService = {
  list: async (filters?: string | PostListFilters): Promise<Post[]> => {
    const params =
      typeof filters === 'string'
        ? { status: filters }
        : Object.fromEntries(
            Object.entries(filters || {}).filter(([, value]) => {
              if (Array.isArray(value)) return value.length > 0;
              return value !== undefined && value !== null && value !== '';
            })
          );

    const { data } = await api.get('/posts/', { params });
    return Array.isArray(data) ? data.map((post) => toPost(post as ApiPost)) : [];
  },
  saveDraft: async (payload: DraftPayload): Promise<Post> => {
    const { data } = await api.post('/posts/draft/', payload);
    return toPost(data?.post as ApiPost);
  },
  publish: async (
    payload: PublishPayload,
    options?: { onUploadProgress?: (event: AxiosProgressEvent) => void }
  ): Promise<PublishResponse> => {
    if (payload.file) {
      const formData = new FormData();
      payload.page_ids.forEach((pageId) => formData.append('page_ids', pageId));
      formData.append('content', payload.content);
      if (payload.media_type) formData.append('media_type', payload.media_type);
      if (payload.publish_session_id) formData.append('publish_session_id', payload.publish_session_id);
      formData.append('file', payload.file);
      return (
        await api.post('/posts/publish/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: options?.onUploadProgress,
        })
      ).data;
    }

    return (
      await api.post('/posts/publish/', payload, {
        onUploadProgress: options?.onUploadProgress,
      })
    ).data;
  },
  getPublishProgress: async (sessionId: string): Promise<PublishProgressResponse> => {
    const { data } = await api.get(`/posts/publish-progress/${sessionId}/`);
    return data;
  },
  schedule: async (payload: { page_ids: string[]; content: string; media_url?: string; media_type?: 'image' | 'video'; scheduled_time: string }) => {
    return (await api.post('/posts/schedule/', payload)).data;
  },
  update: async (id: string, payload: UpdatePostPayload): Promise<Post> => {
    const { data } = await api.patch(`/posts/${id}/`, payload);
    return toPost(data as ApiPost);
  },
  publishExisting: async (id: string) => {
    const { data } = await api.post(`/posts/${id}/publish/`);
    return {
      ...data,
      post: toPost(data?.post as ApiPost),
    };
  },
  scheduleExisting: async (id: string, scheduled_time: string): Promise<ExistingPostActionResponse> => {
    const { data } = await api.post(`/posts/${id}/schedule/`, { scheduled_time });
    return {
      ...data,
      post: toPost(data?.post as ApiPost),
    };
  },
  remove: async (id: string) => {
    return (await api.delete(`/posts/${id}/`)).data;
  },
};
