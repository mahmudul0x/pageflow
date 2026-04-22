import { api } from '@/lib/api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  picture?: string | null;
  facebook_id?: string | null;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

export const authService = {
  register: async (payload: { name: string; email: string; password: string }): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/register/', payload);
    return data;
  },

  login: async (payload: { email: string; password: string }): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/login/', payload);
    return data;
  },

  getFacebookUrl: async (mode: 'pages' | 'posting' = 'pages'): Promise<{ auth_url: string }> => {
    const { data } = await api.get('/auth/facebook-url/', { params: { mode } });
    return data;
  },

  facebookCallback: async (code: string): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/facebook-callback/', { code });
    return data;
  },

  logout: async () => {
    const refresh = localStorage.getItem('pageflow_refresh');
    try {
      await api.post('/auth/logout/', { refresh });
    } catch {}
  },

  me: async (): Promise<AuthUser> => {
    const { data } = await api.get('/auth/me/');
    return data;
  },
};
