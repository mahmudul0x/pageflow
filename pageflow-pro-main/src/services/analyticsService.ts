import { api } from '@/lib/api';

export const analyticsService = {
  get: async (params: { page_id?: string; date_range?: string }) => {
    const { data } = await api.get('/analytics/', { params });
    return {
      pageName: data?.page_name ?? 'Analytics',
      error: data?.error ?? null,
      warning: data?.warning ?? null,
      totalReach: data?.metrics?.total_reach ?? 0,
      impressions: data?.metrics?.impressions ?? 0,
      pageLikes: data?.metrics?.page_likes ?? 0,
      engagementRate: data?.metrics?.engagement_rate ?? 0,
      reachOverTime: Array.isArray(data?.chart_data)
        ? data.chart_data.map((item: any) => ({
            date: item.end_time ? new Date(item.end_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '',
            reach: item.reach ?? item.value ?? 0,
            impressions: item.impressions ?? 0,
          }))
        : [],
      postPerformance: Array.isArray(data?.post_performance)
        ? data.post_performance.map((item: any) => ({
            name: item.name ?? 'Untitled post',
            reach: item.reach ?? 0,
            engagement: item.engagement ?? 0,
            engagementRate: item.engagement_rate ?? 0,
            pages: Array.isArray(item.pages) ? item.pages : [],
            content: item.content ?? item.name ?? 'Untitled post',
            publishedAt: item.published_at ?? null,
            postId: item.post_id ? String(item.post_id) : undefined,
          }))
        : [],
      individualPostAnalytics: Array.isArray(data?.individual_post_analytics)
        ? data.individual_post_analytics.map((item: any) => ({
            postId: item.post_id ? String(item.post_id) : undefined,
            name: item.name ?? 'Untitled post',
            content: item.content ?? item.name ?? 'Untitled post',
            mediaUrl: item.media_url ?? undefined,
            status: item.status ?? 'published',
            mediaType: item.media_type ?? 'text',
            page: item.page ?? 'Unknown page',
            pageId: item.page_id ? String(item.page_id) : undefined,
            fbPostId: item.fb_post_id ?? undefined,
            publishedAt: item.published_at ?? null,
            reach: item.reach ?? 0,
            engagement: item.engagement ?? 0,
            engagementRate: item.engagement_rate ?? 0,
          }))
        : [],
    };
  },
};
