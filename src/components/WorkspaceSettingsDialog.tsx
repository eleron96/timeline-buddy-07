import React, { useEffect, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuthStore } from '@/store/authStore';

interface WorkspaceSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WorkspaceSettingsDialog: React.FC<WorkspaceSettingsDialogProps> = ({ open, onOpenChange }) => {
  const {
    workspaces,
    currentWorkspaceId,
    currentWorkspaceRole,
    updateWorkspaceName,
    deleteWorkspace,
  } = useAuthStore();

  const [workspaceName, setWorkspaceName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId);
  const isAdmin = currentWorkspaceRole === 'admin';

  useEffect(() => {
    if (!open) return;
    setWorkspaceName(currentWorkspace?.name ?? '');
    setError('');
  }, [open, currentWorkspace?.name]);

  const handleSave = async () => {
    if (!currentWorkspaceId) return;
    setError('');
    setSaving(true);
    const result = await updateWorkspaceName(currentWorkspaceId, workspaceName);
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!currentWorkspaceId) return;
    setError('');
    const result = await deleteWorkspace(currentWorkspaceId);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDeleteOpen(false);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[420px] sm:w-[480px]">
          <SheetHeader>
            <SheetTitle>Workspace settings</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {!isAdmin && (
              <p className="text-sm text-muted-foreground">
                You have view access and cannot edit this workspace.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace name</Label>
              <Input
                id="workspace-name"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                disabled={!isAdmin || !currentWorkspaceId || saving}
              />
              {error && (
                <div className="text-sm text-destructive">{error}</div>
              )}
              <Button
                onClick={handleSave}
                disabled={!isAdmin || !currentWorkspaceId || saving || !workspaceName.trim()}
              >
                Save
              </Button>
            </div>

            <div className="border-t border-border pt-4">
              <Button
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
                disabled={!isAdmin || !currentWorkspaceId}
              >
                Delete workspace
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{currentWorkspace?.name ?? 'this workspace'}" and all its data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
