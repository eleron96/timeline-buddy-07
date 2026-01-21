export const reserveAdminEmail = (import.meta.env.VITE_RESERVE_ADMIN_EMAIL ?? '')
  .trim()
  .toLowerCase();

export const isReserveAdminEmail = (email?: string | null) => {
  if (!reserveAdminEmail || !email) return false;
  return email.trim().toLowerCase() === reserveAdminEmail;
};
