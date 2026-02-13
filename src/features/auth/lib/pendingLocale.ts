import { isSupportedLocale, type Locale } from '@/shared/lib/locale';

const PENDING_LOCALE_KEY = 'auth.pendingLocale';

export const setPendingLocale = (locale: Locale) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PENDING_LOCALE_KEY, locale);
};

export const getPendingLocale = (): Locale | null => {
  if (typeof window === 'undefined') return null;
  const value = window.sessionStorage.getItem(PENDING_LOCALE_KEY);
  return isSupportedLocale(value) ? value : null;
};

export const clearPendingLocale = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PENDING_LOCALE_KEY);
};
