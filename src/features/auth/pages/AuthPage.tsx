import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Button } from '@/shared/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useLocaleStore } from '@/shared/store/localeStore';
import { localeLabels, type Locale } from '@/shared/lib/locale';
import { t } from '@lingui/macro';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, signIn, signUp, sendPasswordReset, updatePassword, signOut, loading } = useAuthStore();
  const location = useLocation();
  const recoveryTokenPresent = location.hash.includes('type=recovery');
  const [tab, setTab] = useState<'login' | 'register' | 'reset' | 'update'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const languageOptions: Array<{ value: Locale; label: string }> = [
    { value: 'en', label: localeLabels.en },
    { value: 'ru', label: localeLabels.ru },
  ];

  const resetMessages = () => {
    setError('');
    setMessage('');
  };

  const handleLocaleChange = (value: string) => {
    setLocale(value as Locale);
  };
  
  useEffect(() => {
    if (!recoveryTokenPresent) return;
    resetMessages();
    setRecoveryMode(true);
    setTab('update');
  }, [recoveryTokenPresent]);

  useEffect(() => {
    if (user && !recoveryMode && !recoveryTokenPresent) {
      const redirectTo = (location.state as { redirectTo?: string } | null)?.redirectTo ?? '/';
      navigate(redirectTo, { replace: true });
    }
  }, [location.state, navigate, recoveryMode, recoveryTokenPresent, user]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    setSubmitting(true);
    const { error: signInError } = await signIn(email.trim(), password);
    if (signInError) {
      setError(signInError);
    }
    setSubmitting(false);
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    if (password !== confirmPassword) {
      setError(t`Passwords do not match.`);
      return;
    }
    setSubmitting(true);
    const { error: signUpError } = await signUp(email.trim(), password);
    if (signUpError) {
      setError(signUpError);
    } else {
      setMessage(t`Check your email to confirm your account.`);
    }
    setSubmitting(false);
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    if (!email.trim()) {
      setError(t`Email is required.`);
      return;
    }
    setSubmitting(true);
    const { error: resetError } = await sendPasswordReset(email.trim());
    if (resetError) {
      setError(resetError);
    } else {
      setMessage(t`We sent a password reset link to your email.`);
    }
    setSubmitting(false);
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    if (!newPassword.trim()) {
      setError(t`Password is required.`);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError(t`Passwords do not match.`);
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await updatePassword(newPassword);
    if (updateError) {
      setError(updateError);
      setSubmitting(false);
      return;
    }
    await signOut();
    setRecoveryMode(false);
    setNewPassword('');
    setConfirmNewPassword('');
    setTab('login');
    setMessage(t`Password updated. Please sign in again.`);
    navigate('/auth', { replace: true });
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t`Welcome`}</CardTitle>
          <CardDescription>{t`Sign in or create an account to continue.`}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>{t`Authentication error`}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {message && (
            <Alert className="mb-4">
              <AlertTitle>{t`Check your inbox`}</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          <Tabs value={tab} onValueChange={(value) => { resetMessages(); setTab(value as typeof tab); }}>
            {tab !== 'update' && (
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="login">{t`Login`}</TabsTrigger>
                <TabsTrigger value="register">{t`Register`}</TabsTrigger>
                <TabsTrigger value="reset">{t`Reset`}</TabsTrigger>
              </TabsList>
            )}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">{t`Email`}</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">{t`Password`}</Label>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || submitting}>
                  {t`Sign in`}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full text-sm"
                  onClick={() => setTab('reset')}
                >
                  {t`Forgot password?`}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="register-email">{t`Email`}</Label>
                  <Input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">{t`Password`}</Label>
                  <Input
                    id="register-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-confirm">{t`Confirm password`}</Label>
                  <Input
                    id="register-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || submitting}>
                  {t`Create account`}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="reset">
              <form onSubmit={handleResetPassword} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">{t`Email`}</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || submitting}>
                  {t`Send reset link`}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="update">
              <form onSubmit={handleUpdatePassword} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">{t`New password`}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">{t`Confirm new password`}</Label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || submitting}>
                  {t`Update password`}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          <div className="mt-6 space-y-2">
            <Label htmlFor="auth-language">{t`Language`}</Label>
            <Select value={locale} onValueChange={handleLocaleChange}>
              <SelectTrigger id="auth-language">
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
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
