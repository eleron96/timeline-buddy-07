import React, { useState } from 'react';
import { ChevronDown, Plus, Trash2, Users } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';
import { WorkspaceMembersSheet } from '@/components/WorkspaceMembersSheet';

export const WorkspaceSwitcher: React.FC = () => {
  const {
    user,
    workspaces,
    currentWorkspaceId,
    currentWorkspaceRole,
    setCurrentWorkspaceId,
    createWorkspace,
    deleteWorkspace,
    signOut,
  } = useAuthStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId);
  const isAdmin = currentWorkspaceRole === 'admin';
  const canCreateWorkspace = workspaces.length < 5;
  const canDeleteWorkspace = Boolean(currentWorkspaceId) && isAdmin;
  const signedInLabel = user?.email
    ?? user?.user_metadata?.full_name
    ?? user?.user_metadata?.name
    ?? user?.id
    ?? 'Unknown user';

  const handleCreateWorkspace = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError('');
    if (!canCreateWorkspace) {
      setCreateError('Workspace limit reached (5).');
      return;
    }
    if (!workspaceName.trim()) return;

    setCreating(true);
    const result = await createWorkspace(workspaceName.trim());
    if (result.error) {
      setCreateError(result.error);
    } else {
      setWorkspaceName('');
      setCreateOpen(false);
    }
    setCreating(false);
  };

  const handleDeleteWorkspace = async () => {
    if (!currentWorkspaceId || !canDeleteWorkspace) return;
    setDeleteError('');
    setDeleting(true);
    const result = await deleteWorkspace(currentWorkspaceId);
    if (result.error) {
      setDeleteError(result.error);
      setDeleting(false);
      return;
    }
    setDeleting(false);
    setDeleteOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <span className="max-w-[180px] truncate">{currentWorkspace?.name ?? 'Select workspace'}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={currentWorkspaceId ?? ''}
            onValueChange={(value) => setCurrentWorkspaceId(value)}
          >
            {workspaces.map((workspace) => (
              <DropdownMenuRadioItem key={workspace.id} value={workspace.id}>
                <span className="truncate">{workspace.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => { event.preventDefault(); setCreateOpen(true); }}
            disabled={!canCreateWorkspace}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create workspace
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => { event.preventDefault(); setMembersOpen(true); }}
            disabled={!isAdmin}
          >
            <Users className="mr-2 h-4 w-4" />
            Manage members
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => { event.preventDefault(); setDeleteError(''); setDeleteOpen(true); }}
            disabled={!canDeleteWorkspace}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete workspace
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">Signed in as</DropdownMenuLabel>
          <DropdownMenuItem disabled className="cursor-default opacity-100">
            <span className="max-w-[180px] truncate">{signedInLabel}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={(event) => { event.preventDefault(); signOut(); }}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateWorkspace} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace name</Label>
              <Input
                id="workspace-name"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="My team workspace"
                autoFocus
                disabled={!canCreateWorkspace}
              />
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !workspaceName.trim()}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{currentWorkspace?.name ?? 'this workspace'}" and all its data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteWorkspace} disabled={deleting}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WorkspaceMembersSheet open={membersOpen} onOpenChange={setMembersOpen} />
    </>
  );
};
