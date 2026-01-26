// src/features/planner/hooks/useFilteredAssignees.ts
import { useEffect, useMemo, useState } from 'react';
import type { Assignee } from '@/features/planner/types/planner';
import { getAdminUserId } from '@/shared/lib/adminConfig';

/**
 * useFilteredAssignees
 * - Убирает "секретного" администратора из списка assignees
 * - Опционально фильтрует по строке поиска (по имени)
 * - Пока adminUserId не получен, возвращает исходный список (без фильтра админа),
 *   чтобы не ломать UI на старте
 */
export const useFilteredAssignees = (
  assignees: Assignee[] | null | undefined,
  search: string = ''
): Assignee[] => {
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Если это SSR, ничего не делаем
    if (typeof window === 'undefined') return;

    let mounted = true;

    (async () => {
      try {
        const id = await getAdminUserId();
        if (!mounted) return;
        setAdminUserId(id ?? null);
      } catch {
        if (!mounted) return;
        setAdminUserId(null);
      } finally {
        if (!mounted) return;
        setLoaded(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return useMemo(() => {
    if (!assignees || !Array.isArray(assignees)) return [];

    let result = assignees;

    // Фильтр админа применяем только после загрузки adminUserId
    if (loaded && adminUserId) {
      result = result.filter((a) => a.userId !== adminUserId);
    }

    // Опциональный поиск по имени
    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter((a) => (a.name ?? '').toLowerCase().includes(query));
    }

    return result;
  }, [assignees, adminUserId, loaded, search]);
};

export default useFilteredAssignees;
