const normalizeStatus = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, ' ');

export const getStatusEmoji = (name: string) => {
  const normalized = normalizeStatus(name);
  if (normalized === 'to do' || normalized === 'todo') return '📝';
  if (normalized === 'in progress' || normalized === 'inprogress') return '🚧';
  if (normalized === 'done') return '✅';
  if (normalized === 'отменена' || normalized === 'отменён' || normalized === 'отменен') return '🚫';
  if (normalized === 'cancelled' || normalized === 'canceled') return '🚫';
  return null;
};

export const formatStatusLabel = (name: string) => {
  const trimmed = name.trim();
  if (
    trimmed.startsWith('📝')
    || trimmed.startsWith('🚧')
    || trimmed.startsWith('✅')
    || trimmed.startsWith('🚫')
  ) {
    return name;
  }
  const emoji = getStatusEmoji(name);
  return emoji ? `${emoji} ${name}` : name;
};
