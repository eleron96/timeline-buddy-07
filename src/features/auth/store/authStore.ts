import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/shared/lib/supabaseClient';
import { usePlannerStore } from '@/features/planner/store/plannerStore';
import { useLocaleStore } from '@/shared/store/localeStore';
import type { Locale } from '@/shared/lib/locale';

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
  groupId: string | null;
}

interface WorkspaceMemberRow {
  workspace_id: string;
  role: WorkspaceRole;
  workspaces: { id: string; name: string } | null;
}

interface WorkspaceMemberProfileRow {
  user_id: string;
  role: WorkspaceRole;
  group_id: string | null;
  profiles: { email: string; display_name: string | null } | null;
}

export interface AdminUser {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  workspaceCount: number;
  workspaces: Array<{ id: string; name: string; role: WorkspaceRole }>;
}

export interface AdminWorkspace {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail: string | null;
  ownerDisplayName: string | null;
  membersCount: number;
  tasksCount: number;
  createdAt: string | null;
}

export interface SuperAdminUser {
  userId: string;
  email: string | null;
  displayName: string | null;
  createdAt: string | null;
}

export interface BackupEntry {
  name: string;
  type: 'daily' | 'manual' | 'pre-restore';
  createdAt: string;
  size: number;
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
  profileLocale: Locale | null;
  isSuperAdmin: boolean;
  superAdminLoading: boolean;
  adminUsers: AdminUser[];
  adminUsersLoading: boolean;
  adminUsersError: string | null;
  adminWorkspaces: AdminWorkspace[];
  adminWorkspacesLoading: boolean;
  adminWorkspacesError: string | null;
  superAdmins: SuperAdminUser[];
  superAdminsLoading: boolean;
  superAdminsError: string | null;
  backups: BackupEntry[];
  backupsLoading: boolean;
  backupsError: string | null;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  resolveSuperAdmin: (user: User | null) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithKeycloak: (redirectTo?: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  sendPasswordReset: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  fetchAdminUsers: (search?: string) => Promise<{ error?: string }>;
  createAdminUser: (payload: { email: string; displayName?: string }) => Promise<{ error?: string; warning?: string }>;
  updateAdminUser: (payload: { userId: string; email?: string; displayName?: string }) => Promise<{ error?: string }>;
  deleteAdminUser: (userId: string) => Promise<{ error?: string }>;
  fetchAdminWorkspaces: () => Promise<{ error?: string }>;
  updateAdminWorkspace: (workspaceId: string, name: string) => Promise<{ error?: string }>;
  deleteAdminWorkspace: (workspaceId: string) => Promise<{ error?: string }>;
  fetchSuperAdmins: () => Promise<{ error?: string }>;
  createSuperAdmin: (payload: { email: string; displayName?: string }) => Promise<{ error?: string; warning?: string }>;
  deleteSuperAdmin: (userId: string) => Promise<{ error?: string }>;
  syncKeycloakUsers: () => Promise<{ error?: string }>;
  fetchBackups: () => Promise<{ error?: string }>;
  createBackup: () => Promise<{ error?: string }>;
  restoreBackup: (name: string) => Promise<{ error?: string }>;
  uploadBackup: (file: File) => Promise<{ error?: string }>;
  downloadBackup: (name: string) => Promise<{ error?: string }>;
  renameBackup: (name: string, nextName: string) => Promise<{ error?: string }>;
  deleteBackup: (name: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  fetchWorkspaces: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  setCurrentWorkspaceId: (id: string | null) => void;
  createWorkspace: (name: string) => Promise<{ error?: string }>;
  deleteWorkspace: (workspaceId?: string) => Promise<{ error?: string }>;
  updateWorkspaceName: (workspaceId: string, name: string) => Promise<{ error?: string }>;
  fetchMembers: (workspaceId?: string) => Promise<void>;
  inviteMember: (email: string, role: WorkspaceRole, groupId?: string | null) => Promise<{ error?: string; actionLink?: string; warning?: string }>;
  updateMemberRole: (userId: string, role: WorkspaceRole) => Promise<{ error?: string }>;
  updateMemberGroup: (userId: string, groupId: string | null) => Promise<{ error?: string }>;
  removeMember: (userId: string) => Promise<{ error?: string }>;
  updateDisplayName: (displayName: string) => Promise<{ error?: string }>;
  updateLocale: (locale: Locale) => Promise<{ error?: string }>;
}

const getWorkspaceStorageKey = (userId: string) => `current-workspace-${userId}`;

const parseInvokeError = async (error: { message: string }, response?: Response) => {
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
  return message;
};

const isTransientSchemaAuthError = (message: string) => (
  message.toLowerCase().includes('database error querying schema')
);

const getBackupBaseUrl = () => {
  const base = import.meta.env.VITE_SUPABASE_URL;
  return base ? `${base}/backup` : '';
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const getOauth2ProxySignOutPath = () => {
  const signOutPath = (import.meta.env.VITE_OAUTH2_PROXY_SIGN_OUT_PATH ?? '/oauth2/sign_out').trim();
  if (!signOutPath) return '/oauth2/sign_out';
  const separator = signOutPath.includes('?') ? '&' : '?';
  return `${signOutPath}${separator}rd=${encodeURIComponent('/auth')}`;
};

const getKeycloakLogoutUrl = (postLogoutRedirectUri: string) => {
  const keycloakPublicUrl = trimTrailingSlash((import.meta.env.VITE_KEYCLOAK_PUBLIC_URL ?? '').trim());
  const keycloakRealm = (import.meta.env.VITE_KEYCLOAK_REALM ?? '').trim();
  const keycloakClientId = (import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? '').trim();

  if (!keycloakPublicUrl || !keycloakRealm || !keycloakClientId) {
    return null;
  }

  return (
    `${keycloakPublicUrl}/realms/${encodeURIComponent(keycloakRealm)}/protocol/openid-connect/logout`
    + `?client_id=${encodeURIComponent(keycloakClientId)}`
    + `&post_logout_redirect_uri=${encodeURIComponent(postLogoutRedirectUri)}`
  );
};

const parseBackupApiError = async (response: Response) => {
  let message = response.statusText || 'Backup request failed.';
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
      // Ignore parsing errors.
    }
  }
  return message;
};

const callBackupApi = async <T>(token: string | null | undefined, path: string, options?: RequestInit) => {
  if (!token) {
    return { error: 'Not authenticated.' };
  }
  const baseUrl = getBackupBaseUrl();
  if (!baseUrl) {
    return { error: 'Backup service is not configured.' };
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const message = await parseBackupApiError(response);
    return { error: message };
  }

  const data = await response.json().catch(() => ({}));
  return { data: data as T };
};

const invokeAdmin = async <T>(payload: Record<string, unknown>) => {
  const { data, error, response } = await supabase.functions.invoke('admin', { body: payload });
  if (error) {
    const message = await parseInvokeError(error, response);
    return { error: message };
  }
  if (data && typeof data === 'object' && typeof (data as { error?: string }).error === 'string') {
    return { error: (data as { error: string }).error };
  }
  return { data: data as T };
};

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
  profileLocale: null,
  isSuperAdmin: false,
  superAdminLoading: false,
  adminUsers: [],
  adminUsersLoading: false,
  adminUsersError: null,
  adminWorkspaces: [],
  adminWorkspacesLoading: false,
  adminWorkspacesError: null,
  superAdmins: [],
  superAdminsLoading: false,
  superAdminsError: null,
  backups: [],
  backupsLoading: false,
  backupsError: null,
  setSession: (session) => {
    const user = session?.user ?? null;
    set({
      session,
      user,
      profileDisplayName: null,
      profileLocale: null,
      isSuperAdmin: false,
      superAdminLoading: Boolean(user),
    });
  },
  setLoading: (loading) => set({ loading }),
  resolveSuperAdmin: async (user) => {
    if (!user) {
      set({ isSuperAdmin: false, superAdminLoading: false });
      return false;
    }
    set({ superAdminLoading: true });
    try {
      const { data, error } = await supabase
        .from('super_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      const isSuperAdmin = Boolean(data && !error);
      set({ isSuperAdmin, superAdminLoading: false });
      return isSuperAdmin;
    } catch (_error) {
      set({ isSuperAdmin: false, superAdminLoading: false });
      return false;
    }
  },
  signIn: async (email, password) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) return {};
      if (attempt === 0 && isTransientSchemaAuthError(error.message)) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        continue;
      }
      return { error: error.message };
    }
    return { error: 'Authentication failed.' };
  },
  signInWithKeycloak: async (redirectTo) => {
    const destination = redirectTo
      ?? (typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'keycloak',
      options: {
        ...(destination ? { redirectTo: destination } : {}),
        queryParams: { prompt: 'login' },
      },
    });
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
  fetchAdminUsers: async (search) => {
    set({ adminUsersLoading: true, adminUsersError: null });
    const { data, error } = await invokeAdmin<{ users: AdminUser[] }>({
      action: 'users.list',
      search: search?.trim(),
      page: 1,
      perPage: 1000,
      loadAll: true,
    });
    if (error) {
      set({ adminUsersLoading: false, adminUsersError: error });
      return { error };
    }
    set({
      adminUsers: data?.users ?? [],
      adminUsersLoading: false,
      adminUsersError: null,
    });
    return {};
  },
  createAdminUser: async (payload) => {
    const { data, error } = await invokeAdmin<{ warning?: string }>({
      action: 'users.create',
      email: payload.email,
      displayName: payload.displayName,
    });
    if (error) return { error };
    return { warning: data?.warning };
  },
  updateAdminUser: async (payload) => {
    const { error } = await invokeAdmin({
      action: 'users.update',
      userId: payload.userId,
      email: payload.email,
      displayName: payload.displayName,
    });
    if (error) return { error };
    return {};
  },
  deleteAdminUser: async (userId) => {
    const { error } = await invokeAdmin({
      action: 'users.delete',
      userId,
    });
    if (error) return { error };
    return {};
  },
  fetchAdminWorkspaces: async () => {
    set({ adminWorkspacesLoading: true, adminWorkspacesError: null });
    const { data, error } = await invokeAdmin<{ workspaces: AdminWorkspace[] }>({
      action: 'workspaces.list',
    });
    if (error) {
      set({ adminWorkspacesLoading: false, adminWorkspacesError: error });
      return { error };
    }
    set({
      adminWorkspaces: data?.workspaces ?? [],
      adminWorkspacesLoading: false,
      adminWorkspacesError: null,
    });
    return {};
  },
  updateAdminWorkspace: async (workspaceId, name) => {
    const { error } = await invokeAdmin({
      action: 'workspaces.update',
      workspaceId,
      name,
    });
    if (error) return { error };
    return {};
  },
  deleteAdminWorkspace: async (workspaceId) => {
    const { error } = await invokeAdmin({
      action: 'workspaces.delete',
      workspaceId,
    });
    if (error) return { error };
    return {};
  },
  fetchSuperAdmins: async () => {
    set({ superAdminsLoading: true, superAdminsError: null });
    const { data, error } = await invokeAdmin<{ superAdmins: SuperAdminUser[] }>({
      action: 'superAdmins.list',
    });
    if (error) {
      set({ superAdminsLoading: false, superAdminsError: error });
      return { error };
    }
    set({
      superAdmins: data?.superAdmins ?? [],
      superAdminsLoading: false,
      superAdminsError: null,
    });
    return {};
  },
  createSuperAdmin: async (payload) => {
    const { data, error } = await invokeAdmin<{ warning?: string }>({
      action: 'superAdmins.create',
      email: payload.email,
      displayName: payload.displayName,
    });
    if (error) return { error };
    return { warning: data?.warning };
  },
  deleteSuperAdmin: async (userId) => {
    const { error } = await invokeAdmin({
      action: 'superAdmins.delete',
      userId,
    });
    if (error) return { error };
    return {};
  },
  syncKeycloakUsers: async () => {
    const { error } = await invokeAdmin({
      action: 'keycloak.sync',
    });
    if (error) return { error };
    return {};
  },
  fetchBackups: async () => {
    set({ backupsLoading: true, backupsError: null });
    const { data, error } = await callBackupApi<{ backups: BackupEntry[] }>(
      get().session?.access_token,
      '/backups',
      { method: 'GET' },
    );
    if (error) {
      set({ backupsLoading: false, backupsError: error });
      return { error };
    }
    set({
      backups: data?.backups ?? [],
      backupsLoading: false,
      backupsError: null,
    });
    return {};
  },
  createBackup: async () => {
    const { data, error } = await callBackupApi<{ backup?: BackupEntry }>(
      get().session?.access_token,
      '/backups',
      { method: 'POST' },
    );
    if (error) return { error };
    if (data?.backup) {
      set((state) => ({
        backups: [data.backup, ...state.backups.filter((item) => item.name !== data.backup?.name)],
      }));
    }
    return {};
  },
  restoreBackup: async (name) => {
    const encoded = encodeURIComponent(name);
    const { error } = await callBackupApi(
      get().session?.access_token,
      `/backups/${encoded}/restore`,
      { method: 'POST' },
    );
    if (error) return { error };
    return {};
  },
  uploadBackup: async (file) => {
    const token = get().session?.access_token;
    if (!token) return { error: 'Not authenticated.' };
    const baseUrl = getBackupBaseUrl();
    if (!baseUrl) return { error: 'Backup service is not configured.' };

    const fileName = file.name.trim();
    if (!fileName) return { error: 'Invalid backup file name.' };

    const response = await fetch(`${baseUrl}/backups/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'X-Backup-Name': fileName,
      },
      body: file,
    });

    if (!response.ok) {
      const message = await parseBackupApiError(response);
      return { error: message };
    }

    const data = await response.json().catch(() => ({})) as { backup?: BackupEntry };
    if (data.backup) {
      set((state) => ({
        backups: [data.backup!, ...state.backups.filter((item) => item.name !== data.backup?.name)],
      }));
    }
    return {};
  },
  downloadBackup: async (name) => {
    const token = get().session?.access_token;
    if (!token) return { error: 'Not authenticated.' };
    const baseUrl = getBackupBaseUrl();
    if (!baseUrl) return { error: 'Backup service is not configured.' };
    if (typeof window === 'undefined') return { error: 'Download is only available in browser.' };

    const encoded = encodeURIComponent(name);
    const response = await fetch(`${baseUrl}/backups/${encoded}/download`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const message = await parseBackupApiError(response);
      return { error: message };
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
    return {};
  },
  renameBackup: async (name, nextName) => {
    const trimmed = nextName.trim();
    if (!trimmed) return { error: 'Backup name is required.' };

    const encoded = encodeURIComponent(name);
    const { data, error } = await callBackupApi<{ backup?: BackupEntry }>(
      get().session?.access_token,
      `/backups/${encoded}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ name: trimmed }),
      },
    );
    if (error) return { error };
    if (data?.backup) {
      set((state) => ({
        backups: [data.backup!, ...state.backups.filter((item) => item.name !== name && item.name !== data.backup?.name)],
      }));
    }
    return {};
  },
  deleteBackup: async (name) => {
    const encoded = encodeURIComponent(name);
    const { error } = await callBackupApi(
      get().session?.access_token,
      `/backups/${encoded}`,
      { method: 'DELETE' },
    );
    if (error) return { error };
    set((state) => ({
      backups: state.backups.filter((item) => item.name !== name),
    }));
    return {};
  },
  signOut: async () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('auth.skipAutoOAuthUntil');
      window.sessionStorage.setItem('auth.silentOAuth', '1');
    }
    await supabase.auth.signOut({ scope: 'local' });
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
      adminWorkspaces: [],
      adminWorkspacesLoading: false,
      adminWorkspacesError: null,
      superAdmins: [],
      superAdminsLoading: false,
      superAdminsError: null,
      backups: [],
      backupsLoading: false,
      backupsError: null,
      profileDisplayName: null,
      profileLocale: null,
      isSuperAdmin: false,
      superAdminLoading: false,
    });

    if (typeof window !== 'undefined') {
      const oauth2ProxyEnabled = import.meta.env.VITE_OAUTH2_PROXY_ENABLED === 'true';
      if (oauth2ProxyEnabled) {
        const proxySignOutPath = getOauth2ProxySignOutPath();
        const proxySignOutAbsoluteUrl = new URL(proxySignOutPath, window.location.origin).toString();
        const keycloakLogoutUrl = getKeycloakLogoutUrl(proxySignOutAbsoluteUrl);
        if (keycloakLogoutUrl) {
          window.location.replace(keycloakLogoutUrl);
          return;
        }
        window.location.replace(proxySignOutPath);
        return;
      }
      window.location.replace('/auth');
    }
  },
  fetchWorkspaces: async () => {
    const user = get().user;
    if (!user) return;
    if (get().isSuperAdmin) {
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
      .select('display_name, locale')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    const displayName = data?.display_name?.trim();
    const profileLocale = (typeof data?.locale === 'string' ? data.locale : null) as Locale | null;
    set({
      profileDisplayName: displayName ? displayName : null,
      profileLocale,
    });
    useLocaleStore.getState().setLocaleFromProfile(profileLocale);
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
      .select('user_id, role, group_id, profiles(email, display_name)')
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
      groupId: row.group_id ?? null,
    }));

    set({ members, membersLoading: false });
  },
  inviteMember: async (email, role, groupId = null) => {
    const workspaceId = get().currentWorkspaceId;
    if (!workspaceId) return { error: 'Workspace not selected.' };

    const { data, error, response } = await supabase.functions.invoke('invite', {
      body: { workspaceId, email, role, groupId },
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
    await usePlannerStore.getState().refreshMemberGroups();
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
  updateMemberGroup: async (userId, groupId) => {
    const workspaceId = get().currentWorkspaceId;
    if (!workspaceId) return { error: 'Workspace not selected.' };

    const { error } = await supabase
      .from('workspace_members')
      .update({ group_id: groupId })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);

    if (error) {
      return { error: error.message };
    }

    await get().fetchMembers(workspaceId);
    await usePlannerStore.getState().refreshMemberGroups();
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
    await usePlannerStore.getState().refreshMemberGroups();
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
  updateLocale: async (locale) => {
    const user = get().user;
    if (!user) return { error: 'You are not signed in.' };

    const { error } = await supabase
      .from('profiles')
      .update({ locale })
      .eq('id', user.id);

    if (error) {
      return { error: error.message };
    }

    set({ profileLocale: locale });
    return {};
  },
}));
