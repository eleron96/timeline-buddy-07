import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  useAuthStore,
  AdminUser,
  AdminWorkspace,
  SuperAdminUser,
  BackupEntry,
} from '@/features/auth/store/authStore';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { t } from '@lingui/macro';
import { useLocaleStore } from '@/shared/store/localeStore';
import type { Locale } from '@/shared/lib/locale';

const formatDate = (value: string | null | undefined, locale: Locale) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const language = locale === 'ru' ? 'ru-RU' : 'en-US';
  return date.toLocaleString(language);
};

const generatePassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const length = 10;
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
};

const formatWorkspaceSummary = (workspaces: AdminUser['workspaces']) => {
  if (workspaces.length === 0) return '—';
  const preview = workspaces.slice(0, 3).map((workspace) => `${workspace.name} (${workspace.role})`);
  const suffix = workspaces.length > 3 ? ` +${workspaces.length - 3}` : '';
  return `${preview.join(', ')}${suffix}`;
};

const formatBytes = (value?: number) => {
  if (!value && value !== 0) return '—';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const formatBackupType = (type: BackupEntry['type']) => {
  if (type === 'daily') return 'Daily';
  if (type === 'pre-restore') return 'Pre-restore';
  return 'Manual';
};

const AdminUsersPage: React.FC = () => {
  const {
    user,
    isSuperAdmin,
    adminUsers,
    adminUsersLoading,
    adminUsersError,
    fetchAdminUsers,
    createAdminUser,
    updateAdminUser,
    resetUserPassword,
    deleteAdminUser,
    adminWorkspaces,
    adminWorkspacesLoading,
    adminWorkspacesError,
    fetchAdminWorkspaces,
    updateAdminWorkspace,
    deleteAdminWorkspace,
    superAdmins,
    superAdminsLoading,
    superAdminsError,
    fetchSuperAdmins,
    createSuperAdmin,
    deleteSuperAdmin,
    backups,
    backupsLoading,
    backupsError,
    fetchBackups,
    createBackup,
    restoreBackup,
    uploadBackup,
    downloadBackup,
    renameBackup,
    deleteBackup,
    signOut,
  } = useAuthStore();
  const locale = useLocaleStore((state) => state.locale);

  const [tab, setTab] = useState<'users' | 'workspaces' | 'superAdmins' | 'backups'>('users');
  const [userSearch, setUserSearch] = useState('');
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [workspacesDialogOpen, setWorkspacesDialogOpen] = useState(false);
  const [workspacesTarget, setWorkspacesTarget] = useState<AdminUser | null>(null);

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userDialogMode, setUserDialogMode] = useState<'create' | 'edit'>('create');
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormDisplayName, setUserFormDisplayName] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormError, setUserFormError] = useState('');
  const [userFormSubmitting, setUserFormSubmitting] = useState(false);
  const [userFormTarget, setUserFormTarget] = useState<AdminUser | null>(null);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [lastResetPasswords, setLastResetPasswords] = useState<Record<string, string>>({});
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [workspaceEditOpen, setWorkspaceEditOpen] = useState(false);
  const [workspaceEditTarget, setWorkspaceEditTarget] = useState<AdminWorkspace | null>(null);
  const [workspaceEditName, setWorkspaceEditName] = useState('');
  const [workspaceEditError, setWorkspaceEditError] = useState('');
  const [workspaceEditSubmitting, setWorkspaceEditSubmitting] = useState(false);

  const [workspaceDeleteOpen, setWorkspaceDeleteOpen] = useState(false);
  const [workspaceDeleteTarget, setWorkspaceDeleteTarget] = useState<AdminWorkspace | null>(null);
  const [workspaceDeleteError, setWorkspaceDeleteError] = useState('');
  const [workspaceDeleteSubmitting, setWorkspaceDeleteSubmitting] = useState(false);

  const [superAdminDialogOpen, setSuperAdminDialogOpen] = useState(false);
  const [superAdminEmail, setSuperAdminEmail] = useState('');
  const [superAdminPassword, setSuperAdminPassword] = useState('');
  const [superAdminDisplayName, setSuperAdminDisplayName] = useState('');
  const [superAdminDialogError, setSuperAdminDialogError] = useState('');
  const [superAdminDialogSubmitting, setSuperAdminDialogSubmitting] = useState(false);

  const [superAdminDeleteOpen, setSuperAdminDeleteOpen] = useState(false);
  const [superAdminDeleteTarget, setSuperAdminDeleteTarget] = useState<SuperAdminUser | null>(null);
  const [superAdminDeleteError, setSuperAdminDeleteError] = useState('');
  const [superAdminDeleteSubmitting, setSuperAdminDeleteSubmitting] = useState(false);

  const [backupCreateSubmitting, setBackupCreateSubmitting] = useState(false);
  const [backupCreateError, setBackupCreateError] = useState('');
  const [backupActionSubmitting, setBackupActionSubmitting] = useState(false);
  const [backupActionError, setBackupActionError] = useState('');
  const [backupRestoreOpen, setBackupRestoreOpen] = useState(false);
  const [backupRestoreTarget, setBackupRestoreTarget] = useState<BackupEntry | null>(null);
  const [backupRestoreError, setBackupRestoreError] = useState('');
  const [backupRestoreSubmitting, setBackupRestoreSubmitting] = useState(false);
  const [backupRenameOpen, setBackupRenameOpen] = useState(false);
  const [backupRenameTarget, setBackupRenameTarget] = useState<BackupEntry | null>(null);
  const [backupRenameValue, setBackupRenameValue] = useState('');
  const [backupRenameSubmitting, setBackupRenameSubmitting] = useState(false);
  const [backupRenameError, setBackupRenameError] = useState('');
  const [backupDeleteOpen, setBackupDeleteOpen] = useState(false);
  const [backupDeleteTarget, setBackupDeleteTarget] = useState<BackupEntry | null>(null);
  const [backupDeleteSubmitting, setBackupDeleteSubmitting] = useState(false);
  const [backupDeleteError, setBackupDeleteError] = useState('');
  const backupUploadInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchAdminUsers();
    fetchAdminWorkspaces();
    fetchSuperAdmins();
    fetchBackups();
  }, [fetchAdminUsers, fetchAdminWorkspaces, fetchBackups, fetchSuperAdmins, isSuperAdmin]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return adminUsers;
    return adminUsers.filter((item) => {
      const workspaceNames = item.workspaces.map((workspace) => workspace.name.toLowerCase());
      return (
        (item.email ?? '').toLowerCase().includes(query)
        || item.id.toLowerCase().includes(query)
        || (item.displayName ?? '').toLowerCase().includes(query)
        || workspaceNames.some((name) => name.includes(query))
      );
    });
  }, [adminUsers, userSearch]);

  const filteredWorkspaces = useMemo(() => {
    const query = workspaceSearch.trim().toLowerCase();
    if (!query) return adminWorkspaces;
    return adminWorkspaces.filter((item) => (
      item.name.toLowerCase().includes(query)
      || item.id.toLowerCase().includes(query)
      || (item.ownerEmail ?? '').toLowerCase().includes(query)
      || (item.ownerDisplayName ?? '').toLowerCase().includes(query)
    ));
  }, [adminWorkspaces, workspaceSearch]);

  const openCreateUser = () => {
    setUserDialogMode('create');
    setUserFormTarget(null);
    setUserFormEmail('');
    setUserFormDisplayName('');
    setUserFormPassword('');
    setUserFormError('');
    setUserDialogOpen(true);
  };

  const openEditUser = (target: AdminUser) => {
    setUserDialogMode('edit');
    setUserFormTarget(target);
    setUserFormEmail(target.email ?? '');
    setUserFormDisplayName(target.displayName ?? '');
    setUserFormPassword('');
    setUserFormError('');
    setUserDialogOpen(true);
  };

  const openWorkspacesDialog = (target: AdminUser) => {
    setWorkspacesTarget(target);
    setWorkspacesDialogOpen(true);
  };

  const handleSubmitUserForm = async () => {
    const email = userFormEmail.trim();
    if (!email) {
      setUserFormError('Email is required.');
      return;
    }

    if (userDialogMode === 'create' && !userFormPassword.trim()) {
      setUserFormError('Password is required.');
      return;
    }

    setUserFormSubmitting(true);
    setUserFormError('');

    if (userDialogMode === 'create') {
      const result = await createAdminUser({
        email,
        password: userFormPassword,
        displayName: userFormDisplayName.trim() || undefined,
      });
      if (result.error) {
        setUserFormError(result.error);
        setUserFormSubmitting(false);
        return;
      }
    } else if (userFormTarget) {
      const result = await updateAdminUser({
        userId: userFormTarget.id,
        email,
        displayName: userFormDisplayName.trim() || undefined,
      });
      if (result.error) {
        setUserFormError(result.error);
        setUserFormSubmitting(false);
        return;
      }
    }

    await fetchAdminUsers(userSearch.trim());
    setUserFormSubmitting(false);
    setUserDialogOpen(false);
  };

  const handleOpenReset = (target: AdminUser) => {
    setResetTarget(target);
    setNewPassword(lastResetPasswords[target.id] ?? generatePassword());
    setResetError('');
    setResetSuccess('');
    setResetOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setResetError('');
    setResetSuccess('');
    setResetSubmitting(true);
    const result = await resetUserPassword(resetTarget.id, newPassword);
    if (result.error) {
      setResetError(result.error);
      setResetSubmitting(false);
      return;
    }
    setLastResetPasswords((prev) => ({ ...prev, [resetTarget.id]: newPassword }));
    setResetSuccess(t`Password updated. Share it with the user.`);
    setResetSubmitting(false);
  };

  const handleOpenDelete = (target: AdminUser) => {
    setDeleteTarget(target);
    setDeleteError('');
    setDeleteOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleteError('');
    setDeleteSubmitting(true);
    const result = await deleteAdminUser(deleteTarget.id);
    if (result.error) {
      setDeleteError(result.error);
      setDeleteSubmitting(false);
      return;
    }
    setDeleteSubmitting(false);
    setDeleteOpen(false);
    setDeleteTarget(null);
    await fetchAdminUsers(userSearch.trim());
  };

  const openWorkspaceEdit = (workspace: AdminWorkspace) => {
    setWorkspaceEditTarget(workspace);
    setWorkspaceEditName(workspace.name);
    setWorkspaceEditError('');
    setWorkspaceEditOpen(true);
  };

  const handleUpdateWorkspace = async () => {
    if (!workspaceEditTarget) return;
    const name = workspaceEditName.trim();
    if (!name) {
      setWorkspaceEditError('Workspace name is required.');
      return;
    }
    setWorkspaceEditSubmitting(true);
    setWorkspaceEditError('');
    const result = await updateAdminWorkspace(workspaceEditTarget.id, name);
    if (result.error) {
      setWorkspaceEditError(result.error);
      setWorkspaceEditSubmitting(false);
      return;
    }
    await fetchAdminWorkspaces();
    setWorkspaceEditSubmitting(false);
    setWorkspaceEditOpen(false);
  };

  const openWorkspaceDelete = (workspace: AdminWorkspace) => {
    setWorkspaceDeleteTarget(workspace);
    setWorkspaceDeleteError('');
    setWorkspaceDeleteOpen(true);
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceDeleteTarget) return;
    setWorkspaceDeleteSubmitting(true);
    setWorkspaceDeleteError('');
    const result = await deleteAdminWorkspace(workspaceDeleteTarget.id);
    if (result.error) {
      setWorkspaceDeleteError(result.error);
      setWorkspaceDeleteSubmitting(false);
      return;
    }
    await fetchAdminWorkspaces();
    setWorkspaceDeleteSubmitting(false);
    setWorkspaceDeleteOpen(false);
    setWorkspaceDeleteTarget(null);
  };

  const openSuperAdminDialog = () => {
    setSuperAdminEmail('');
    setSuperAdminPassword('');
    setSuperAdminDisplayName('');
    setSuperAdminDialogError('');
    setSuperAdminDialogOpen(true);
  };

  const handleCreateSuperAdmin = async () => {
    if (!superAdminEmail.trim() || !superAdminPassword.trim()) {
      setSuperAdminDialogError('Email and password are required.');
      return;
    }
    setSuperAdminDialogSubmitting(true);
    setSuperAdminDialogError('');
    const result = await createSuperAdmin({
      email: superAdminEmail,
      password: superAdminPassword,
      displayName: superAdminDisplayName.trim() || undefined,
    });
    if (result.error) {
      setSuperAdminDialogError(result.error);
      setSuperAdminDialogSubmitting(false);
      return;
    }
    await fetchSuperAdmins();
    setSuperAdminDialogSubmitting(false);
    setSuperAdminDialogOpen(false);
  };

  const openSuperAdminDelete = (target: SuperAdminUser) => {
    setSuperAdminDeleteTarget(target);
    setSuperAdminDeleteError('');
    setSuperAdminDeleteOpen(true);
  };

  const handleDeleteSuperAdmin = async () => {
    if (!superAdminDeleteTarget) return;
    setSuperAdminDeleteSubmitting(true);
    setSuperAdminDeleteError('');
    const result = await deleteSuperAdmin(superAdminDeleteTarget.userId);
    if (result.error) {
      setSuperAdminDeleteError(result.error);
      setSuperAdminDeleteSubmitting(false);
      return;
    }
    await fetchSuperAdmins();
    setSuperAdminDeleteSubmitting(false);
    setSuperAdminDeleteOpen(false);
    setSuperAdminDeleteTarget(null);
  };

  const handleCreateBackup = async () => {
    setBackupCreateSubmitting(true);
    setBackupCreateError('');
    setBackupActionError('');
    const result = await createBackup();
    if (result.error) {
      setBackupCreateError(result.error);
      setBackupCreateSubmitting(false);
      return;
    }
    await fetchBackups();
    setBackupCreateSubmitting(false);
  };

  const openBackupUploadDialog = () => {
    setBackupActionError('');
    backupUploadInputRef.current?.click();
  };

  const handleUploadBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBackupActionSubmitting(true);
    setBackupActionError('');
    const result = await uploadBackup(file);
    if (result.error) {
      setBackupActionError(result.error);
      setBackupActionSubmitting(false);
      return;
    }
    await fetchBackups();
    setBackupActionSubmitting(false);
  };

  const handleDownloadBackup = async (target: BackupEntry) => {
    setBackupActionSubmitting(true);
    setBackupActionError('');
    const result = await downloadBackup(target.name);
    if (result.error) {
      setBackupActionError(result.error);
    }
    setBackupActionSubmitting(false);
  };

  const openBackupRename = (target: BackupEntry) => {
    setBackupRenameTarget(target);
    setBackupRenameValue(target.name);
    setBackupRenameError('');
    setBackupRenameOpen(true);
  };

  const handleRenameBackup = async () => {
    if (!backupRenameTarget) return;
    const nextName = backupRenameValue.trim();
    if (!nextName) {
      setBackupRenameError('Backup name is required.');
      return;
    }
    setBackupRenameSubmitting(true);
    setBackupRenameError('');
    const result = await renameBackup(backupRenameTarget.name, nextName);
    if (result.error) {
      setBackupRenameError(result.error);
      setBackupRenameSubmitting(false);
      return;
    }
    await fetchBackups();
    setBackupRenameSubmitting(false);
    setBackupRenameOpen(false);
    setBackupRenameTarget(null);
  };

  const openBackupDelete = (target: BackupEntry) => {
    setBackupDeleteTarget(target);
    setBackupDeleteError('');
    setBackupDeleteOpen(true);
  };

  const handleDeleteBackup = async () => {
    if (!backupDeleteTarget) return;
    setBackupDeleteSubmitting(true);
    setBackupDeleteError('');
    const result = await deleteBackup(backupDeleteTarget.name);
    if (result.error) {
      setBackupDeleteError(result.error);
      setBackupDeleteSubmitting(false);
      return;
    }
    await fetchBackups();
    setBackupDeleteSubmitting(false);
    setBackupDeleteOpen(false);
    setBackupDeleteTarget(null);
  };

  const openBackupRestore = (target: BackupEntry) => {
    setBackupRestoreTarget(target);
    setBackupRestoreError('');
    setBackupActionError('');
    setBackupRestoreOpen(true);
  };

  const handleRestoreBackup = async () => {
    if (!backupRestoreTarget) return;
    setBackupRestoreSubmitting(true);
    setBackupRestoreError('');
    const result = await restoreBackup(backupRestoreTarget.name);
    if (result.error) {
      setBackupRestoreError(result.error);
      setBackupRestoreSubmitting(false);
      return;
    }
    await fetchBackups();
    setBackupRestoreSubmitting(false);
    setBackupRestoreOpen(false);
    setBackupRestoreTarget(null);
  };

  const workspaceDetails = workspacesTarget?.workspaces ?? [];

  if (!user) {
    return null;
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t`Access denied`}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t`Only super admins can access this page.`}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Super admin console</CardTitle>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
              <Button type="button" variant="outline" onClick={() => signOut()}>
                {t`Sign out`}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
              <TabsList className="flex flex-wrap w-full h-auto items-start justify-start gap-2 mb-4">
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
                <TabsTrigger value="superAdmins">Super admins</TabsTrigger>
                <TabsTrigger value="backups">Backups</TabsTrigger>
              </TabsList>

              <TabsContent value="users" className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    placeholder="Search by email, ID, workspace..."
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                  />
                  <Button type="button" variant="outline" onClick={() => fetchAdminUsers(userSearch.trim())}>
                    Refresh
                  </Button>
                  <Button type="button" onClick={openCreateUser}>
                    Create user
                  </Button>
                </div>

                {adminUsersError && (
                  <Alert variant="destructive">
                    <AlertTitle>{t`Error`}</AlertTitle>
                    <AlertDescription>{adminUsersError}</AlertDescription>
                  </Alert>
                )}

                {adminUsersLoading ? (
                  <div className="py-6 text-sm text-muted-foreground">{t`Loading users...`}</div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Display name</TableHead>
                          <TableHead>Workspaces</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Last sign in</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-sm text-muted-foreground">
                              No users.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredUsers.map((item) => {
                            const isSelf = user?.id === item.id;
                            return (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.email ?? '—'}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{item.id}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {item.displayName ?? '—'}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  <div className="text-sm text-foreground">{item.workspaceCount}</div>
                                  <div>{formatWorkspaceSummary(item.workspaces)}</div>
                                  {item.workspaces.length > 0 && (
                                    <Button
                                      type="button"
                                      variant="link"
                                      size="sm"
                                      className="h-auto p-0 text-xs"
                                      onClick={() => openWorkspacesDialog(item)}
                                    >
                                      {t`Details`}
                                    </Button>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs">{formatDate(item.createdAt, locale)}</TableCell>
                                <TableCell className="text-xs">{formatDate(item.lastSignInAt, locale)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex flex-wrap justify-end gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openEditUser(item)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleOpenReset(item)}
                                      disabled={isSelf}
                                    >
                                      Reset password
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleOpenDelete(item)}
                                      disabled={isSelf}
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="workspaces" className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    placeholder="Search by name or owner..."
                    value={workspaceSearch}
                    onChange={(event) => setWorkspaceSearch(event.target.value)}
                  />
                  <Button type="button" variant="outline" onClick={() => fetchAdminWorkspaces()}>
                    Refresh
                  </Button>
                </div>

                {adminWorkspacesError && (
                  <Alert variant="destructive">
                    <AlertTitle>{t`Error`}</AlertTitle>
                    <AlertDescription>{adminWorkspacesError}</AlertDescription>
                  </Alert>
                )}

                {adminWorkspacesLoading ? (
                  <div className="py-6 text-sm text-muted-foreground">{t`Loading workspaces...`}</div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead>Members</TableHead>
                          <TableHead>Tasks</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredWorkspaces.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-sm text-muted-foreground">
                              No workspaces.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredWorkspaces.map((workspace) => (
                            <TableRow key={workspace.id}>
                              <TableCell className="font-medium">
                                <div>{workspace.name}</div>
                                <div className="text-xs text-muted-foreground">{workspace.id}</div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {workspace.ownerDisplayName ?? workspace.ownerEmail ?? workspace.ownerId}
                              </TableCell>
                              <TableCell className="text-sm">{workspace.membersCount}</TableCell>
                              <TableCell className="text-sm">{workspace.tasksCount}</TableCell>
                              <TableCell className="text-xs">{formatDate(workspace.createdAt, locale)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-wrap justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openWorkspaceEdit(workspace)}
                                  >
                                    Rename
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => openWorkspaceDelete(workspace)}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="superAdmins" className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button type="button" onClick={openSuperAdminDialog}>
                    Add super admin
                  </Button>
                  <Button type="button" variant="outline" onClick={() => fetchSuperAdmins()}>
                    Refresh
                  </Button>
                </div>

                {superAdminsError && (
                  <Alert variant="destructive">
                    <AlertTitle>{t`Error`}</AlertTitle>
                    <AlertDescription>{superAdminsError}</AlertDescription>
                  </Alert>
                )}

                {superAdminsLoading ? (
                  <div className="py-6 text-sm text-muted-foreground">{t`Loading super admins...`}</div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Display name</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {superAdmins.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-sm text-muted-foreground">
                              No super admins.
                            </TableCell>
                          </TableRow>
                        ) : (
                          superAdmins.map((item) => (
                            <TableRow key={item.userId}>
                              <TableCell className="font-medium">{item.email ?? '—'}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{item.userId}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.displayName ?? '—'}
                              </TableCell>
                              <TableCell className="text-xs">{formatDate(item.createdAt, locale)}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => openSuperAdminDelete(item)}
                                  disabled={item.userId === user.id}
                                >
                                  Remove
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="backups" className="space-y-4">
                <input
                  ref={backupUploadInputRef}
                  type="file"
                  accept=".dump,application/octet-stream"
                  className="hidden"
                  onChange={handleUploadBackup}
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    onClick={handleCreateBackup}
                    disabled={backupCreateSubmitting}
                  >
                    Create backup
                  </Button>
                  <Button type="button" variant="outline" onClick={() => fetchBackups()}>
                    Refresh
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={openBackupUploadDialog}
                    disabled={backupActionSubmitting}
                  >
                    Upload backup
                  </Button>
                </div>

                {backupCreateError && (
                  <Alert variant="destructive">
                    <AlertTitle>{t`Error`}</AlertTitle>
                    <AlertDescription>{backupCreateError}</AlertDescription>
                  </Alert>
                )}

                {backupsError && (
                  <Alert variant="destructive">
                    <AlertTitle>{t`Error`}</AlertTitle>
                    <AlertDescription>{backupsError}</AlertDescription>
                  </Alert>
                )}

                {backupActionError && (
                  <Alert variant="destructive">
                    <AlertTitle>{t`Error`}</AlertTitle>
                    <AlertDescription>{backupActionError}</AlertDescription>
                  </Alert>
                )}

                {backupsLoading ? (
                  <div className="py-6 text-sm text-muted-foreground">{t`Loading backups...`}</div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {backups.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-sm text-muted-foreground">
                              No backups.
                            </TableCell>
                          </TableRow>
                        ) : (
                          backups.map((item) => (
                            <TableRow key={item.name}>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatBackupType(item.type)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatBytes(item.size)}
                              </TableCell>
                              <TableCell className="text-xs">{formatDate(item.createdAt, locale)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-wrap justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void handleDownloadBackup(item)}
                                    disabled={backupActionSubmitting}
                                  >
                                    Download
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openBackupRename(item)}
                                    disabled={backupRenameSubmitting || backupDeleteSubmitting || backupRestoreSubmitting}
                                  >
                                    Rename
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openBackupDelete(item)}
                                    disabled={backupRenameSubmitting || backupDeleteSubmitting || backupRestoreSubmitting}
                                  >
                                    Delete
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => openBackupRestore(item)}
                                    disabled={backupRenameSubmitting || backupDeleteSubmitting || backupRestoreSubmitting}
                                  >
                                    Restore
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{userDialogMode === 'create' ? 'Create user' : 'Edit user'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Email"
              value={userFormEmail}
              onChange={(event) => setUserFormEmail(event.target.value)}
            />
            <Input
              placeholder="Display name"
              value={userFormDisplayName}
              onChange={(event) => setUserFormDisplayName(event.target.value)}
            />
            {userDialogMode === 'create' && (
              <Input
                type="password"
                placeholder="Password"
                value={userFormPassword}
                onChange={(event) => setUserFormPassword(event.target.value)}
              />
            )}
            {userFormError && (
              <div className="text-sm text-destructive">{userFormError}</div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUserDialogOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={handleSubmitUserForm}
              disabled={userFormSubmitting}
            >
              {userDialogMode === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={workspacesDialogOpen}
        onOpenChange={(open) => {
          setWorkspacesDialogOpen(open);
          if (!open) setWorkspacesTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{t`User workspaces`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {workspacesTarget?.email ?? workspacesTarget?.id ?? '—'}
            </div>
            {workspaceDetails.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t`No workspaces.`}</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workspaceDetails.map((workspace) => (
                      <TableRow key={workspace.id}>
                        <TableCell className="font-medium">{workspace.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{workspace.role}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{workspace.id}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setWorkspacesDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {t`New password for`} <span className="font-medium text-foreground">{resetTarget?.email ?? '—'}</span>
            </div>
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder={t`New password`}
            />
            <Button type="button" variant="outline" onClick={() => setNewPassword(generatePassword())}>
              {t`Generate`}
            </Button>
            {resetError && (
              <div className="text-sm text-destructive">{resetError}</div>
            )}
            {resetSuccess && (
              <div className="text-sm text-emerald-600">{resetSuccess}</div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={handleResetPassword}
              disabled={resetSubmitting || !newPassword.trim()}
            >
              Update password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              {t`The user will be deleted permanently. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="text-sm text-destructive">{deleteError}</div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteUser();
              }}
              disabled={deleteSubmitting}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={workspaceEditOpen} onOpenChange={setWorkspaceEditOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Rename workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={workspaceEditName}
              onChange={(event) => setWorkspaceEditName(event.target.value)}
              placeholder="Workspace name"
            />
            {workspaceEditError && (
              <div className="text-sm text-destructive">{workspaceEditError}</div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setWorkspaceEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdateWorkspace} disabled={workspaceEditSubmitting}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={workspaceDeleteOpen} onOpenChange={setWorkspaceDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              {t`The workspace and all its data will be deleted permanently.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {workspaceDeleteError && (
            <div className="text-sm text-destructive">{workspaceDeleteError}</div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteWorkspace();
              }}
              disabled={workspaceDeleteSubmitting}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={superAdminDialogOpen} onOpenChange={setSuperAdminDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Add super admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Email"
              value={superAdminEmail}
              onChange={(event) => setSuperAdminEmail(event.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              value={superAdminPassword}
              onChange={(event) => setSuperAdminPassword(event.target.value)}
            />
            <Input
              placeholder="Display name"
              value={superAdminDisplayName}
              onChange={(event) => setSuperAdminDisplayName(event.target.value)}
            />
            {superAdminDialogError && (
              <div className="text-sm text-destructive">{superAdminDialogError}</div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSuperAdminDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateSuperAdmin} disabled={superAdminDialogSubmitting}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={superAdminDeleteOpen} onOpenChange={setSuperAdminDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove super admin?</AlertDialogTitle>
            <AlertDialogDescription>
              {t`The super admin will lose access to the admin panel. The account will remain.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {superAdminDeleteError && (
            <div className="text-sm text-destructive">{superAdminDeleteError}</div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteSuperAdmin();
              }}
              disabled={superAdminDeleteSubmitting}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={backupRenameOpen} onOpenChange={setBackupRenameOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Rename backup</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={backupRenameValue}
              onChange={(event) => setBackupRenameValue(event.target.value)}
              placeholder="backup-name.dump"
            />
            {backupRenameError && (
              <div className="text-sm text-destructive">{backupRenameError}</div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBackupRenameOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleRenameBackup} disabled={backupRenameSubmitting}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={backupDeleteOpen} onOpenChange={setBackupDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete backup {backupDeleteTarget?.name ?? '—'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {backupDeleteError && (
            <div className="text-sm text-destructive">{backupDeleteError}</div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteBackup();
              }}
              disabled={backupDeleteSubmitting}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={backupRestoreOpen} onOpenChange={setBackupRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore backup?</AlertDialogTitle>
            <AlertDialogDescription>
              {t({
                message: 'The database will be replaced with backup {name}.',
                values: { name: backupRestoreTarget?.name ?? '—' },
              })}
              {' '}
              {t`All current data will be lost.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {backupRestoreError && (
            <div className="text-sm text-destructive">{backupRestoreError}</div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleRestoreBackup();
              }}
              disabled={backupRestoreSubmitting}
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsersPage;
