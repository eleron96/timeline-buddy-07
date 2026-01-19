import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { usePlannerStore } from '@/store/plannerStore';

export type WorkspaceRole = 'viewer' | 'editor' | 'admin';

interface WorkspaceSummary {
  id: string;
  name: string;
  role: WorkspaceRole;
}

interface WorkspaceMember {
  userId: string;
  email: string;
  displayName: string | null;
  role: WorkspaceRole;
}

interface WorkspaceMemberRow {
  workspace_id: string;
  role: WorkspaceRole;
  workspaces: { id: string; name: string } | null;
}

interface WorkspaceMemberProfileRow {
  user_id: string;
  role: WorkspaceRole;
  profiles: { email: string; display_name: string | null } | null;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  workspaces: WorkspaceSummary[];
  currentWorkspaceId: string | null;
  currentWorkspaceRole: WorkspaceRole | null;
  members: WorkspaceMember[];
  membersLoading: boolean;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  fetchWorkspaces: () => Promise<void>;
  setCurrentWorkspaceId: (id: string | null) => void;
  createWorkspace: (name: string) => Promise<{ error?: string }>;
  deleteWorkspace: (workspaceId?: string) => Promise<{ error?: string }>;
  fetchMembers: (workspaceId?: string) => Promise<void>;
  inviteMember: (email: string, role: WorkspaceRole) => Promise<{ error?: string; actionLink?: string; warning?: string }>;
  updateMemberRole: (userId: string, role: WorkspaceRole) => Promise<{ error?: string }>;
  removeMember: (userId: string) => Promise<{ error?: string }>;
}

const getWorkspaceStorageKey = (userId: string) => `current-workspace-${userId}`;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  workspaces: [],
  currentWorkspaceId: null,
  currentWorkspaceRole: null,
  members: [],
  membersLoading: false,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setLoading: (loading) => set({ loading }),
  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  },
  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return {};
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({
      user: null,
      session: null,
      workspaces: [],
      currentWorkspaceId: null,
      currentWorkspaceRole: null,
      members: [],
    });
  },
  fetchWorkspaces: async () => {
    const user = get().user;
    if (!user) return;

    const { data, error } = await supabase
      .from('workspace_members')
      .select('workspace_id, role, workspaces(id, name)')
      .eq('user_id', user.id);

    if (error) {
      console.error(error);
      return;
    }

    const rows = (data ?? []) as WorkspaceMemberRow[];
    const workspaces: WorkspaceSummary[] = rows.map((row) => ({
      id: row.workspaces?.id ?? row.workspace_id,
      name: row.workspaces?.name ?? 'Workspace',
      role: row.role as WorkspaceRole,
    })).filter((workspace) => Boolean(workspace.id));

    if (workspaces.length === 0) {
      const { error: createError } = await get().createWorkspace('My Workspace');
      if (createError) {
        console.error(createError);
        return;
      }
      return;
    }

    const storageKey = getWorkspaceStorageKey(user.id);
    const storedId = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
    const nextId = storedId && workspaces.some((workspace) => workspace.id === storedId)
      ? storedId
      : workspaces[0]?.id ?? null;

    const nextRole = workspaces.find((workspace) => workspace.id === nextId)?.role ?? null;

    set({
      workspaces,
      currentWorkspaceId: nextId,
      currentWorkspaceRole: nextRole,
    });
  },
  setCurrentWorkspaceId: (id) => {
    const user = get().user;
    if (user && typeof window !== 'undefined') {
      const storageKey = getWorkspaceStorageKey(user.id);
      if (id) {
        window.localStorage.setItem(storageKey, id);
      } else {
        window.localStorage.removeItem(storageKey);
      }
    }
    const role = get().workspaces.find((workspace) => workspace.id === id)?.role ?? null;
    set({ currentWorkspaceId: id, currentWorkspaceRole: role });
  },
  createWorkspace: async (name) => {
    const { data, error } = await supabase.rpc('create_workspace', { workspace_name: name });
    if (error) return { error: error.message };
    await get().fetchWorkspaces();
    const createdId = typeof data === 'string' ? data : null;
    if (createdId) {
      get().setCurrentWorkspaceId(createdId);
    }
    return {};
  },
  deleteWorkspace: async (workspaceId) => {
    const targetWorkspaceId = workspaceId ?? get().currentWorkspaceId;
    if (!targetWorkspaceId) return { error: 'Workspace not selected.' };

    const { error } = await supabase.rpc('delete_workspace', { workspace_id: targetWorkspaceId });
    if (error) return { error: error.message };

    await get().fetchWorkspaces();
    return {};
  },
  fetchMembers: async (workspaceId) => {
    const targetWorkspaceId = workspaceId ?? get().currentWorkspaceId;
    if (!targetWorkspaceId) return;
    set({ membersLoading: true });

    const { data, error } = await supabase
      .from('workspace_members')
      .select('user_id, role, profiles(email, display_name)')
      .eq('workspace_id', targetWorkspaceId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error(error);
      set({ membersLoading: false });
      return;
    }

    const rows = (data ?? []) as WorkspaceMemberProfileRow[];
    const members: WorkspaceMember[] = rows.map((row) => ({
      userId: row.user_id,
      role: row.role as WorkspaceRole,
      email: row.profiles?.email ?? 'unknown',
      displayName: row.profiles?.display_name ?? null,
    }));

    set({ members, membersLoading: false });
  },
  inviteMember: async (email, role) => {
    const workspaceId = get().currentWorkspaceId;
    if (!workspaceId) return { error: 'Workspace not selected.' };

    const { data, error, response } = await supabase.functions.invoke('invite', {
      body: { workspaceId, email, role },
    });

    if (error) {
      let message = error.message;
      let actionLink: string | undefined;
      let warning: string | undefined;
      if (response) {
        try {
          const body = await response.clone().json();
          if (body && typeof body === 'object') {
            if (typeof (body as { error?: string }).error === 'string') {
              message = (body as { error: string }).error;
            }
            if (typeof (body as { actionLink?: string }).actionLink === 'string') {
              actionLink = (body as { actionLink: string }).actionLink;
            }
            if (typeof (body as { warning?: string }).warning === 'string') {
              warning = (body as { warning: string }).warning;
            }
          }
        } catch (_error) {
          try {
            const text = await response.clone().text();
            if (text) message = text;
          } catch (_innerError) {
            // Ignore response parsing errors and keep the original message.
          }
        }
      }
      return { error: message, actionLink, warning };
    }

    if (data?.error) {
      return { error: data.error, actionLink: data.actionLink, warning: data.warning };
    }

    await get().fetchMembers(workspaceId);
    await usePlannerStore.getState().refreshAssignees();
    return { actionLink: data?.actionLink, warning: data?.warning };
  },
  updateMemberRole: async (userId, role) => {
    const workspaceId = get().currentWorkspaceId;
    if (!workspaceId) return { error: 'Workspace not selected.' };

    const { error } = await supabase
      .from('workspace_members')
      .update({ role })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);

    if (error) {
      return { error: error.message };
    }

    await get().fetchMembers(workspaceId);
    await usePlannerStore.getState().refreshAssignees();
    return {};
  },
  removeMember: async (userId) => {
    const workspaceId = get().currentWorkspaceId;
    if (!workspaceId) return { error: 'Workspace not selected.' };
    const currentUserId = get().user?.id;
    if (currentUserId && currentUserId === userId) {
      return { error: 'You cannot remove yourself.' };
    }

    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);

    if (error) {
      return { error: error.message };
    }

    await get().fetchMembers(workspaceId);
    return {};
  },
}));
