import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthState {
  user: User | null;
  userRole: string | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setUserRole: (role: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      userRole: null,
      loading: true,
      
      setUser: (user) => set({ user }),
      
      setUserRole: (userRole) => set({ userRole }),
      
      setLoading: (loading) => set({ loading }),
      
      logout: async () => {
        await supabase.auth.signOut();
        set({ user: null, userRole: null });
      },
      
      checkAuth: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          set({ user: null, userRole: null, loading: false });
          return;
        }

        set({ user: session.user });

        // Get user role
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();

        set({ userRole: roles?.role || null, loading: false });
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        userRole: state.userRole
      }),
    }
  )
);

// Selectors for optimized re-renders
export const useUser = () => useAuthStore((state) => state.user);
export const useUserRole = () => useAuthStore((state) => state.userRole);
export const useAuthLoading = () => useAuthStore((state) => state.loading);
export const useAuthActions = () => useAuthStore((state) => ({
  setUser: state.setUser,
  setUserRole: state.setUserRole,
  setLoading: state.setLoading,
  logout: state.logout,
  checkAuth: state.checkAuth
}));