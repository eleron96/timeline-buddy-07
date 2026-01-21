import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { usePlannerStore } from '@/store/plannerStore';
import { isReserveAdminEmail } from '@/lib/adminConfig';

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

export interface AdminUser {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
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
  profileDisplayName: string | null;
  isReserveAdmin: boolean;
  adminUsers: AdminUser[];
  adminUsersLoading: boolean;
  adminUsersError: string | null;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  sendPasswordReset: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  fetchAdminUsers: () => Promise<{ error?: string }>;
  resetUserPassword: (userId: string, password: string) => Promise<{ error?: string }>;
  deleteAdminUser: (userId: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  fetchWorkspaces: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  setCurrentWorkspaceId: (id: string | null) => void;
  createWorkspace: (name: string) => Promise<{ error?: string }>;
  deleteWorkspace: (workspaceId?: string) => Promise<{ error?: string }>;
  updateWorkspaceName: (workspaceId: string, name: string) => Promise<{ error?: string }>;
  fetchMembers: (workspaceId?: string) => Promise<void>;
  inviteMember: (email: string, role: WorkspaceRole) => Promise<{ error?: string; actionLink?: string; warning?: string }>;
  updateMemberRole: (userId: string, role: WorkspaceRole) => Promise<{ error?: string }>;
  removeMember: (userId: string) => Promise<{ error?: string }>;
  updateDisplayName: (displayName: string) => Promise<{ error?: string }>;
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
  profileDisplayName: null,
  isReserveAdmin: false,
  adminUsers: [],
  adminUsersLoading: false,
  adminUsersError: null,
  setSession: (session) => {
    const user = session?.user ?? null;
    set({
      session,
      user,
      profileDisplayName: null,
      isReserveAdmin: isReserveAdminEmail(user?.email ?? null),
    });
  },
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
  sendPasswordReset: async (email) => {
    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/auth`
      : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return { error: error.message };
    return {};
  },
  updatePassword: async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    return {};
  },
  fetchAdminUsers: async () => {
    set({ adminUsersLoading: true, adminUsersError: null });
    const { data, error, response } = await supabase.functions.invoke('admin-users', {
      body: { page: 1, perPage: 200 },
    });

    if (error) {
      let message = error.message;
      if (response) {
        try {
          const body = await response.clone().json();
          if (body && typeof body === 'object' && typeof (body as { error?: string }).error === 'string') {
            message = (body as { error: string }).error;
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
      set({ adminUsersLoading: false, adminUsersError: message });
      return { error: message };
    }

    if (data?.error) {
      set({ adminUsersLoading: false, adminUsersError: data.error });
      return { error: data.error };
    }

    set({
      adminUsers: (data?.users ?? []) as AdminUser[],
      adminUsersLoading: false,
      adminUsersError: null,
    });
    return {};
  },
  resetUserPassword: async (userId, password) => {
    const { data, error, response } = await supabase.functions.invoke('admin-reset', {
      body: { userId, password },
    });

    if (error) {
      let message = error.message;
      if (response) {
        try {
          const body = await response.clone().json();
          if (body && typeof body === 'object' && typeof (body as { error?: string }).error === 'string') {
            message = (body as { error: string }).error;
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
      return { error: message };
    }

    if (data?.error) {
      return { error: data.error };
    }

    return {};
  },
  deleteAdminUser: async (userId) => {
    const { data, error, response } = await supabase.functions.invoke('admin-delete', {
      body: { userId },
    });

    if (error) {
      let message = error.message;
      if (response) {
        try {
          const body = await response.clone().json();
          if (body && typeof body === 'object' && typeof (body as { error?: string }).error === 'string') {
            message = (body as { error: string }).error;
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
      return { error: message };
    }

    if (data?.error) {
      return { error: data.error };
    }

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
      adminUsers: [],
      adminUsersLoading: false,
      adminUsersError: null,
      profileDisplayName: null,
      isReserveAdmin: false,
    });
  },
  fetchWorkspaces: async () => {
    const user = get().user;
    if (!user) return;
    if (get().isReserveAdmin) {
      set({
        workspaces: [],
        currentWorkspaceId: null,
        currentWorkspaceRole: null,
      });
      return;
    }

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
  fetchProfile: async () => {
    const user = get().user;
    if (!user) {
      set({ profileDisplayName: null });
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    const displayName = data?.display_name?.trim();
    set({ profileDisplayName: displayName ? displayName : null });
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
  updateWorkspaceName: async (workspaceId, name) => {
    const trimmedName = name.trim();
    if (!trimmedName) return { error: 'Workspace name cannot be empty.' };

    const { error } = await supabase
      .from('workspaces')
      .update({ name: trimmedName })
      .eq('id', workspaceId);

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
  updateDisplayName: async (displayName) => {
    const user = get().user;
    if (!user) return { error: 'You are not signed in.' };

    const nextName = displayName.trim();
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: nextName.length > 0 ? nextName : null })
      .eq('id', user.id);

    if (error) {
      return { error: error.message };
    }

    const nextDisplayName = nextName.length > 0 ? nextName : null;
    set({ profileDisplayName: nextDisplayName });

    const workspaceId = get().currentWorkspaceId;
    if (workspaceId) {
      await get().fetchMembers(workspaceId);
    }
    await usePlannerStore.getState().refreshAssignees();
    return {};
  },
}));
