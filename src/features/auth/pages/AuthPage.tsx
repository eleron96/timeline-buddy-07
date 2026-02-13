import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useLocaleStore } from '@/shared/store/localeStore';
import { localeLabels, type Locale } from '@/shared/lib/locale';
import { setPendingLocale } from '@/features/auth/lib/pendingLocale';
import { t } from '@lingui/macro';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, signInWithKeycloak } = useAuthStore();

  const [submitting, setSubmitting] = useState(false);
  const [oauthAttempted, setOauthAttempted] = useState(false);
  const [error, setError] = useState('');
  const [silentOAuth, setSilentOAuth] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem('auth.silentOAuth') === '1';
  });
  const [skipAutoOAuth, setSkipAutoOAuth] = useState(() => {
    if (typeof window === 'undefined') return false;
    const untilRaw = window.sessionStorage.getItem('auth.skipAutoOAuthUntil');
    const until = untilRaw ? Number(untilRaw) : 0;
    if (Number.isFinite(until) && until > Date.now()) return true;
    window.sessionStorage.removeItem('auth.skipAutoOAuthUntil');
    return false;
  });

  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  const oauthError = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const rawError = searchParams.get('error');
    const rawCode = searchParams.get('error_code');
    const rawDescription = searchParams.get('error_description');
    if (!rawError) return '';

    const description = rawDescription
      ? decodeURIComponent(rawDescription.replace(/\+/g, ' '))
      : t`Authentication failed.`;

    return rawCode ? `${rawCode}: ${description}` : description;
  }, [location.search]);

  useEffect(() => {
    if (!oauthError) return;
    setError(oauthError);
    setSubmitting(false);
    setOauthAttempted(true);
    setSilentOAuth(false);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('auth.silentOAuth');
    }
  }, [oauthError]);

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    window.sessionStorage.removeItem('auth.silentOAuth');
    setSilentOAuth(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const redirectTo = (location.state as { redirectTo?: string } | null)?.redirectTo ?? '/';
    navigate(redirectTo, { replace: true });
  }, [location.state, navigate, user]);

  useEffect(() => {
    if (loading || user || oauthAttempted || skipAutoOAuth) return;

    setOauthAttempted(true);
    setSubmitting(true);

    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined;
    signInWithKeycloak(redirectTo)
      .then(({ error: keycloakError }) => {
        if (keycloakError) {
          setError(keycloakError);
          if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem('auth.silentOAuth');
          }
          setSilentOAuth(false);
        }
        setSubmitting(false);
      })
      .catch((authError: unknown) => {
        setError(authError instanceof Error ? authError.message : t`Authentication failed.`);
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem('auth.silentOAuth');
        }
        setSilentOAuth(false);
        setSubmitting(false);
      });
  }, [loading, oauthAttempted, signInWithKeycloak, skipAutoOAuth, user]);

  const handleKeycloakSignIn = async () => {
    setError('');
    setSubmitting(true);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('auth.skipAutoOAuthUntil');
      window.sessionStorage.removeItem('auth.silentOAuth');
    }
    setSkipAutoOAuth(false);
    setSilentOAuth(false);

    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined;
    const { error: keycloakError } = await signInWithKeycloak(redirectTo);
    if (keycloakError) {
      setError(keycloakError);
    }
    setSubmitting(false);
  };

  const handleLocaleChange = (value: string) => {
    const nextLocale = value as Locale;
    setLocale(nextLocale);
    setPendingLocale(nextLocale);
  };

  const hideAuthCard = (silentOAuth || submitting) && !skipAutoOAuth && !user && !oauthError && !error;
  if (hideAuthCard) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t`Welcome`}</CardTitle>
          <CardDescription>{t`Continue with Keycloak to access the workspace.`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">{t`Language`}</div>
            <Select value={locale} onValueChange={handleLocaleChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t`Select language`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{localeLabels.en}</SelectItem>
                <SelectItem value="ru">{localeLabels.ru}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>{t`Authentication error`}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="button" className="w-full" onClick={handleKeycloakSignIn} disabled={loading || submitting}>
            {t`Continue with Keycloak`}
          </Button>

          {skipAutoOAuth && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.sessionStorage.removeItem('auth.skipAutoOAuthUntil');
                }
                setSkipAutoOAuth(false);
                setOauthAttempted(false);
              }}
            >
              {t`Retry automatic sign in`}
            </Button>
          )}

          <div className="text-xs text-muted-foreground">
            {t`Passwords and account recovery are managed in Keycloak.`}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
