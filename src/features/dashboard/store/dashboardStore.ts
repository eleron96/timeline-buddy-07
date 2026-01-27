import { create } from 'zustand';
import { supabase } from '@/shared/lib/supabaseClient';
import { getAdminUserId } from '@/shared/lib/adminConfig';
import {
  DashboardLayouts,
  DashboardLayoutItem,
  DashboardPeriod,
  DashboardOption,
  DashboardStatus,
  DashboardStatsRow,
  DashboardWidget,
  DashboardWidgetSize,
} from '@/features/dashboard/types/dashboard';
import { createWidgetId, getPeriodRange, DEFAULT_BAR_PALETTE } from '@/features/dashboard/lib/dashboardUtils';

const DASHBOARD_BREAKPOINTS = { lg: 1200, md: 992, sm: 768, xs: 480 };
const DASHBOARD_COLS = { lg: 12, md: 10, sm: 6, xs: 2 };

type DashboardStatsState = {
  rows: DashboardStatsRow[];
  loading: boolean;
  error: string | null;
  lastLoaded: number | null;
};

type DashboardState = {
  widgets: DashboardWidget[];
  layouts: DashboardLayouts;
  statuses: DashboardStatus[];
  projects: DashboardOption[];
  assignees: DashboardOption[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  dirty: boolean;
  statsByPeriod: Record<DashboardPeriod, DashboardStatsState>;
  loadDashboard: (workspaceId: string) => Promise<void>;
  saveDashboard: (workspaceId: string) => Promise<void>;
  addWidget: (widget: DashboardWidget) => void;
  updateWidget: (id: string, updates: Partial<DashboardWidget>) => void;
  removeWidget: (id: string) => void;
  setLayouts: (layouts: DashboardLayouts) => void;
  loadFilterOptions: (workspaceId: string) => Promise<void>;
  loadStats: (workspaceId: string, period: DashboardPeriod) => Promise<void>;
};

const SIZE_PRESETS: Record<DashboardWidgetSize, { w: number; h: number }> = {
  small: { w: 3, h: 2 },
  medium: { w: 6, h: 4 },
  large: { w: 12, h: 6 },
};

const getDefaultSize = (widget: DashboardWidget) => (widget.type === 'kpi' ? 'small' : 'medium');

const getSizeForCols = (size: DashboardWidgetSize, cols: number) => ({
  w: Math.min(SIZE_PRESETS[size].w, cols),
  h: SIZE_PRESETS[size].h,
});

const getLayoutBounds = (cols: number) => {
  const min = getSizeForCols('small', cols);
  const max = getSizeForCols('large', cols);
  return {
    minW: min.w,
    minH: min.h,
    maxW: max.w,
    maxH: max.h,
  };
};

const getWidgetLayoutSize = (widget: DashboardWidget, cols: number) => {
  const size = widget.size ?? getDefaultSize(widget);
  const base = getSizeForCols(size, cols);
  const bounds = getLayoutBounds(cols);
  return { ...base, ...bounds };
};

const hasCollision = (item: DashboardLayoutItem, others: DashboardLayoutItem[]) => (
  others.some((other) => (
    item.x < other.x + other.w
    && item.x + item.w > other.x
    && item.y < other.y + other.h
    && item.y + item.h > other.y
  ))
);

const findAvailablePosition = (
  layout: DashboardLayoutItem[],
  size: Pick<DashboardLayoutItem, 'w' | 'h'>,
  cols: number,
) => {
  const maxY = layout.reduce((acc, item) => Math.max(acc, item.y + item.h), 0);
  const maxX = Math.max(cols - size.w, 0);
  for (let y = 0; y <= maxY + size.h; y += 1) {
    for (let x = 0; x <= maxX; x += 1) {
      const candidate: DashboardLayoutItem = { i: 'candidate', x, y, w: size.w, h: size.h };
      if (!hasCollision(candidate, layout)) {
        return { x, y };
      }
    }
  }
  return { x: 0, y: maxY };
};

const getClosestWidgetSize = (w: number, h: number, cols: number): DashboardWidgetSize => {
  const candidates = (Object.keys(SIZE_PRESETS) as DashboardWidgetSize[]).map((size) => {
    const preset = getSizeForCols(size, cols);
    const distance = Math.abs(preset.w - w) + Math.abs(preset.h - h);
    return { size, distance };
  });
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0]?.size ?? 'small';
};

const buildStackedLayout = (widgets: DashboardWidget[], cols: number) => {
  let y = 0;
  return widgets.map((widget) => {
    const size = getWidgetLayoutSize(widget, cols);
    const item: DashboardLayoutItem = {
      i: widget.id,
      x: 0,
      y,
      w: size.w,
      h: size.h,
      minW: size.minW,
      minH: size.minH,
      maxW: size.maxW,
      maxH: size.maxH,
    };
    y += size.h;
    return item;
  });
};

const buildDefaultLayouts = (widgets: DashboardWidget[]): DashboardLayouts => {
  const lgLayout: DashboardLayoutItem[] = [];
  let x = 0;
  widgets.forEach((widget) => {
    const size = getWidgetLayoutSize(widget, DASHBOARD_COLS.lg);
    if (widget.type === 'kpi') {
      lgLayout.push({
        i: widget.id,
        x,
        y: 0,
        w: size.w,
        h: size.h,
        minW: size.minW,
        minH: size.minH,
        maxW: size.maxW,
        maxH: size.maxH,
      });
      x += size.w;
    } else {
      lgLayout.push({
        i: widget.id,
        x: 0,
        y: 2,
        w: size.w,
        h: size.h,
        minW: size.minW,
        minH: size.minH,
        maxW: size.maxW,
        maxH: size.maxH,
      });
    }
  });

  return {
    lg: lgLayout,
    md: buildStackedLayout(widgets, DASHBOARD_COLS.md),
    sm: buildStackedLayout(widgets, DASHBOARD_COLS.sm),
    xs: buildStackedLayout(widgets, DASHBOARD_COLS.xs),
  };
};

const createDefaultWidgets = (): DashboardWidget[] => [];

const normalizeWidget = (widget: Partial<DashboardWidget>): DashboardWidget => {
  const type = widget.type ?? 'kpi';
  const normalized: DashboardWidget = {
    id: widget.id ?? createWidgetId(),
    title: widget.title ?? 'Widget',
    type,
    period: widget.period ?? 'week',
    groupBy: widget.groupBy ?? 'none',
    size: widget.size ?? (type === 'kpi' ? 'small' : 'medium'),
    barPalette: widget.barPalette ?? (type === 'bar' ? DEFAULT_BAR_PALETTE : undefined),
    statusFilter: widget.statusFilter ?? 'all',
    statusIds: widget.statusIds ?? [],
    includeUnassigned: widget.includeUnassigned ?? true,
    filterGroups: widget.filterGroups ?? [],
  };
  return normalized;
};

const applyWidgetSize = (layouts: DashboardLayouts, widget: DashboardWidget): DashboardLayouts => {
  const nextLayouts: DashboardLayouts = {};
  Object.entries(DASHBOARD_COLS).forEach(([breakpoint, cols]) => {
    const currentLayout = layouts[breakpoint] ?? [];
    const otherItems = currentLayout.filter((item) => item.i !== widget.id);
    const size = getWidgetLayoutSize(widget, cols);
    nextLayouts[breakpoint] = currentLayout.map((item) => {
      if (item.i !== widget.id) return item;
      const nextItem = {
        ...item,
        w: size.w,
        h: size.h,
        minW: size.minW,
        minH: size.minH,
        maxW: size.maxW,
        maxH: size.maxH,
      };
      if (!hasCollision(nextItem, otherItems)) return nextItem;
      const maxY = otherItems.reduce((acc, other) => Math.max(acc, other.y + other.h), 0);
      return { ...nextItem, y: maxY };
    });
  });
  return nextLayouts;
};

const addWidgetToLayouts = (layouts: DashboardLayouts, widget: DashboardWidget) => {
  const nextLayouts: DashboardLayouts = {};
  Object.entries(DASHBOARD_COLS).forEach(([breakpoint, cols]) => {
    const currentLayout = layouts[breakpoint] ?? [];
    const size = getWidgetLayoutSize(widget, cols);
    const position = findAvailablePosition(currentLayout, size, cols);
    const item: DashboardLayoutItem = {
      i: widget.id,
      x: position.x,
      y: position.y,
      w: size.w,
      h: size.h,
      minW: size.minW,
      minH: size.minH,
      maxW: size.maxW,
      maxH: size.maxH,
    };
    nextLayouts[breakpoint] = [...currentLayout, item];
  });
  return nextLayouts;
};

const normalizeLayouts = (layouts: DashboardLayouts, widgets: DashboardWidget[]) => {
  const widgetIds = new Set(widgets.map((widget) => widget.id));
  const widgetMap = new Map(widgets.map((widget) => [widget.id, widget]));
  const normalized: DashboardLayouts = {};

  Object.entries(DASHBOARD_COLS).forEach(([breakpoint, cols]) => {
    const currentLayout = (layouts[breakpoint] ?? []).filter((item) => widgetIds.has(item.i));
    const existingIds = new Set(currentLayout.map((item) => item.i));
    const missingWidgets = widgets.filter((widget) => !existingIds.has(widget.id));
    const layoutWithAll = missingWidgets.reduce((acc, widget) => {
      const size = getWidgetLayoutSize(widget, cols);
      const position = findAvailablePosition(acc, size, cols);
      const item: DashboardLayoutItem = {
        i: widget.id,
        x: position.x,
        y: position.y,
        w: size.w,
        h: size.h,
        minW: size.minW,
        minH: size.minH,
        maxW: size.maxW,
        maxH: size.maxH,
      };
      return [...acc, item];
    }, currentLayout);

    normalized[breakpoint] = layoutWithAll.map((item) => {
      const widget = widgetMap.get(item.i);
      const size = widget ? getWidgetLayoutSize(widget, cols) : getLayoutBounds(cols);
      return {
        ...item,
        w: Math.min(item.w, cols),
        minW: size.minW,
        minH: size.minH,
        maxW: size.maxW,
        maxH: size.maxH,
      };
    });
  });

  return normalized;
};

const emptyStatsState: DashboardStatsState = {
  rows: [],
  loading: false,
  error: null,
  lastLoaded: null,
};

export const useDashboardStore = create<DashboardState>((set, get) => ({
  widgets: [],
  layouts: {},
  statuses: [],
  projects: [],
  assignees: [],
  loading: false,
  saving: false,
  error: null,
  dirty: false,
  statsByPeriod: {
    day: { ...emptyStatsState },
    week: { ...emptyStatsState },
    month: { ...emptyStatsState },
  },
  loadDashboard: async (workspaceId) => {
    set({
      loading: true,
      error: null,
      statsByPeriod: {
        day: { ...emptyStatsState },
        week: { ...emptyStatsState },
        month: { ...emptyStatsState },
      },
    });
    const { data, error } = await supabase
      .from('workspace_dashboards')
      .select('layouts, widgets')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (error && (error as { code?: string }).code !== 'PGRST116') {
      set({ loading: false, error: error.message });
      return;
    }

    if (!data) {
      const widgets = createDefaultWidgets();
      const layouts = buildDefaultLayouts(widgets);
      set({ widgets, layouts, loading: false, dirty: false });
      return;
    }

    const widgets = Array.isArray(data.widgets)
      ? (data.widgets as Array<Partial<DashboardWidget>>).map(normalizeWidget)
      : createDefaultWidgets();
    const layouts = data.layouts && typeof data.layouts === 'object'
      ? (data.layouts as DashboardLayouts)
      : buildDefaultLayouts(widgets);
    set({
      widgets,
      layouts: widgets.reduce(
        (acc, widget) => applyWidgetSize(acc, widget),
        normalizeLayouts(layouts, widgets),
      ),
      loading: false,
      dirty: false,
    });
  },
  saveDashboard: async (workspaceId) => {
    const { widgets, layouts } = get();
    set({ saving: true, error: null });
    const { error } = await supabase
      .from('workspace_dashboards')
      .upsert({ workspace_id: workspaceId, widgets, layouts }, { onConflict: 'workspace_id' });
    if (error) {
      set({ saving: false, error: error.message });
      return;
    }
    set({ saving: false, dirty: false });
  },
  addWidget: (widget) => set((state) => {
    const normalized = normalizeWidget(widget);
    return {
      widgets: [...state.widgets, normalized],
      layouts: addWidgetToLayouts(state.layouts, normalized),
      dirty: true,
    };
  }),
  updateWidget: (id, updates) => set((state) => ({
    widgets: state.widgets.map((widget) => (widget.id === id ? { ...widget, ...updates } : widget)),
    layouts: (() => {
      const current = state.widgets.find((widget) => widget.id === id);
      if (!current) return state.layouts;
      const nextWidget = { ...current, ...updates };
      if (!('size' in updates)) return state.layouts;
      return applyWidgetSize(state.layouts, nextWidget);
    })(),
    dirty: true,
  })),
  removeWidget: (id) => set((state) => ({
    widgets: state.widgets.filter((widget) => widget.id !== id),
    layouts: Object.fromEntries(
      Object.entries(state.layouts).map(([breakpoint, layout]) => [
        breakpoint,
        layout.filter((item) => item.i !== id),
      ]),
    ),
    dirty: true,
  })),
  setLayouts: (layouts) => set((state) => ({
    layouts: normalizeLayouts(layouts, state.widgets),
    dirty: true,
  })),
  loadFilterOptions: async (workspaceId) => {
    const [statusesRes, projectsRes, assigneesRes] = await Promise.all([
      supabase
        .from('statuses')
        .select('id, name, color, is_final')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true }),
      supabase
        .from('projects')
        .select('id, name')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true }),
      supabase
        .from('assignees')
        .select('id, name, user_id')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true }),
    ]);

    if (statusesRes.error || projectsRes.error || assigneesRes.error) {
      set({
        error: statusesRes.error?.message
          || projectsRes.error?.message
          || assigneesRes.error?.message
          || 'Failed to load filter options.',
      });
      return;
    }

    const adminUserId = await getAdminUserId();
    const statuses = (statusesRes.data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      color: row.color as string,
      isFinal: Boolean(row.is_final),
    }));
    const projects = (projectsRes.data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
    }));
    const assignees = (assigneesRes.data ?? [])
      .filter((row) => (adminUserId ? row.user_id !== adminUserId : true))
      .map((row) => ({
        id: row.id as string,
        name: row.name as string,
      }));

    set({ statuses, projects, assignees });
  },
  loadStats: async (workspaceId, period) => {
    const current = get().statsByPeriod[period];
    if (current.loading) return;
    set((state) => ({
      statsByPeriod: {
        ...state.statsByPeriod,
        [period]: { ...state.statsByPeriod[period], loading: true, error: null },
      },
    }));
    const { startDate, endDate } = getPeriodRange(period);
    const { data, error } = await supabase
      .rpc('dashboard_task_counts', {
        p_workspace_id: workspaceId,
        p_start_date: startDate,
        p_end_date: endDate,
      });
    if (error) {
      set((state) => ({
        statsByPeriod: {
          ...state.statsByPeriod,
          [period]: { ...state.statsByPeriod[period], loading: false, error: error.message },
        },
      }));
      return;
    }
    const rows = (data ?? []).map((row: DashboardStatsRow & { total: number | string }) => ({
      ...row,
      total: Number(row.total),
    }));
    set((state) => ({
      statsByPeriod: {
        ...state.statsByPeriod,
        [period]: {
          rows,
          loading: false,
          error: null,
          lastLoaded: Date.now(),
        },
      },
    }));
  },
}));

export { DASHBOARD_BREAKPOINTS, DASHBOARD_COLS, getClosestWidgetSize };
