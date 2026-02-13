import React, { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Pencil } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store/authStore';
import { supabase } from '@/shared/lib/supabaseClient';
import { useLocaleStore } from '@/shared/store/localeStore';
import { localeLabels, type Locale } from '@/shared/lib/locale';
import { t } from '@lingui/macro';

interface AccountSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AccountSettingsDialog: React.FC<AccountSettingsDialogProps> = ({ open, onOpenChange }) => {
  const { user, updateDisplayName, updateLocale, signOut } = useAuthStore();
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const [displayName, setDisplayName] = useState('');
  const [initialDisplayName, setInitialDisplayName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [localeSaving, setLocaleSaving] = useState(false);

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
      const nextDisplayName = data?.display_name ?? '';
      setDisplayName(nextDisplayName);
      setInitialDisplayName(nextDisplayName);
      setIsEditingName(!nextDisplayName.trim());
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
    ?? t`Unknown user`;
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
  const showSave = Boolean(user && isEditingName && isDisplayNameDirty);
  const canCancelEditing = Boolean(initialDisplayName.trim());
  const canEditName = Boolean(user && !loading);
  const languageOptions: Array<{ value: Locale; label: string }> = [
    { value: 'en', label: localeLabels.en },
    { value: 'ru', label: localeLabels.ru },
  ];

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
    setIsEditingName(false);
    setSaved(true);
  };

  const handleLocaleChange = async (value: string) => {
    const nextLocale = value as Locale;
    if (nextLocale === locale) return;
    const previousLocale = locale;
    setError('');
    setLocale(nextLocale);
    if (!user) return;
    setLocaleSaving(true);
    const result = await updateLocale(nextLocale);
    setLocaleSaving(false);
    if (result.error) {
      setError(result.error);
      setLocale(previousLocale);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:w-[480px]">
        <SheetHeader>
          <SheetTitle>{t`Account settings`}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 flex flex-col items-center space-y-4 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground">
            {initials}
          </div>

          <div className="w-full max-w-xs space-y-2">
            {isEditingName ? (
              <>
                <Input
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    setSaved(false);
                  }}
                  placeholder={t`Add your name`}
                  disabled={!user || loading}
                />
                <div className="flex items-center gap-2">
                  {showSave && (
                    <Button onClick={handleSave} disabled={!user || loading} className="w-full">
                      {t`Save`}
                    </Button>
                  )}
                  {canCancelEditing && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setDisplayName(initialDisplayName);
                        setIsEditingName(false);
                        setSaved(false);
                      }}
                      disabled={!canEditName}
                      className="w-full"
                    >
                      {t`Cancel`}
                    </Button>
                  )}
                </div>
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
                    setIsEditingName(true);
                    setSaved(false);
                  }}
                  disabled={!canEditName}
                  aria-label={t`Edit name`}
                >
                  <Pencil className="h-2 w-2" />
                </Button>
              </div>
            )}
          </div>

          <div className="text-sm text-muted-foreground">{signedInLabel}</div>

          <div className="w-full max-w-xs space-y-2 text-left">
            <Label htmlFor="account-language">{t`Language`}</Label>
            <Select value={locale} onValueChange={handleLocaleChange} disabled={localeSaving}>
              <SelectTrigger id="account-language">
                <SelectValue placeholder={t`Select language`} />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}
          {saved && (
            <div className="text-sm text-emerald-600">{t`Saved.`}</div>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => signOut()}
          >
            {t`Sign out`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
