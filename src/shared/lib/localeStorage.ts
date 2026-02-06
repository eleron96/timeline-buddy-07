import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from "@/shared/lib/locale";

const STORAGE_KEY = "ui-locale";

export const getStoredLocale = (): Locale => {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isSupportedLocale(stored) ? stored : DEFAULT_LOCALE;
};

export const setStoredLocale = (locale: Locale) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, locale);
};
