import { api } from '@/lib/api';

export const analyticsService = {
  get: async (params: { page_id?: string; date_range?: string }) => {
    const { data } = await api.get('/analytics/', { params });
    return {
      totalReach: data?.metrics?.total_reach ?? 0,
      impressions: data?.metrics?.impressions ?? 0,
      pageLikes: data?.metrics?.page_likes ?? 0,
      engagementRate: data?.metrics?.engagement_rate ?? 0,
      reachOverTime: Array.isArray(data?.chart_data)
        ? data.chart_data.map((item: any) => ({
            date: item.end_time ? new Date(item.end_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '',
            reach: item.value ?? 0,
            impressions: item.value ?? 0,
          }))
        : [],
      postPerformance: [],
    };
  },
};
