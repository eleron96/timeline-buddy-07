const normalizeStatus = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, ' ');

const emojiSegmentRegex = /\p{Extended_Pictographic}/u;

const getLeadingEmoji = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    const iterator = segmenter.segment(trimmed)[Symbol.iterator]();
    const first = iterator.next().value?.segment as string | undefined;
    if (first && emojiSegmentRegex.test(first)) {
      return first;
    }
  }
  const match = trimmed.match(/^(\p{Extended_Pictographic}(?:\uFE0F)?)/u);
  return match ? match[1] : null;
};

export const splitStatusLabel = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return { name: '', emoji: null as string | null };
  const leadingEmoji = getLeadingEmoji(trimmed);
  if (!leadingEmoji) return { name: trimmed, emoji: null as string | null };
  const rest = trimmed.slice(leadingEmoji.length).trimStart();
  return { name: rest, emoji: leadingEmoji };
};

export const stripStatusEmoji = (name: string) => splitStatusLabel(name).name;

export const getStatusEmoji = (name: string) => {
  const normalized = normalizeStatus(name);
  if (normalized === 'to do' || normalized === 'todo') return '📝';
  if (normalized === 'in progress' || normalized === 'inprogress') return '🚧';
  if (normalized === 'done') return '✅';
  if (normalized === 'отмена' || normalized === 'отменена' || normalized === 'отменён' || normalized === 'отменен') return '🚫';
  if (normalized === 'cancelled' || normalized === 'canceled') return '🚫';
  return null;
};

export const formatStatusLabel = (name: string, emoji?: string | null) => {
  const { name: cleanedName, emoji: leadingEmoji } = splitStatusLabel(name);
  const resolvedEmoji = emoji ?? leadingEmoji ?? null;
  if (!resolvedEmoji) return cleanedName;
  return cleanedName ? `${resolvedEmoji} ${cleanedName}` : resolvedEmoji;
};
