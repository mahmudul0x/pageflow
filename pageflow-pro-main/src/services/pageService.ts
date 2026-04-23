import { api } from '@/lib/api';
import type { FBPage } from '@/lib/mockData';

const toPage = (page: any): FBPage => ({
  id: String(page.id),
  name: page.name,
  category: page.category || 'Facebook Page',
  followers: page.followers_count ?? 0,
  avatar: page.name?.charAt(0)?.toUpperCase() || 'P',
  enabled: Boolean(page.is_active),
});

export const pageService = {
  list: async (): Promise<FBPage[]> => {
    const { data } = await api.get('/pages/');
    return Array.isArray(data) ? data.map(toPage) : [];
  },
  sync: async (): Promise<FBPage[]> => {
    const { data } = await api.post('/pages/sync/');
    const pages = Array.isArray(data?.pages) ? data.pages : data;
    return Array.isArray(pages) ? pages.map(toPage) : [];
  },
  toggle: async (id: string): Promise<{ is_active: boolean }> => {
    const { data } = await api.patch(`/pages/${id}/toggle/`);
    return {
      is_active: Boolean(data?.is_active),
    };
  },
};
