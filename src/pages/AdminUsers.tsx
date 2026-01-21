import React, { useEffect, useMemo, useState } from 'react';
import { useAuthStore, AdminUser } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU');
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

const AdminUsersPage: React.FC = () => {
  const {
    user,
    currentWorkspaceRole,
    isReserveAdmin,
    adminUsers,
    adminUsersLoading,
    adminUsersError,
    fetchAdminUsers,
    resetUserPassword,
    deleteAdminUser,
    signOut,
  } = useAuthStore();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const isAdmin = currentWorkspaceRole === 'admin' || isReserveAdmin;

  useEffect(() => {
    if (!isAdmin) return;
    fetchAdminUsers();
  }, [fetchAdminUsers, isAdmin]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return adminUsers;
    return adminUsers.filter((item) => (
      item.email?.toLowerCase().includes(query)
      || item.id.toLowerCase().includes(query)
    ));
  }, [adminUsers, search]);

  const handleOpenReset = (target: AdminUser) => {
    setSelectedUser(target);
    setNewPassword(generatePassword());
    setResetError('');
    setResetSuccess('');
    setResetOpen(true);
  };

  const handleOpenDelete = (target: AdminUser) => {
    setDeleteTarget(target);
    setDeleteError('');
    setDeleteOpen(true);
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    setResetError('');
    setResetSuccess('');
    setResetSubmitting(true);
    const result = await resetUserPassword(selectedUser.id, newPassword);
    if (result.error) {
      setResetError(result.error);
      setResetSubmitting(false);
      return;
    }
    setResetSuccess('Пароль обновлен. Сообщи его пользователю.');
    setResetSubmitting(false);
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
    await fetchAdminUsers();
  };

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Нет доступа</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Доступ к списку пользователей есть только у администратора.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Пользователи</CardTitle>
            <div className="flex w-full max-w-lg flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Input
                placeholder="Поиск по email или ID"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Button type="button" variant="outline" onClick={() => fetchAdminUsers()}>
                Обновить
              </Button>
              <Button type="button" variant="outline" onClick={() => signOut()}>
                Выйти
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {adminUsersError && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Ошибка</AlertTitle>
                <AlertDescription>{adminUsersError}</AlertDescription>
              </Alert>
            )}
            {adminUsersLoading ? (
              <div className="py-6 text-sm text-muted-foreground">Загрузка пользователей...</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Создан</TableHead>
                      <TableHead>Последний вход</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-sm text-muted-foreground">
                          Нет пользователей.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((item) => {
                        const isSelf = user?.id === item.id;
                        return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.email ?? '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.id}</TableCell>
                          <TableCell className="text-xs">{formatDate(item.createdAt)}</TableCell>
                          <TableCell className="text-xs">{formatDate(item.lastSignInAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenReset(item)}
                                disabled={isSelf}
                              >
                                Сбросить пароль
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleOpenDelete(item)}
                                disabled={isSelf}
                              >
                                Удалить
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
          </CardContent>
        </Card>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Сброс пароля</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Новый пароль для <span className="font-medium text-foreground">{selectedUser?.email ?? '—'}</span>
            </div>
            <div className="space-y-2">
              <Input
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Новый пароль"
              />
              <Button type="button" variant="outline" onClick={() => setNewPassword(generatePassword())}>
                Сгенерировать
              </Button>
            </div>
            {resetError && (
              <div className="text-sm text-destructive">{resetError}</div>
            )}
            {resetSuccess && (
              <div className="text-sm text-emerald-600">{resetSuccess}</div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
              Закрыть
            </Button>
            <Button type="button" onClick={handleResetPassword} disabled={resetSubmitting || !newPassword.trim()}>
              Обновить пароль
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить пользователя?</AlertDialogTitle>
            <AlertDialogDescription>
              Пользователь будет удален навсегда. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="text-sm text-destructive">{deleteError}</div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteUser();
              }}
              disabled={deleteSubmitting}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsersPage;
