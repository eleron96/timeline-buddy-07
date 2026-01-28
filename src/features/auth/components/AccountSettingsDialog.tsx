import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { useAuthStore } from '@/features/auth/store/authStore';
import { supabase } from '@/shared/lib/supabaseClient';

interface AccountSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AccountSettingsDialog: React.FC<AccountSettingsDialogProps> = ({ open, onOpenChange }) => {
  const { user, updateDisplayName, signOut, isSuperAdmin } = useAuthStore();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [initialDisplayName, setInitialDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [section, setSection] = useState<'profile' | 'session' | 'admin'>('profile');

  useEffect(() => {
    if (!open || !user) return;
    let active = true;

    const loadProfile = async () => {
      setLoading(true);
      setError('');
      setSaved(false);
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();

      if (!active) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setDisplayName(data?.display_name ?? '');
      setInitialDisplayName(data?.display_name ?? '');
      setLoading(false);
    };

    loadProfile();
    return () => {
      active = false;
    };
  }, [open, user]);

  const signedInLabel = user?.email
    ?? user?.user_metadata?.full_name
    ?? user?.user_metadata?.name
    ?? user?.id
    ?? 'Unknown user';

  const canShowAdminTab = isSuperAdmin;
  const isDisplayNameDirty = displayName !== initialDisplayName;
  const showSave = Boolean(user && isDisplayNameDirty);

  useEffect(() => {
    if (!canShowAdminTab && section === 'admin') {
      setSection('profile');
    }
  }, [canShowAdminTab, section]);

  const handleSave = async () => {
    if (!user) return;
    setError('');
    setSaved(false);
    const result = await updateDisplayName(displayName);
    if (result.error) {
      setError(result.error);
      return;
    }
    setInitialDisplayName(displayName);
    setSaved(true);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:w-[480px]">
        <SheetHeader>
          <SheetTitle>Account settings</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
            <Button
              type="button"
              size="sm"
              variant={section === 'profile' ? 'default' : 'ghost'}
              className="px-3"
              onClick={() => setSection('profile')}
            >
              Profile
            </Button>
            <Button
              type="button"
              size="sm"
              variant={section === 'session' ? 'default' : 'ghost'}
              className="px-3"
              onClick={() => setSection('session')}
            >
              Session
            </Button>
            {canShowAdminTab && (
              <Button
                type="button"
                size="sm"
                variant={section === 'admin' ? 'default' : 'ghost'}
                className="px-3"
                onClick={() => setSection('admin')}
              >
                Admin
              </Button>
            )}
          </div>

          <div className="space-y-4 rounded-lg border bg-background p-4">
            {section === 'profile' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="display-name">Display name</Label>
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      setSaved(false);
                    }}
                    placeholder="Your name or alias"
                    disabled={!user || loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    This name is shown to workspace members instead of your email.
                  </p>
                </div>

                {error && (
                  <div className="text-sm text-destructive">{error}</div>
                )}
                {saved && (
                  <div className="text-sm text-emerald-600">Saved.</div>
                )}

                {showSave && (
                  <Button onClick={handleSave} disabled={!user || loading}>
                    Save
                  </Button>
                )}
              </>
            )}

            {section === 'session' && (
              <>
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  Signed in as <span className="font-semibold">{signedInLabel}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => signOut()}
                >
                  Sign out
                </Button>
              </>
            )}

            {section === 'admin' && canShowAdminTab && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  navigate('/admin/users');
                }}
              >
                Admin users
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
