import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ResponsiveGridLayout, noCompactor, useContainerWidth } from 'react-grid-layout';
import type { Layout, Layouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { ChevronDown, Plus, Settings, User } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/shared/ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
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
import { buildTimeSeriesData, buildWidgetData, shouldUseAssigneeRows } from '@/features/dashboard/lib/dashboardUtils';
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
  const [createDashboardOpen, setCreateDashboardOpen] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [createDashboardError, setCreateDashboardError] = useState('');
  const [renameDashboardOpen, setRenameDashboardOpen] = useState(false);
  const [renameDashboardName, setRenameDashboardName] = useState('');
  const [renameDashboardError, setRenameDashboardError] = useState('');
  const [renameDashboardSaving, setRenameDashboardSaving] = useState(false);
  const [deleteDashboardOpen, setDeleteDashboardOpen] = useState(false);
  const [dashboardDeleting, setDashboardDeleting] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevWorkspaceIdRef = useRef<string | null>(null);
  const { width, containerRef } = useContainerWidth({ measureBeforeMount: true });

  const {
    widgets,
    layouts,
    dashboards,
    dashboardsWorkspaceId,
    currentDashboardId,
    statuses,
    projects,
    assignees,
    milestones,
    loading,
    saving,
    dirty,
    error,
    statsByPeriod,
    loadDashboards,
    setCurrentDashboardId,
    loadDashboard,
    saveDashboard,
    createDashboard,
    deleteDashboard,
    renameDashboard,
    resetDashboardState,
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
  const dashboardStorageKey = currentWorkspaceId
    ? `dashboard-current-${currentWorkspaceId}`
    : 'dashboard-current';
  const currentDashboard = dashboards.find((dashboard) => dashboard.id === currentDashboardId);
  const canCreateDashboard = dashboards.length < 10;
  const canDeleteDashboard = dashboards.length > 1 && Boolean(currentDashboardId);
  const canAddWidget = canEdit && Boolean(currentDashboardId);
  const dashboardsReady = dashboardsWorkspaceId === currentWorkspaceId;
  const hasCurrentDashboard = Boolean(
    currentDashboardId && dashboards.some((dashboard) => dashboard.id === currentDashboardId),
  );
  const isWorkspaceSwitching = Boolean(
    prevWorkspaceIdRef.current
    && currentWorkspaceId
    && prevWorkspaceIdRef.current !== currentWorkspaceId,
  );

  useEffect(() => {
    if (!currentWorkspaceId) return;
    prevWorkspaceIdRef.current = currentWorkspaceId;
  }, [currentWorkspaceId]);

  useEffect(() => {
    if (!currentWorkspaceId || isWorkspaceSwitching) return;
    resetDashboardState();
    loadDashboards(currentWorkspaceId);
    loadFilterOptions(currentWorkspaceId);
    loadMilestones(currentWorkspaceId);
  }, [currentWorkspaceId, isWorkspaceSwitching, loadDashboards, loadFilterOptions, loadMilestones, resetDashboardState]);

  useEffect(() => {
    if (!currentWorkspaceId || !dashboardsReady) return;
    if (dashboards.length === 0) {
      setCurrentDashboardId(null);
      return;
    }
    if (isWorkspaceSwitching) return;
    if (!currentDashboardId || !dashboards.some((dashboard) => dashboard.id === currentDashboardId)) {
      let nextId: string | null = null;
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem(dashboardStorageKey);
        if (saved && dashboards.some((dashboard) => dashboard.id === saved)) {
          nextId = saved;
        }
      }
      if (!nextId) {
        nextId = dashboards[0]?.id ?? null;
      }
      setCurrentDashboardId(nextId);
      return;
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(dashboardStorageKey, currentDashboardId);
    }
  }, [
    currentDashboardId,
    currentWorkspaceId,
    dashboardStorageKey,
    dashboards,
    dashboardsReady,
    isWorkspaceSwitching,
    setCurrentDashboardId,
  ]);

  useEffect(() => {
    if (!currentWorkspaceId || isWorkspaceSwitching || !dashboardsReady) return;
    if (!currentDashboardId || !hasCurrentDashboard) return;
    loadDashboard(currentWorkspaceId, currentDashboardId);
  }, [
    currentDashboardId,
    currentWorkspaceId,
    dashboardsReady,
    hasCurrentDashboard,
    isWorkspaceSwitching,
    loadDashboard,
  ]);

  useEffect(() => {
    if (!showSettings || !currentWorkspaceId || isWorkspaceSwitching) return;
    loadWorkspaceData(currentWorkspaceId);
  }, [currentWorkspaceId, isWorkspaceSwitching, loadWorkspaceData, showSettings]);

  useEffect(() => {
    if (createDashboardOpen) return;
    setNewDashboardName('');
    setCreateDashboardError('');
  }, [createDashboardOpen]);

  useEffect(() => {
    if (renameDashboardOpen) return;
    setRenameDashboardName('');
    setRenameDashboardError('');
    setRenameDashboardSaving(false);
  }, [renameDashboardOpen]);

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
    if (!currentWorkspaceId || isWorkspaceSwitching) return;
    const periods = periodsKey ? periodsKey.split('|') : [];
    const seriesPeriods = new Set(seriesPeriodsKey ? seriesPeriodsKey.split('|') : []);
    periods.forEach((period) => loadStats(
      currentWorkspaceId,
      period as DashboardWidget['period'],
      seriesPeriods.has(period),
    ));
  }, [currentWorkspaceId, isWorkspaceSwitching, loadStats, periodsKey, seriesPeriodsKey]);

  useEffect(() => {
    if (!canEdit || !dirty || !currentWorkspaceId || !currentDashboardId || isWorkspaceSwitching) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveDashboard(currentWorkspaceId, currentDashboardId);
    }, 800);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [canEdit, currentDashboardId, dirty, isWorkspaceSwitching, widgets, layouts, currentWorkspaceId, saveDashboard]);

  if (isSuperAdmin) {
    return <Navigate to="/admin/users" replace />;
  }

  if (isWorkspaceSwitching) {
    return <Navigate to="/" replace />;
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
    if (!currentWorkspaceId || !canEdit || !currentDashboardId) return;
    saveDashboard(currentWorkspaceId, currentDashboardId);
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

  const handleCreateDashboard = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateDashboardError('');
    if (!currentWorkspaceId) return;
    if (!canCreateDashboard) {
      setCreateDashboardError('Dashboard limit reached (10).');
      return;
    }
    if (!newDashboardName.trim()) return;
    const result = await createDashboard(currentWorkspaceId, newDashboardName);
    if (result.error) {
      setCreateDashboardError(result.error);
      return;
    }
    setNewDashboardName('');
    setCreateDashboardOpen(false);
  };

  const handleDeleteDashboard = async () => {
    if (!currentDashboardId) return;
    setDashboardDeleting(true);
    await deleteDashboard(currentDashboardId);
    setDashboardDeleting(false);
    setDeleteDashboardOpen(false);
  };

  const handleRenameDashboard = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentDashboardId) return;
    const trimmed = renameDashboardName.trim();
    if (!trimmed) return;
    if (trimmed === (currentDashboard?.name ?? '').trim()) {
      setRenameDashboardOpen(false);
      return;
    }
    setRenameDashboardSaving(true);
    setRenameDashboardError('');
    const result = await renameDashboard(currentDashboardId, trimmed);
    if (result.error) {
      setRenameDashboardError(result.error);
      setRenameDashboardSaving(false);
      return;
    }
    setRenameDashboardSaving(false);
    setRenameDashboardOpen(false);
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
    const useAssigneeRows = shouldUseAssigneeRows(widget);
    const rows = useAssigneeRows ? statsState?.rows : (statsState?.rowsBase ?? statsState?.rows);
    const seriesRows = useAssigneeRows ? statsState?.seriesRows : (statsState?.seriesRowsBase ?? statsState?.seriesRows);
    const data = statsState && isTaskWidget
      ? (widget.type === 'line' || widget.type === 'area'
        ? buildTimeSeriesData(seriesRows ?? [], widget, statuses, projects)
        : buildWidgetData(rows ?? [], widget, statuses, projects))
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
            <Button size="sm" className="gap-2" onClick={handleAddWidget} disabled={!canAddWidget}>
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
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <span className="max-w-[220px] truncate">
                      {currentDashboard?.name ?? 'Select dashboard'}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Dashboards</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={currentDashboardId ?? ''}
                    onValueChange={(value) => setCurrentDashboardId(value)}
                  >
                    {dashboards.map((dashboard) => (
                      <DropdownMenuRadioItem
                        key={dashboard.id}
                        value={dashboard.id}
                        className="data-[state=checked]:bg-zinc-800 data-[state=checked]:text-white"
                      >
                        <span className="truncate">{dashboard.name}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      setCreateDashboardOpen(true);
                    }}
                    disabled={!canEdit || !canCreateDashboard}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New dashboard
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    title="Dashboard settings"
                    aria-label="Dashboard settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    setRenameDashboardName(currentDashboard?.name ?? '');
                    setRenameDashboardError('');
                    setRenameDashboardOpen(true);
                  }}
                  disabled={!canEdit || !currentDashboardId}
                >
                  Rename dashboard
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    setDeleteDashboardOpen(true);
                  }}
                    disabled={!canEdit || !canDeleteDashboard}
                    className="text-destructive focus:text-destructive"
                  >
                    Delete dashboard
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {loading && (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading dashboard...
              </div>
            )}
            {!loading && widgets.length === 0 && (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {!currentDashboardId
                  ? 'Create or select a dashboard to get started.'
                  : canEdit
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
          <ContextMenuItem onSelect={handleAddWidget} disabled={!canAddWidget}>
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
      <Dialog open={createDashboardOpen} onOpenChange={setCreateDashboardOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>New dashboard</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDashboard} className="space-y-4">
            <div className="space-y-1">
              <Label>Dashboard name</Label>
              <Input
                placeholder="Enter dashboard name..."
                value={newDashboardName}
                onChange={(event) => setNewDashboardName(event.target.value)}
              />
            </div>
            {createDashboardError && (
              <div className="text-sm text-destructive">{createDashboardError}</div>
            )}
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setCreateDashboardOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canEdit || !newDashboardName.trim() || !canCreateDashboard}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={renameDashboardOpen} onOpenChange={setRenameDashboardOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Rename dashboard</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenameDashboard} className="space-y-4">
            <div className="space-y-1">
              <Label>Dashboard name</Label>
              <Input
                placeholder="Enter dashboard name..."
                value={renameDashboardName}
                onChange={(event) => setRenameDashboardName(event.target.value)}
              />
            </div>
            {renameDashboardError && (
              <div className="text-sm text-destructive">{renameDashboardError}</div>
            )}
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setRenameDashboardOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !canEdit
                  || !renameDashboardName.trim()
                  || renameDashboardSaving
                  || renameDashboardName.trim() === (currentDashboard?.name ?? '').trim()
                }
              >
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={deleteDashboardOpen}
        onOpenChange={(open) => {
          setDeleteDashboardOpen(open);
          if (!open) {
            setDashboardDeleting(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete dashboard?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{currentDashboard?.name ?? 'this dashboard'}". Widgets and layouts will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={dashboardDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDashboard} disabled={dashboardDeleting || !canDeleteDashboard}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <SettingsPanel open={showSettings} onOpenChange={setShowSettings} />
      <AccountSettingsDialog open={showAccountSettings} onOpenChange={setShowAccountSettings} />
    </div>
  );
};

export default DashboardPage;
