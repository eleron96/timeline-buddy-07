import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ResponsiveGridLayout, noCompactor, useContainerWidth } from 'react-grid-layout';
import type { Layout, Layouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Settings, User, Plus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/shared/ui/context-menu';
import { useAuthStore } from '@/features/auth/store/authStore';
import { WorkspaceSwitcher } from '@/features/workspace/components/WorkspaceSwitcher';
import { WorkspaceNav } from '@/features/workspace/components/WorkspaceNav';
import { SettingsPanel } from '@/features/workspace/components/SettingsPanel';
import { AccountSettingsDialog } from '@/features/auth/components/AccountSettingsDialog';
import {
  useDashboardStore,
  DASHBOARD_BREAKPOINTS,
  DASHBOARD_COLS,
  getClosestWidgetSize,
} from '@/features/dashboard/store/dashboardStore';
import { buildTimeSeriesData, buildWidgetData } from '@/features/dashboard/lib/dashboardUtils';
import { DashboardWidgetCard } from '@/features/dashboard/components/DashboardWidgetCard';
import { WidgetEditorDialog } from '@/features/dashboard/components/WidgetEditorDialog';
import { DashboardLayouts, DashboardWidget } from '@/features/dashboard/types/dashboard';
import { Navigate } from 'react-router-dom';
import { usePlannerStore } from '@/features/planner/store/plannerStore';

const DashboardPage = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);
  const [currentBreakpoint, setCurrentBreakpoint] = useState<keyof typeof DASHBOARD_COLS>('lg');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width, containerRef } = useContainerWidth({ measureBeforeMount: true });

  const {
    widgets,
    layouts,
    statuses,
    projects,
    assignees,
    milestones,
    loading,
    saving,
    dirty,
    error,
    statsByPeriod,
    loadDashboard,
    saveDashboard,
    addWidget,
    updateWidget,
    removeWidget,
    setLayouts,
    loadFilterOptions,
    loadMilestones,
    loadStats,
  } = useDashboardStore();

  const user = useAuthStore((state) => state.user);
  const profileDisplayName = useAuthStore((state) => state.profileDisplayName);
  const currentWorkspaceId = useAuthStore((state) => state.currentWorkspaceId);
  const currentWorkspaceRole = useAuthStore((state) => state.currentWorkspaceRole);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const canEdit = currentWorkspaceRole === 'editor' || currentWorkspaceRole === 'admin';
  const userLabel = profileDisplayName || user?.email || user?.id || '';
  const loadWorkspaceData = usePlannerStore((state) => state.loadWorkspaceData);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    loadDashboard(currentWorkspaceId);
    loadFilterOptions(currentWorkspaceId);
    loadMilestones(currentWorkspaceId);
  }, [currentWorkspaceId, loadDashboard, loadFilterOptions, loadMilestones]);

  useEffect(() => {
    if (!showSettings || !currentWorkspaceId) return;
    loadWorkspaceData(currentWorkspaceId);
  }, [currentWorkspaceId, loadWorkspaceData, showSettings]);

  const taskWidgetPeriods = useMemo(() => (
    widgets
      .filter((widget) => (
        widget.type === 'kpi'
        || widget.type === 'bar'
        || widget.type === 'line'
        || widget.type === 'area'
        || widget.type === 'pie'
      ))
      .map((widget) => widget.period)
  ), [widgets]);

  const periodsKey = useMemo(() => (
    Array.from(new Set(taskWidgetPeriods)).sort().join('|')
  ), [taskWidgetPeriods]);

  const seriesPeriodsKey = useMemo(() => (
    Array.from(
      new Set(
        widgets
          .filter((widget) => widget.type === 'line' || widget.type === 'area')
          .map((widget) => widget.period),
      ),
    )
      .sort()
      .join('|')
  ), [widgets]);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    const periods = periodsKey ? periodsKey.split('|') : [];
    const seriesPeriods = new Set(seriesPeriodsKey ? seriesPeriodsKey.split('|') : []);
    periods.forEach((period) => loadStats(
      currentWorkspaceId,
      period as DashboardWidget['period'],
      seriesPeriods.has(period),
    ));
  }, [currentWorkspaceId, loadStats, periodsKey, seriesPeriodsKey]);

  useEffect(() => {
    if (!canEdit || !dirty || !currentWorkspaceId) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveDashboard(currentWorkspaceId);
    }, 800);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [canEdit, dirty, widgets, layouts, currentWorkspaceId, saveDashboard]);

  if (isSuperAdmin) {
    return <Navigate to="/admin/users" replace />;
  }

  const handleLayoutChange = (_layout: Layout[], allLayouts: Layouts) => {
    if (!canEdit) return;
    setLayouts(allLayouts as DashboardLayouts);
  };

  const handleResizeStop = () => {
    if (!canEdit) return;
    if (typeof window !== 'undefined') {
      window.getSelection?.()?.removeAllRanges();
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const handleBreakpointChange = (breakpoint: string) => {
    if (breakpoint in DASHBOARD_COLS) {
      setCurrentBreakpoint(breakpoint as keyof typeof DASHBOARD_COLS);
    }
  };

  const persistDashboard = () => {
    if (!currentWorkspaceId || !canEdit) return;
    saveDashboard(currentWorkspaceId);
  };

  const handleAddWidget = () => {
    setEditingWidget(null);
    setEditorOpen(true);
  };

  const handleEditWidget = (widget: DashboardWidget) => {
    setEditingWidget(widget);
    setEditorOpen(true);
  };

  const handleSaveWidget = (widget: DashboardWidget) => {
    if (editingWidget) {
      updateWidget(widget.id, widget);
      persistDashboard();
    } else {
      addWidget(widget);
      persistDashboard();
    }
  };

  const handleRemoveWidget = (widgetId: string) => {
    removeWidget(widgetId);
    persistDashboard();
  };

  const renderWidget = (widget: DashboardWidget) => {
    const cols = DASHBOARD_COLS[currentBreakpoint] ?? DASHBOARD_COLS.lg;
    const layoutItem = (layouts[currentBreakpoint] ?? []).find((item) => item.i === widget.id);
    const effectiveSize = layoutItem
      ? getClosestWidgetSize(layoutItem.w, layoutItem.h, cols, widget.type)
      : (widget.size ?? (widget.type === 'kpi' ? 'small' : 'medium'));
    const statsState = statsByPeriod[widget.period];
    const isTaskWidget = widget.type === 'kpi'
      || widget.type === 'bar'
      || widget.type === 'line'
      || widget.type === 'area'
      || widget.type === 'pie';
    const data = statsState && isTaskWidget
      ? (widget.type === 'line' || widget.type === 'area'
        ? buildTimeSeriesData(statsState.seriesRows ?? [], widget, statuses)
        : buildWidgetData(statsState.rows ?? [], widget, statuses))
      : null;
    const loading = isTaskWidget ? (statsState?.loading ?? false) : false;
    const widgetError = isTaskWidget ? (statsState?.error ?? null) : null;
    const widgetWithSize = { ...widget, size: effectiveSize };
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="h-full w-full" onContextMenu={(event) => event.stopPropagation()}>
            <DashboardWidgetCard
              widget={widgetWithSize}
              data={data}
              loading={loading}
              error={widgetError}
              editing={canEdit}
              milestones={milestones}
              projects={projects}
              onEdit={() => handleEditWidget(widget)}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => handleEditWidget(widget)} disabled={!canEdit}>
            Filter settings
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => handleRemoveWidget(widget.id)}
            disabled={!canEdit}
            className="text-destructive focus:text-destructive"
          >
            Remove widget
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <WorkspaceSwitcher />
          <WorkspaceNav />
        </div>

        <div className="flex items-center gap-2">
          {userLabel && (
            <span className="max-w-[220px] truncate text-xs text-muted-foreground" title={userLabel}>
              {userLabel}
            </span>
          )}
          {canEdit && (
            <Button size="sm" className="gap-2" onClick={handleAddWidget}>
              <Plus className="h-4 w-4" />
              Widget
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSettings(true)}
            className="h-9 w-9"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowAccountSettings(true)}
            className="h-9 w-9"
          >
            <User className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex items-center justify-between px-4 py-2 border-b border-border text-xs text-muted-foreground">
        <div>
          {saving && 'Saving...'}
          {!saving && dirty && canEdit && 'Unsaved changes'}
          {!saving && !dirty && canEdit && 'All changes saved'}
        </div>
        {error && <div className="text-destructive">{error}</div>}
      </div>

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div ref={containerRef} className="flex-1 overflow-auto p-4">
            {loading && (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading dashboard...
              </div>
            )}
            {!loading && widgets.length === 0 && (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {canEdit
                  ? 'Right-click to add your first widget.'
                  : 'No widgets yet.'}
              </div>
            )}
            {!loading && widgets.length > 0 && (
              <ResponsiveGridLayout
                layouts={layouts}
                breakpoints={DASHBOARD_BREAKPOINTS}
                cols={DASHBOARD_COLS}
                width={width}
                rowHeight={80}
                margin={[16, 16]}
                isResizable={canEdit}
                isDraggable={canEdit}
                onLayoutChange={handleLayoutChange}
                onResizeStop={handleResizeStop}
                onBreakpointChange={handleBreakpointChange}
                draggableHandle=".dashboard-widget-handle"
                measureBeforeMount={false}
                compactor={noCompactor}
                resizeHandles={['se']}
              >
                {widgets.map((widget) => (
                  <div key={widget.id} className="dashboard-grid-item h-full w-full">
                    {renderWidget(widget)}
                  </div>
                ))}
              </ResponsiveGridLayout>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={handleAddWidget} disabled={!canEdit}>
            Add widget
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <WidgetEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        statuses={statuses}
        projects={projects}
        assignees={assignees}
        initialWidget={editingWidget}
        onSave={handleSaveWidget}
      />
      <SettingsPanel open={showSettings} onOpenChange={setShowSettings} />
      <AccountSettingsDialog open={showAccountSettings} onOpenChange={setShowAccountSettings} />
    </div>
  );
};

export default DashboardPage;
