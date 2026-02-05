export const formatProjectLabel = (name: string, code?: string | null) => {
  const trimmedCode = code?.trim();
  if (!trimmedCode) return name;
  return `[${trimmedCode}] ${name}`;
};

