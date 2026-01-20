import React, { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import { usePlannerStore } from '@/store/plannerStore';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const setSession = useAuthStore((state) => state.setSession);
  const setLoading = useAuthStore((state) => state.setLoading);
  const fetchWorkspaces = useAuthStore((state) => state.fetchWorkspaces);
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const resetPlanner = usePlannerStore((state) => state.reset);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) {
        fetchWorkspaces();
        fetchProfile();
      } else {
        resetPlanner();
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      if (session?.user) {
        fetchWorkspaces();
        fetchProfile();
      } else {
        resetPlanner();
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchWorkspaces, resetPlanner, setLoading, setSession]);

  return <>{children}</>;
};
