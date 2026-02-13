import type { Locale as DateFnsLocale } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import type { Locale } from '@/shared/lib/locale';

export const resolveDateFnsLocale = (locale: Locale): DateFnsLocale => (
  locale === 'ru' ? ru : enUS
);
