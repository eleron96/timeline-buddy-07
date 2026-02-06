const LATIN_RE = /^[A-Za-z]/;
const CYRILLIC_RE = /^[А-Яа-яЁё]/;

const getScriptRank = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 3;
  const firstChar = trimmed[0];
  if (LATIN_RE.test(firstChar)) return 0;
  if (CYRILLIC_RE.test(firstChar)) return 1;
  return 2;
};

export const compareNames = (
  left: string,
  right: string,
  direction: 'asc' | 'desc' = 'asc',
) => {
  const leftValue = left ?? '';
  const rightValue = right ?? '';
  const leftRank = getScriptRank(leftValue);
  const rightRank = getScriptRank(rightValue);

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  const locale = leftRank === 0 ? 'en' : leftRank === 1 ? 'ru' : undefined;
  const compare = leftValue.localeCompare(rightValue, locale, { sensitivity: 'base', numeric: true });
  return direction === 'desc' ? -compare : compare;
};
