import type { Locale } from '@/shared/lib/locale';
import changelogEnRaw from '../../../CHANGELOG.en.md?raw';
import changelogRuRaw from '../../../CHANGELOG.md?raw';
import versionRaw from '../../../VERSION?raw';

export type ReleaseNotesSection = {
  title: string;
  items: string[];
};

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;
const UNRELEASED_HEADER_PATTERN = /^##\s+\[Unreleased\]/i;
const VERSION_HEADER_PATTERN = /^##\s+\[[^\]]+\]/i;
const SECTION_HEADER_PATTERN = /^###\s+/;
const ITEM_PATTERN = /^-\s+/;

const normalizeVersion = (raw: string) => {
  const normalized = raw.trim();
  if (!normalized) return '0.0.0';
  if (!VERSION_PATTERN.test(normalized)) return '0.0.0';
  return normalized;
};

const parseUnreleasedSections = (raw: string, locale: Locale): ReleaseNotesSection[] => {
  const lines = raw.split('\n');
  const sections: ReleaseNotesSection[] = [];
  let isInUnreleased = false;
  let currentTitle = locale === 'ru' ? 'Изменения' : 'Changes';
  let currentItems: string[] = [];

  const flushSection = () => {
    if (!currentItems.length) return;
    sections.push({ title: currentTitle, items: currentItems });
    currentItems = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!isInUnreleased) {
      if (UNRELEASED_HEADER_PATTERN.test(line)) {
        isInUnreleased = true;
      }
      return;
    }

    if (VERSION_HEADER_PATTERN.test(line)) {
      flushSection();
      isInUnreleased = false;
      return;
    }

    if (SECTION_HEADER_PATTERN.test(line)) {
      flushSection();
      currentTitle = line.replace(SECTION_HEADER_PATTERN, '').trim();
      return;
    }

    if (ITEM_PATTERN.test(line)) {
      currentItems.push(line.replace(ITEM_PATTERN, '').trim());
    }
  });

  flushSection();
  return sections;
};

export const APP_VERSION = normalizeVersion(versionRaw);

export const getLatestReleaseNotes = (locale: Locale): ReleaseNotesSection[] => {
  const changelogRaw = locale === 'ru' ? changelogRuRaw : changelogEnRaw;
  return parseUnreleasedSections(changelogRaw, locale);
};
