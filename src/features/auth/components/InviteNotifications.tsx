import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { supabase } from '@/shared/lib/supabaseClient';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { WorkspaceRole } from '@/features/auth/store/authStore';
import { toast } from '@/shared/ui/sonner';
import { t } from '@lingui/macro';

type PendingInvite = {
  token: string;
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
  inviterDisplayName: string | null;
  inviterEmail: string | null;
};

type SentInviteSummary = {
  token: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  status: 'pending' | 'accepted' | 'declined' | 'canceled' | 'expired';
  respondedAt: string | null;
};

const parseFunctionError = async (error: { message: string }, response?: Response) => {
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

const isPendingInvite = (value: unknown): value is PendingInvite => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PendingInvite>;
  return (
    typeof candidate.token === 'string'
    && typeof candidate.workspaceId === 'string'
    && typeof candidate.workspaceName === 'string'
    && typeof candidate.role === 'string'
  );
};

const parsePendingInvites = (value: unknown): PendingInvite[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isPendingInvite);
};

const isSentInviteSummary = (value: unknown): value is SentInviteSummary => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SentInviteSummary>;
  return (
    typeof candidate.token === 'string'
    && typeof candidate.workspaceId === 'string'
    && typeof candidate.workspaceName === 'string'
    && typeof candidate.email === 'string'
    && typeof candidate.status === 'string'
  );
};

const parseSentInvites = (value: unknown): SentInviteSummary[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isSentInviteSummary);
};

const roleLabel = (role: WorkspaceRole) => {
  if (role === 'admin') return t`Admin`;
  if (role === 'editor') return t`Editor`;
  return t`Viewer`;
};

export const InviteNotifications: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const currentWorkspaceId = useAuthStore((state) => state.currentWorkspaceId);
  const fetchWorkspaces = useAuthStore((state) => state.fetchWorkspaces);
  const setCurrentWorkspaceId = useAuthStore((state) => state.setCurrentWorkspaceId);
  const acceptInvite = useAuthStore((state) => state.acceptInvite);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [busyToken, setBusyToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const inviteReactionSeenRef = useRef<Set<string>>(new Set());

  const inviteReactionStorageKey = user?.id ? `invite-reactions-seen-${user.id}` : null;

  const pendingCount = pendingInvites.length;
  const hasPending = pendingCount > 0;
  const badgeLabel = useMemo(() => (pendingCount > 9 ? '9+' : String(pendingCount)), [pendingCount]);

  const loadPendingInvites = useCallback(async (showLoading = true) => {
    if (!user) {
      setPendingInvites([]);
      setLoading(false);
      return;
    }

    if (showLoading) {
      setLoading(true);
    }

    const { data, error, response } = await supabase.functions.invoke('invite', {
      body: { action: 'list' },
    });

    if (error) {
      setErrorMessage(await parseFunctionError(error, response));
      if (showLoading) {
        setLoading(false);
      }
      return;
    }

    const payloadInvites = parsePendingInvites((data as { invites?: unknown } | null)?.invites);
    setPendingInvites(payloadInvites);
    setErrorMessage('');
    if (showLoading) {
      setLoading(false);
    }
  }, [user]);

  const loadSentInvites = useCallback(async (notifyOnUpdates = true) => {
    if (!user) return;

    const { data, error, response } = await supabase.functions.invoke('invite', {
      body: { action: 'listSent' },
    });

    if (error) {
      setErrorMessage(await parseFunctionError(error, response));
      return;
    }

    const sentInvites = parseSentInvites((data as { invites?: unknown } | null)?.invites);
    if (!notifyOnUpdates) return;

    const now = Date.now();
    let seenChanged = false;
    sentInvites.forEach((invite) => {
      if (invite.status !== 'accepted' && invite.status !== 'declined') return;
      if (!invite.respondedAt) return;

      const respondedAtMs = Date.parse(invite.respondedAt);
      if (!Number.isFinite(respondedAtMs)) return;
      if (now - respondedAtMs > 7 * 24 * 60 * 60 * 1000) return;

      const reactionKey = `${invite.token}:${invite.status}`;
      if (inviteReactionSeenRef.current.has(reactionKey)) return;

      inviteReactionSeenRef.current.add(reactionKey);
      seenChanged = true;
      const statusLabel = invite.status === 'accepted' ? t`Accepted` : t`Declined`;
      toast(t`Invite update`, {
        description: `${invite.email} ${statusLabel} (${invite.workspaceName})`,
      });
    });

    if (seenChanged && inviteReactionStorageKey && typeof window !== 'undefined') {
      const values = Array.from(inviteReactionSeenRef.current).slice(-400);
      window.localStorage.setItem(inviteReactionStorageKey, JSON.stringify(values));
    }
  }, [inviteReactionStorageKey, user]);

  useEffect(() => {
    if (!inviteReactionStorageKey || typeof window === 'undefined') {
      inviteReactionSeenRef.current = new Set();
      return;
    }

    try {
      const raw = window.localStorage.getItem(inviteReactionStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const values = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
      inviteReactionSeenRef.current = new Set(values);
    } catch (_error) {
      inviteReactionSeenRef.current = new Set();
    }
  }, [inviteReactionStorageKey]);

  useEffect(() => {
    if (!user) {
      setPendingInvites([]);
      setErrorMessage('');
      setLoading(false);
      return;
    }

    void loadPendingInvites(true);
    void loadSentInvites(false);
    const refreshTimer = window.setInterval(() => {
      void loadPendingInvites(false);
      void loadSentInvites(true);
    }, 45000);

    return () => window.clearInterval(refreshTimer);
  }, [loadPendingInvites, loadSentInvites, user]);

  useEffect(() => {
    if (!open || !user) return;
    void loadPendingInvites(true);
    void loadSentInvites(true);
  }, [loadPendingInvites, loadSentInvites, open, user]);

  const handleAccept = useCallback(async (token: string) => {
    const acceptedInvite = pendingInvites.find((invite) => invite.token === token) ?? null;
    setBusyToken(token);
    setErrorMessage('');

    const result = await acceptInvite(token);
    if (result.error) {
      setErrorMessage(result.error);
      setBusyToken(null);
      return;
    }

    setPendingInvites((current) => current.filter((invite) => invite.token !== token));
    await fetchWorkspaces();
    if (!currentWorkspaceId && result.workspaceId) {
      setCurrentWorkspaceId(result.workspaceId);
    }

    toast(t`Workspace joined`, {
      description: acceptedInvite
        ? `${acceptedInvite.workspaceName} (${roleLabel(acceptedInvite.role)})`
        : t`You were added to a new workspace.`,
    });
    setOpen(false);
    setBusyToken(null);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        window.location.reload();
      }, 650);
    }
  }, [acceptInvite, currentWorkspaceId, fetchWorkspaces, pendingInvites, setCurrentWorkspaceId]);

  const handleDecline = useCallback(async (token: string) => {
    setBusyToken(token);
    setErrorMessage('');

    const { error, response } = await supabase.functions.invoke('invite', {
      body: { action: 'decline', token },
    });

    if (error) {
      setErrorMessage(await parseFunctionError(error, response));
      setBusyToken(null);
      return;
    }

    setPendingInvites((current) => current.filter((invite) => invite.token !== token));
    setBusyToken(null);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label={t`Invites`}>
          <Bell className="h-4 w-4" />
          {hasPending && (
            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {badgeLabel}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="border-b px-4 py-3 text-sm font-semibold">{t`Invites`}</div>
        <div className="max-h-[360px] overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t`Loading data...`}</p>
          ) : pendingInvites.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t`No pending invites.`}</p>
          ) : (
            <div className="space-y-3">
              {pendingInvites.map((invite) => {
                const inviter = invite.inviterDisplayName || invite.inviterEmail || t`Unknown user`;
                const isBusy = busyToken === invite.token;
                return (
                  <div key={invite.token} className="rounded-md border p-3">
                    <div className="text-sm font-medium">{invite.workspaceName}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{t`Role`}: {roleLabel(invite.role)}</div>
                    <div className="text-xs text-muted-foreground">{t`Invited by`}: {inviter}</div>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        size="sm"
                        className="h-8 px-3"
                        onClick={() => void handleAccept(invite.token)}
                        disabled={isBusy}
                      >
                        {t`Accept`}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3"
                        onClick={() => void handleDecline(invite.token)}
                        disabled={isBusy}
                      >
                        {t`Decline`}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {errorMessage && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errorMessage}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
