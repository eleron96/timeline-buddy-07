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
    let lastSessionKey: string | null = null;

    const sessionKey = (session: Session | null) => {
      if (!session?.user) return 'signed-out';
      return session.access_token
        ? `${session.user.id}:${session.access_token}`
        : session.user.id;
    };

    const handleSession = async (session: Session | null, force = false) => {
      if (!active) return;
      const nextSessionKey = sessionKey(session);
      if (!force && lastSessionKey === nextSessionKey) {
        return;
      }
      lastSessionKey = nextSessionKey;

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        return;
      }
      void handleSession(session);
    });
    supabase.auth.getSession().then(({ data }) => {
      void handleSession(data.session, true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchWorkspaces, resetPlanner, resolveSuperAdmin, setLoading, setSession]);

  return <>{children}</>;
};
