import React, { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Pencil } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store/authStore';
import { supabase } from '@/shared/lib/supabaseClient';

interface AccountSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AccountSettingsDialog: React.FC<AccountSettingsDialogProps> = ({ open, onOpenChange }) => {
  const { user, updateDisplayName, signOut } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [initialDisplayName, setInitialDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

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
  const avatarSource = displayName || signedInLabel;
  const initials = avatarSource
    .split('@')[0]
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
    || 'U';

  const isDisplayNameDirty = displayName !== initialDisplayName;
  const showSave = Boolean(user && isDisplayNameDirty);
  const showNameInput = !displayName.trim();
  const canEditName = Boolean(user && !loading);

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

        <div className="mt-6 flex flex-col items-center space-y-4 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground">
            {initials}
          </div>

          <div className="w-full max-w-xs space-y-2">
            {showNameInput ? (
              <>
                <Input
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    setSaved(false);
                  }}
                  placeholder="Add your name"
                  disabled={!user || loading}
                />
                {showSave && (
                  <Button onClick={handleSave} disabled={!user || loading} className="w-full">
                    Save
                  </Button>
                )}
              </>
            ) : (
              <div className="inline-flex items-start gap-1 text-lg font-semibold text-foreground">
                <span>{displayName}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-3.5 w-3.5 -mt-1 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setDisplayName('');
                    setSaved(false);
                  }}
                  disabled={!canEditName}
                  aria-label="Edit name"
                >
                  <Pencil className="h-2 w-2" />
                </Button>
              </div>
            )}
          </div>

          <div className="text-sm text-muted-foreground">{signedInLabel}</div>

          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}
          {saved && (
            <div className="text-sm text-emerald-600">Saved.</div>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => signOut()}
          >
            Sign out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
