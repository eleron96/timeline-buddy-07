import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from "@/shared/lib/locale";

const STORAGE_KEY = "ui-locale";

export const getStoredLocalePreference = (): Locale | null => {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isSupportedLocale(stored) ? stored : null;
};

export const getStoredLocale = (): Locale => {
  return getStoredLocalePreference() ?? DEFAULT_LOCALE;
};

export const setStoredLocale = (locale: Locale) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, locale);
};
