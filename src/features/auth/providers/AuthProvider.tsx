import React, { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/shared/lib/supabaseClient';
import { useAuthStore } from '@/features/auth/store/authStore';
import { usePlannerStore } from '@/features/planner/store/plannerStore';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const setSession = useAuthStore((state) => state.setSession);
  const setLoading = useAuthStore((state) => state.setLoading);
  const resolveSuperAdmin = useAuthStore((state) => state.resolveSuperAdmin);
  const fetchWorkspaces = useAuthStore((state) => state.fetchWorkspaces);
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const resetPlanner = usePlannerStore((state) => state.reset);

  useEffect(() => {
    let active = true;

    const handleSession = async (session: Session | null) => {
      if (!active) return;
      setSession(session);
      if (session?.user) {
        try {
          const isSuperAdmin = await resolveSuperAdmin(session.user);
          if (!active) return;
          if (!isSuperAdmin) {
            fetchWorkspaces();
          }
          fetchProfile();
        } catch (_error) {
          if (!active) return;
          fetchWorkspaces();
          fetchProfile();
        }
      } else {
        resetPlanner();
      }
      setLoading(false);
    };

    setLoading(true);
    supabase.auth.getSession().then(({ data }) => {
      void handleSession(data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void handleSession(session);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchWorkspaces, resetPlanner, resolveSuperAdmin, setLoading, setSession]);

  return <>{children}</>;
};
