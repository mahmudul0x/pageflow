import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  picture?: string | null;
  facebook_id?: string | null;
}

interface AppState {
  user: AppUser | null;
  isAuthenticated: boolean;
  refreshToken: string | null;
  login: (payload: { user: AppUser; access: string; refresh: string }) => void;
  setUser: (user: AppUser) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      refreshToken: null,
      login: ({ user, access, refresh }) => {
        localStorage.setItem('pageflow_token', access);
        localStorage.setItem('pageflow_refresh', refresh);
        set({ user, refreshToken: refresh, isAuthenticated: true });
      },
      setUser: (user) => set({ user }),
      logout: () => {
        localStorage.removeItem('pageflow_token');
        localStorage.removeItem('pageflow_refresh');
        set({ user: null, refreshToken: null, isAuthenticated: false });
      },
    }),
    { name: 'pageflow-auth' }
  )
);
