export const SUPPORTED_LOCALES = ["en", "ru"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const isSupportedLocale = (value: unknown): value is Locale =>
  typeof value === "string" && SUPPORTED_LOCALES.includes(value as Locale);

export const localeLabels: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
};
