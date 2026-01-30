import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { WorkspaceNav } from '@/features/workspace/components/WorkspaceNav';
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
  const [addTaskDefaults, setAddTaskDefaults] = useState<{
    startDate: string;
    endDate: string;
    projectId?: string | null;
    assigneeIds?: string[];
  } | null>(null);
  const loadWorkspaceData = usePlannerStore((state) => state.loadWorkspaceData);
  const plannerLoading = usePlannerStore((state) => state.loading);
  const plannerError = usePlannerStore((state) => state.error);
  const loadedRange = usePlannerStore((state) => state.loadedRange);
  const tasks = usePlannerStore((state) => state.tasks);
  const projects = usePlannerStore((state) => state.projects);
  const assignees = usePlannerStore((state) => state.assignees);
  const statuses = usePlannerStore((state) => state.statuses);
  const taskTypes = usePlannerStore((state) => state.taskTypes);
  const tags = usePlannerStore((state) => state.tags);
  const milestones = usePlannerStore((state) => state.milestones);
  const filters = usePlannerStore((state) => state.filters);
  const setFilters = usePlannerStore((state) => state.setFilters);
  const clearFilterCriteria = usePlannerStore((state) => state.clearFilterCriteria);
  const clearFilters = usePlannerStore((state) => state.clearFilters);
  const viewMode = usePlannerStore((state) => state.viewMode);
  const currentDate = usePlannerStore((state) => state.currentDate);
  const setCurrentDate = usePlannerStore((state) => state.setCurrentDate);
  const requestScrollToDate = usePlannerStore((state) => state.requestScrollToDate);
  const scrollTargetDate = usePlannerStore((state) => state.scrollTargetDate);
  const highlightedTaskId = usePlannerStore((state) => state.highlightedTaskId);
  const setHighlightedTaskId = usePlannerStore((state) => state.setHighlightedTaskId);
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
  const hasInitialData = tasks.length > 0
    || projects.length > 0
    || assignees.length > 0
    || statuses.length > 0
    || taskTypes.length > 0
    || tags.length > 0
    || milestones.length > 0;
  const showLoadingOverlay = plannerLoading && (!loadedRange || loadedRange.workspaceId !== currentWorkspaceId) && !hasInitialData;

  useEffect(() => {
    if (currentWorkspaceId) {
      loadWorkspaceData(currentWorkspaceId);
    }
  }, [currentWorkspaceId, loadWorkspaceData]);

  useEffect(() => {
    if (centeredOnLoadRef.current) return;
    if (viewMode === 'calendar') return;
    const initialDate = scrollTargetDate ?? format(new Date(), 'yyyy-MM-dd');
    setCurrentDate(initialDate);
    requestScrollToDate(initialDate);
    centeredOnLoadRef.current = true;
  }, [requestScrollToDate, scrollTargetDate, setCurrentDate, viewMode]);

  useEffect(() => {
    if (!highlightedTaskId) return;
    const handlePointerDown = () => {
      setHighlightedTaskId(null);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [highlightedTaskId, setHighlightedTaskId]);

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

  const handleCreateTaskRequest = useCallback((defaults: {
    startDate: string;
    endDate: string;
    projectId?: string | null;
    assigneeIds?: string[];
  }) => {
    setAddTaskDefaults(defaults);
    setShowAddTask(true);
  }, []);

  const handleAddTaskOpenChange = useCallback((open: boolean) => {
    setShowAddTask(open);
    if (!open) {
      setAddTaskDefaults(null);
    }
  }, []);

  if (isSuperAdmin) {
    return <Navigate to="/admin/users" replace />;
  }
  
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
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
          <Button
            onClick={() => {
              setAddTaskDefaults(null);
              setShowAddTask(true);
            }}
            className="gap-2"
            disabled={!canEdit}
          >
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
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Filter sidebar */}
        <FilterPanel 
          collapsed={filterCollapsed} 
          onToggle={() => setFilterCollapsed(!filterCollapsed)} 
        />
        
        {/* Timeline area */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <TimelineControls />
          <div className="relative flex-1 overflow-hidden min-h-0">
            {viewMode === 'calendar'
              ? <CalendarTimeline />
              : <TimelineGrid onCreateTask={handleCreateTaskRequest} />
            }
            {showLoadingOverlay && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground bg-background/60">
                Loading workspace...
              </div>
            )}
            {!plannerLoading && plannerError && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive bg-background/70">
                {plannerError}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Panels */}
      <TaskDetailPanel />
      <SettingsPanel open={showSettings} onOpenChange={setShowSettings} />
      <AccountSettingsDialog open={showAccountSettings} onOpenChange={setShowAccountSettings} />
      <AddTaskDialog
        open={showAddTask}
        onOpenChange={handleAddTaskOpenChange}
        initialStartDate={addTaskDefaults?.startDate}
        initialEndDate={addTaskDefaults?.endDate}
        initialProjectId={addTaskDefaults?.projectId}
        initialAssigneeIds={addTaskDefaults?.assigneeIds}
      />
    </div>
  );
};

export default PlannerPage;
