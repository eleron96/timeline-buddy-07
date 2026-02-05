import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useAuthStore, WorkspaceRole } from '@/features/auth/store/authStore';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Switch } from '@/shared/ui/switch';
import { Badge } from '@/shared/ui/badge';
import { usePlannerStore } from '@/features/planner/store/plannerStore';
import { cn } from '@/shared/lib/classNames';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { supabase } from '@/shared/lib/supabaseClient';

interface WorkspaceMembersPanelProps {
  active?: boolean;
  showTitle?: boolean;
  className?: string;
}

type MemberGroup = {
  id: string;
  name: string;
};

export const WorkspaceMembersPanel: React.FC<WorkspaceMembersPanelProps> = ({
  active = true,
  showTitle = true,
  className,
}) => {
  const {
    user,
    members,
    membersLoading,
    fetchMembers,
    inviteMember,
    updateMemberRole,
    updateMemberGroup,
    removeMember,
    currentWorkspaceId,
    currentWorkspaceRole,
  } = useAuthStore();
  const { assignees, refreshAssignees, updateAssignee, setWorkspaceId } = usePlannerStore();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('viewer');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [actionLink, setActionLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [groups, setGroups] = useState<MemberGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState('');
  const [inviteGroupId, setInviteGroupId] = useState('none');

  const isAdmin = currentWorkspaceRole === 'admin';
  const currentUserId = user?.id ?? null;

  useEffect(() => {
    if (active && currentWorkspaceId) {
      fetchMembers(currentWorkspaceId);
      setWorkspaceId(currentWorkspaceId);
      refreshAssignees();
    }
  }, [active, currentWorkspaceId, fetchMembers, refreshAssignees, setWorkspaceId]);

  useEffect(() => {
    if (!active || !currentWorkspaceId) return;
    let isMounted = true;
    setGroupsLoading(true);
    setGroupsError('');
    supabase
      .from('member_groups')
      .select('id, name')
      .eq('workspace_id', currentWorkspaceId)
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          setGroupsError(error.message);
          setGroupsLoading(false);
          return;
        }
        setGroups((data ?? []) as MemberGroup[]);
        setGroupsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [active, currentWorkspaceId]);

  const assigneeByUserId = useMemo(() => {
    const map = new Map<string, typeof assignees[number]>();
    assignees.forEach((assignee) => {
      if (assignee.userId) {
        map.set(assignee.userId, assignee);
      }
    });
    return map;
  }, [assignees]);

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setWarning('');
    setActionLink('');
    if (!email.trim()) return;

    setSubmitting(true);
    const result = await inviteMember(
      email.trim(),
      role,
      inviteGroupId === 'none' ? null : inviteGroupId,
    );
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
      setInviteGroupId('none');
      setInviteOpen(false);
    }
  };

  const handleRoleChange = async (userId: string, nextRole: WorkspaceRole) => {
    if (!isAdmin) return;
    const result = await updateMemberRole(userId, nextRole);
    if (result.error) {
      setError(result.error);
    }
  };

  const handleGroupChange = async (userId: string, nextGroupId: string) => {
    if (!isAdmin) return;
    const groupId = nextGroupId === 'none' ? null : nextGroupId;
    const result = await updateMemberGroup(userId, groupId);
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
    <div className={cn('space-y-4', className)}>
      {showTitle && (
        <div>
          <h2 className="text-base font-semibold">Workspace members</h2>
          <p className="text-xs text-muted-foreground">
            Manage invites, roles, and access.
          </p>
        </div>
      )}

      {!isAdmin && (
        <Alert>
          <AlertTitle>Read-only</AlertTitle>
          <AlertDescription>You have view access and cannot manage members.</AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border bg-background p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Invites</div>
            <div className="text-xs text-muted-foreground">
              Invite people and share access.
            </div>
          </div>
          <Popover open={inviteOpen} onOpenChange={setInviteOpen}>
            <PopoverTrigger asChild>
              <Button variant="secondary" disabled={!isAdmin}>
                Add member
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="end">
              <form onSubmit={handleInvite} className="space-y-3">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={!isAdmin}
                />
                <div className="space-y-1">
                  <Label>Role</Label>
                  <Select value={role} onValueChange={(value) => setRole(value as WorkspaceRole)} disabled={!isAdmin}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Group</Label>
                  <Select
                    value={inviteGroupId}
                    onValueChange={setInviteGroupId}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={groupsLoading ? 'Loading groups...' : 'No group'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No group</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {groupsError && (
                    <div className="text-xs text-destructive">{groupsError}</div>
                  )}
                  {!groupsError && groups.length === 0 && (
                    <div className="text-xs text-muted-foreground">No groups created yet.</div>
                  )}
                </div>
                <Button type="submit" disabled={!isAdmin || submitting || !email.trim()}>
                  Send invite
                </Button>
              </form>
            </PopoverContent>
          </Popover>
        </div>

        {(error || warning || actionLink) && (
          <div className="space-y-2">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Action failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {warning && (
              <Alert>
                <AlertTitle>Invite created</AlertTitle>
                <AlertDescription>{warning}</AlertDescription>
              </Alert>
            )}

            {actionLink && (
              <Alert>
                <AlertTitle>Invite link created</AlertTitle>
                <AlertDescription>
                  Copy this link if the email did not send: {actionLink}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-background p-4 space-y-3">
        <div>
          <div className="text-sm font-semibold">Members & roles</div>
          <div className="text-xs text-muted-foreground">
            Manage roles, groups, and status.
          </div>
        </div>

        <div className="hidden md:grid grid-cols-[1fr,140px,180px,120px,90px] gap-3 text-xs text-muted-foreground px-2">
          <span>Member</span>
          <span>Role</span>
          <span>Group</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>

        {membersLoading && (
          <div className="text-sm text-muted-foreground">Loading members...</div>
        )}
        {!membersLoading && members.length === 0 && (
          <div className="text-sm text-muted-foreground">No members found.</div>
        )}
        {members.map((member) => {
          const isSelf = Boolean(currentUserId && member.userId === currentUserId);
          const assignee = assigneeByUserId.get(member.userId);
          const isActive = assignee?.isActive ?? true;
          return (
            <div key={member.userId} className="grid items-center gap-3 rounded-md border px-3 py-3 md:grid-cols-[1fr,140px,180px,120px,90px]">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {member.email}
                  {isSelf ? ' (you)' : ''}
                </div>
                {member.displayName && (
                  <div className="text-xs text-muted-foreground truncate">{member.displayName}</div>
                )}
                {!isActive && (
                  <Badge variant="secondary" className="mt-1 text-[10px]">Disabled</Badge>
                )}
              </div>
              <Select
                value={member.role}
                onValueChange={(value) => handleRoleChange(member.userId, value as WorkspaceRole)}
                disabled={!isAdmin}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={member.groupId ?? 'none'}
                onValueChange={(value) => handleGroupChange(member.userId, value)}
                disabled={!isAdmin}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={groupsLoading ? 'Loading groups...' : 'No group'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No group</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-3">
                {assignee ? (
                  <>
                    <Switch
                      checked={isActive}
                      onCheckedChange={(value) => updateAssignee(assignee.id, { isActive: value })}
                      disabled={!isAdmin || isSelf}
                      aria-label={isActive ? 'Disable member' : 'Enable member'}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {isActive ? 'Active' : 'Disabled'}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(member.userId)}
                  disabled={!isAdmin || isSelf}
                >
                  Remove
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
