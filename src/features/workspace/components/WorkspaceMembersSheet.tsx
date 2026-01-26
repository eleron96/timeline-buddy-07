import React, { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useAuthStore, WorkspaceRole } from '@/features/auth/store/authStore';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';

interface WorkspaceMembersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WorkspaceMembersSheet: React.FC<WorkspaceMembersSheetProps> = ({ open, onOpenChange }) => {
  const {
    user,
    members,
    membersLoading,
    fetchMembers,
    inviteMember,
    updateMemberRole,
    removeMember,
    currentWorkspaceId,
    currentWorkspaceRole,
  } = useAuthStore();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('viewer');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [actionLink, setActionLink] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = currentWorkspaceRole === 'admin';
  const currentUserId = user?.id ?? null;

  useEffect(() => {
    if (open && currentWorkspaceId) {
      fetchMembers(currentWorkspaceId);
    }
  }, [currentWorkspaceId, fetchMembers, open]);

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setWarning('');
    setActionLink('');
    if (!email.trim()) return;

    setSubmitting(true);
    const result = await inviteMember(email.trim(), role);
    if (result.error) {
      setError(result.error);
    }
    if (result.warning) {
      setWarning(result.warning);
    }
    if (result.actionLink) {
      setActionLink(result.actionLink);
    }
    setSubmitting(false);
    if (!result.error) {
      setEmail('');
      setRole('viewer');
    }
  };

  const handleRoleChange = async (userId: string, nextRole: WorkspaceRole) => {
    if (!isAdmin) return;
    const result = await updateMemberRole(userId, nextRole);
    if (result.error) {
      setError(result.error);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!isAdmin) return;
    if (currentUserId && userId === currentUserId) {
      setError('You cannot remove yourself.');
      return;
    }
    const result = await removeMember(userId);
    if (result.error) {
      setError(result.error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Workspace members</SheetTitle>
        </SheetHeader>

        {!isAdmin && (
          <Alert className="mt-4">
            <AlertTitle>Read-only</AlertTitle>
            <AlertDescription>You have view access and cannot manage members.</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>Action failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {warning && (
          <Alert className="mt-4">
            <AlertTitle>Invite created</AlertTitle>
            <AlertDescription>{warning}</AlertDescription>
          </Alert>
        )}

        {actionLink && (
          <Alert className="mt-4">
            <AlertTitle>Invite link created</AlertTitle>
            <AlertDescription>
              Copy this link if the email did not send: {actionLink}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleInvite} className="mt-6 space-y-3">
          <Label htmlFor="invite-email">Invite by email</Label>
          <div className="flex gap-2">
            <Input
              id="invite-email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={!isAdmin}
            />
            <Select value={role} onValueChange={(value) => setRole(value as WorkspaceRole)} disabled={!isAdmin}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={!isAdmin || submitting || !email.trim()}>
            Send invite
          </Button>
        </form>

        <div className="mt-8 space-y-3">
          <h3 className="text-sm font-semibold">Members</h3>
          {membersLoading && (
            <div className="text-sm text-muted-foreground">Loading members...</div>
          )}
          {!membersLoading && members.length === 0 && (
            <div className="text-sm text-muted-foreground">No members found.</div>
          )}
          {members.map((member) => {
            const isSelf = Boolean(currentUserId && member.userId === currentUserId);
            return (
              <div key={member.userId} className="flex items-center gap-2 rounded-md border p-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {member.email}
                    {isSelf ? ' (you)' : ''}
                  </div>
                  {member.displayName && (
                    <div className="text-xs text-muted-foreground truncate">{member.displayName}</div>
                  )}
                </div>
                <Select
                  value={member.role}
                  onValueChange={(value) => handleRoleChange(member.userId, value as WorkspaceRole)}
                  disabled={!isAdmin}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(member.userId)}
                  disabled={!isAdmin || isSelf}
                >
                  Remove
                </Button>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};
