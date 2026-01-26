import React, { useEffect, useRef, useState } from 'react';
import { TimelineGrid } from '@/features/planner/components/timeline/TimelineGrid';
import { CalendarTimeline } from '@/features/planner/components/timeline/CalendarTimeline';
import { TimelineControls } from '@/features/planner/components/timeline/TimelineControls';
import { FilterPanel } from '@/features/planner/components/FilterPanel';
import { TaskDetailPanel } from '@/features/planner/components/TaskDetailPanel';
import { SettingsPanel } from '@/features/workspace/components/SettingsPanel';
import { AccountSettingsDialog } from '@/features/auth/components/AccountSettingsDialog';
import { AddTaskDialog } from '@/features/planner/components/AddTaskDialog';
import { Button } from '@/shared/ui/button';
import { Plus, Settings, User } from 'lucide-react';
import { usePlannerStore } from '@/features/planner/store/plannerStore';
import { useAuthStore } from '@/features/auth/store/authStore';
import { WorkspaceSwitcher } from '@/features/workspace/components/WorkspaceSwitcher';
import { Filters } from '@/features/planner/types/planner';
import { format } from 'date-fns';
import { Navigate } from 'react-router-dom';

const normalizeFilterIds = (value: unknown) => (
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
);

const normalizeFilters = (value: unknown): Filters => {
  const candidate = value && typeof value === 'object' ? (value as Partial<Filters>) : {};
  return {
    projectIds: normalizeFilterIds(candidate.projectIds),
    assigneeIds: normalizeFilterIds(candidate.assigneeIds),
    statusIds: normalizeFilterIds(candidate.statusIds),
    typeIds: normalizeFilterIds(candidate.typeIds),
    tagIds: normalizeFilterIds(candidate.tagIds),
    hideUnassigned: typeof candidate.hideUnassigned === 'boolean' ? candidate.hideUnassigned : false,
  };
};

const PlannerPage = () => {
  const [filterCollapsed, setFilterCollapsed] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const loadWorkspaceData = usePlannerStore((state) => state.loadWorkspaceData);
  const plannerLoading = usePlannerStore((state) => state.loading);
  const plannerError = usePlannerStore((state) => state.error);
  const filters = usePlannerStore((state) => state.filters);
  const setFilters = usePlannerStore((state) => state.setFilters);
  const clearFilterCriteria = usePlannerStore((state) => state.clearFilterCriteria);
  const clearFilters = usePlannerStore((state) => state.clearFilters);
  const viewMode = usePlannerStore((state) => state.viewMode);
  const currentDate = usePlannerStore((state) => state.currentDate);
  const setCurrentDate = usePlannerStore((state) => state.setCurrentDate);
  const requestScrollToDate = usePlannerStore((state) => state.requestScrollToDate);
  const user = useAuthStore((state) => state.user);
  const profileDisplayName = useAuthStore((state) => state.profileDisplayName);
  const currentWorkspaceId = useAuthStore((state) => state.currentWorkspaceId);
  const currentWorkspaceRole = useAuthStore((state) => state.currentWorkspaceRole);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const canEdit = currentWorkspaceRole === 'editor' || currentWorkspaceRole === 'admin';
  const userLabel = profileDisplayName || user?.email || user?.id || '';
  const filtersHydratedRef = useRef(false);
  const centeredOnLoadRef = useRef(false);
  const hasActiveFilters = filters.projectIds.length > 0
    || filters.assigneeIds.length > 0
    || filters.statusIds.length > 0
    || filters.typeIds.length > 0
    || filters.tagIds.length > 0;

  useEffect(() => {
    if (currentWorkspaceId) {
      loadWorkspaceData(currentWorkspaceId);
    }
  }, [currentWorkspaceId, currentDate, loadWorkspaceData, viewMode]);

  useEffect(() => {
    if (centeredOnLoadRef.current) return;
    if (viewMode === 'calendar') return;
    const today = format(new Date(), 'yyyy-MM-dd');
    setCurrentDate(today);
    requestScrollToDate(today);
    centeredOnLoadRef.current = true;
  }, [requestScrollToDate, setCurrentDate, viewMode]);

  useEffect(() => {
    filtersHydratedRef.current = false;
    if (!user?.id || typeof window === 'undefined') return;
    const storageKey = `planner-filters-${user.id}`;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      clearFilters();
      filtersHydratedRef.current = true;
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const nextFilters = normalizeFilters(parsed);
      setFilters(nextFilters);
    } catch (_error) {
      clearFilters();
    } finally {
      filtersHydratedRef.current = true;
    }
  }, [clearFilters, setFilters, user?.id]);

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return;
    if (!filtersHydratedRef.current) return;
    const storageKey = `planner-filters-${user.id}`;
    window.localStorage.setItem(storageKey, JSON.stringify(filters));
  }, [filters, user?.id]);

  if (isSuperAdmin) {
    return <Navigate to="/admin/users" replace />;
  }
  
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <WorkspaceSwitcher />
          <div className="h-6 w-px bg-border" />
          <div className="flex flex-col min-w-0">
            <h1 className="text-xl font-semibold text-foreground">Timeline Planner</h1>
            {userLabel && (
              <span className="text-xs text-muted-foreground truncate" title={userLabel}>
                {userLabel}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowAddTask(true)} className="gap-2" disabled={!canEdit}>
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSettings(true)}
            className="h-9 w-9"
            disabled={!canEdit}
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

      {hasActiveFilters && (
        <div className="flex items-center justify-between px-4 py-2 border-b-2 border-sky-500 bg-sky-50 text-sm text-sky-700">
          <span className="font-medium">Применен фильтр</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilterCriteria}
            className="h-7 px-2 text-sky-700 hover:text-sky-900"
          >
            Сбросить
          </Button>
        </div>
      )}
      
      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Filter sidebar */}
        <FilterPanel 
          collapsed={filterCollapsed} 
          onToggle={() => setFilterCollapsed(!filterCollapsed)} 
        />
        
        {/* Timeline area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <TimelineControls />
          {plannerLoading && (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Loading workspace...
            </div>
          )}
          {!plannerLoading && plannerError && (
            <div className="flex flex-1 items-center justify-center text-sm text-destructive">
              {plannerError}
            </div>
          )}
          {!plannerLoading && !plannerError && (
            viewMode === 'calendar' ? <CalendarTimeline /> : <TimelineGrid />
          )}
        </div>
      </div>
      
      {/* Panels */}
      <TaskDetailPanel />
      <SettingsPanel open={showSettings} onOpenChange={setShowSettings} />
      <AccountSettingsDialog open={showAccountSettings} onOpenChange={setShowAccountSettings} />
      <AddTaskDialog open={showAddTask} onOpenChange={setShowAddTask} />
    </div>
  );
};

export default PlannerPage;
