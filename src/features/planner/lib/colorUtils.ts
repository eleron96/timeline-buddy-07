const normalizeHex = (color: string) => {
  const raw = color.startsWith('#') ? color.slice(1) : color;
  if (raw.length === 3) {
    return raw.split('').map((char) => `${char}${char}`).join('');
  }
  if (raw.length === 6) {
    return raw;
  }
  return null;
};

export const hexToRgba = (color: string, alpha: number) => {
  const hex = normalizeHex(color);
  if (!hex || !/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null;
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
