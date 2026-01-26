export const reserveAdminEmail = (import.meta.env.VITE_RESERVE_ADMIN_EMAIL ?? '')
  .trim()
  .toLowerCase();

// Кэш для adminUserId, чтобы не делать запросы каждый раз
let adminUserIdCache: string | null | undefined = undefined;

export const getAdminUserId = async (): Promise<string | null> => {
  if (adminUserIdCache !== undefined) {
    return adminUserIdCache;
  }

  if (!reserveAdminEmail) {
    adminUserIdCache = null;
    return null;
  }

  try {
    // Ленивый импорт supabase, чтобы избежать проблем при инициализации
    const { supabase } = await import('./supabaseClient');
    
    // Проверяем, что supabase клиент доступен и инициализирован
    if (!supabase || typeof supabase?.from !== 'function') {
      adminUserIdCache = null;
      return null;
    }

    const { data: adminProfile, error } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', reserveAdminEmail)
      .maybeSingle();
    
    if (error) {
      adminUserIdCache = null;
      return null;
    }
    
    adminUserIdCache = adminProfile?.id ?? null;
    return adminUserIdCache;
  } catch (error) {
    // Тихая обработка ошибок - не ломаем приложение
    adminUserIdCache = null;
    return null;
  }
};
