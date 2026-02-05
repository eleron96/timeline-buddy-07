import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { usePlannerStore } from '@/features/planner/store/plannerStore';
import { useAuthStore } from '@/features/auth/store/authStore';
import { WorkspaceSwitcher } from '@/features/workspace/components/WorkspaceSwitcher';
import { WorkspaceNav } from '@/features/workspace/components/WorkspaceNav';
import { SettingsPanel } from '@/features/workspace/components/SettingsPanel';
import { AccountSettingsDialog } from '@/features/auth/components/AccountSettingsDialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Badge } from '@/shared/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Checkbox } from '@/shared/ui/checkbox';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { supabase } from '@/shared/lib/supabaseClient';
import { formatStatusLabel } from '@/shared/lib/statusLabels';
import { cn } from '@/shared/lib/classNames';
import { format, parseISO } from 'date-fns';
import { Settings, User, RefreshCcw } from 'lucide-react';
import { Task } from '@/features/planner/types/planner';
import { WorkspaceMembersPanel } from '@/features/workspace/components/WorkspaceMembersPanel';
import DOMPurify from 'dompurify';

type TaskRow = {
  id: string;
  title: string;
  project_id: string | null;
  assignee_id: string | null;
  assignee_ids: string[] | null;
  start_date: string;
  end_date: string;
  status_id: string;
  type_id: string;
  priority: string | null;
  tag_ids: string[] | null;
  description: string | null;
  repeat_id: string | null;
};

const normalizeAssigneeIds = (assigneeIds: string[] | null | undefined, legacyId: string | null | undefined) => {
  const combined = [
    ...(assigneeIds ?? []),
    ...(legacyId ? [legacyId] : []),
  ];
  return Array.from(new Set(combined.filter(Boolean)));
};

const mapTaskRow = (row: TaskRow): Task => ({
  id: row.id,
  title: row.title,
  projectId: row.project_id,
  assigneeIds: normalizeAssigneeIds(row.assignee_ids, row.assignee_id),
  startDate: row.start_date,
  endDate: row.end_date,
  statusId: row.status_id,
  typeId: row.type_id,
  priority: row.priority as Task['priority'],
  tagIds: row.tag_ids ?? [],
  description: row.description,
  repeatId: row.repeat_id ?? null,
});

const hasRichTags = (value: string) => (
  /<\/?(b|strong|i|em|u|s|strike|ul|ol|li|blockquote|br|div|p|span|img)\b/i.test(value)
);

const sanitizeDescription = (value: string) => (
  DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [
      'b',
      'strong',
      'i',
      'em',
      'u',
      's',
      'strike',
      'ul',
      'ol',
      'li',
      'blockquote',
      'br',
      'div',
      'p',
      'span',
      'img',
    ],
    ALLOWED_ATTR: ['src', 'alt', 'style', 'width', 'height'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|data:image\/)|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  })
);

const MembersPage = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [tab, setTab] = useState<'active' | 'disabled'>('active');
  const [mode, setMode] = useState<'tasks' | 'access'>('tasks');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);
  const [assigneeTasks, setAssigneeTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilterIds, setStatusFilterIds] = useState<string[]>([]);
  const [projectFilterIds, setProjectFilterIds] = useState<string[]>([]);
  const [taskScope, setTaskScope] = useState<'current' | 'past'>('current');
  const [pastFromDate, setPastFromDate] = useState('');
  const [pastToDate, setPastToDate] = useState('');
  const [pastSort, setPastSort] = useState<'start_desc' | 'start_asc' | 'end_desc' | 'end_asc' | 'title_asc' | 'title_desc'>('end_desc');
  const [pageIndex, setPageIndex] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const pageSize = 100;
  const modeToggle = (
    <div className="inline-flex items-center gap-2 rounded-lg bg-muted/60 p-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setMode('tasks')}
        className={cn(
          'h-7 px-3 text-xs rounded-md',
          mode === 'tasks' && 'bg-foreground text-background shadow-sm'
        )}
      >
        Tasks
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setMode('access')}
        className={cn(
          'h-7 px-3 text-xs rounded-md',
          mode === 'access' && 'bg-foreground text-background shadow-sm'
        )}
      >
        Access
      </Button>
    </div>
  );
  const scopeToggle = (
    <div className="inline-flex items-center gap-2 rounded-lg bg-muted/60 p-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setTaskScope('current');
          setPageIndex(1);
        }}
        className={cn(
          'h-7 px-3 text-xs rounded-md',
          taskScope === 'current' && 'bg-foreground text-background shadow-sm'
        )}
      >
        Current
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setTaskScope('past');
          setPageIndex(1);
        }}
        className={cn(
          'h-7 px-3 text-xs rounded-md',
          taskScope === 'past' && 'bg-foreground text-background shadow-sm'
        )}
      >
        Past
      </Button>
    </div>
  );

  const {
    assignees,
    projects,
    statuses,
    taskTypes,
    tags,
    loadWorkspaceData,
    assigneeTaskCounts,
    assigneeCountsDate,
    deleteTasks,
    setHighlightedTaskId,
    setViewMode,
    setCurrentDate,
    requestScrollToDate,
    clearFilters,
  } = usePlannerStore();

  const {
    user,
    profileDisplayName,
    currentWorkspaceId,
    currentWorkspaceRole,
    isSuperAdmin,
  } = useAuthStore();

  const canEdit = currentWorkspaceRole === 'editor' || currentWorkspaceRole === 'admin';
  const userLabel = profileDisplayName || user?.email || user?.id || '';
  const navigate = useNavigate();
  const modeStorageKey = currentWorkspaceId
    ? `members-mode-${currentWorkspaceId}`
    : user?.id
    ? `members-mode-user-${user.id}`
    : 'members-mode';
  const modeHydratedRef = useRef(false);

  useEffect(() => {
    if (currentWorkspaceId) {
      loadWorkspaceData(currentWorkspaceId);
    }
  }, [currentWorkspaceId, loadWorkspaceData]);

  useEffect(() => {
    modeHydratedRef.current = false;
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(modeStorageKey);
    if (saved === 'tasks' || saved === 'access') {
      setMode(saved);
    }
    modeHydratedRef.current = true;
  }, [modeStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!modeHydratedRef.current) return;
    window.localStorage.setItem(modeStorageKey, mode);
  }, [mode, modeStorageKey]);

  const activeAssignees = useMemo(
    () => [...assignees].filter((assignee) => assignee.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [assignees],
  );
  const disabledAssignees = useMemo(
    () => [...assignees].filter((assignee) => !assignee.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [assignees],
  );

  useEffect(() => {
    const list = tab === 'active' ? activeAssignees : disabledAssignees;
    if (list.length === 0) {
      setSelectedAssigneeId(null);
      return;
    }
    if (!selectedAssigneeId || !list.some((assignee) => assignee.id === selectedAssigneeId)) {
      setSelectedAssigneeId(list[0].id);
    }
  }, [activeAssignees, disabledAssignees, selectedAssigneeId, tab]);

  const selectedAssignee = useMemo(
    () => assignees.find((assignee) => assignee.id === selectedAssigneeId) ?? null,
    [assignees, selectedAssigneeId],
  );

  const statusById = useMemo(
    () => new Map(statuses.map((status) => [status.id, status])),
    [statuses],
  );
  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const assigneeById = useMemo(
    () => new Map(assignees.map((assignee) => [assignee.id, assignee])),
    [assignees],
  );
  const taskTypeById = useMemo(
    () => new Map(taskTypes.map((type) => [type.id, type])),
    [taskTypes],
  );
  const tagById = useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag])),
    [tags],
  );

  const assigneeProjectIds = useMemo(() => {
    const ids = new Set<string>();
    assigneeTasks.forEach((task) => {
      if (task.projectId) ids.add(task.projectId);
    });
    return ids;
  }, [assigneeTasks]);

  const projectOptions = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );

  const fetchAssigneeTasks = useCallback(async (assigneeId: string) => {
    if (!currentWorkspaceId) return;
    setTasksLoading(true);
    setTasksError('');
    const offset = (pageIndex - 1) * pageSize;
    let query = supabase
      .from('tasks')
      .select('*', { count: 'exact' })
      .eq('workspace_id', currentWorkspaceId)
      .or(`assignee_id.eq.${assigneeId},assignee_ids.cs.{${assigneeId}}`);

    const today = format(new Date(), 'yyyy-MM-dd');
    if (taskScope === 'current') {
      query = query.gte('end_date', today);
    } else {
      query = query.lt('end_date', today);
      if (pastFromDate) {
        query = query.gte('end_date', pastFromDate);
      }
      if (pastToDate) {
        query = query.lte('start_date', pastToDate);
      }
    }

    if (statusFilterIds.length > 0) {
      query = query.in('status_id', statusFilterIds);
    }
    if (projectFilterIds.length > 0) {
      query = query.in('project_id', projectFilterIds);
    }
    if (search.trim()) {
      query = query.ilike('title', `%${search.trim()}%`);
    }

    let sortedQuery = query;
    if (taskScope === 'past') {
      switch (pastSort) {
        case 'start_asc':
          sortedQuery = sortedQuery.order('start_date', { ascending: true });
          break;
        case 'start_desc':
          sortedQuery = sortedQuery.order('start_date', { ascending: false });
          break;
        case 'end_asc':
          sortedQuery = sortedQuery.order('end_date', { ascending: true });
          break;
        case 'end_desc':
          sortedQuery = sortedQuery.order('end_date', { ascending: false });
          break;
        case 'title_asc':
          sortedQuery = sortedQuery.order('title', { ascending: true });
          break;
        case 'title_desc':
          sortedQuery = sortedQuery.order('title', { ascending: false });
          break;
        default:
          sortedQuery = sortedQuery.order('end_date', { ascending: false });
      }
    } else {
      sortedQuery = sortedQuery.order('start_date', { ascending: true });
    }

    const { data, error, count } = await sortedQuery
      .range(offset, offset + pageSize - 1);
    if (error) {
      setTasksError(error.message);
      setTasksLoading(false);
      return;
    }
    setAssigneeTasks((data ?? []).map((row) => mapTaskRow(row as TaskRow)));
    setTotalCount(typeof count === 'number' ? count : 0);
    setTasksLoading(false);
  }, [currentWorkspaceId, pageIndex, pageSize, projectFilterIds, search, statusFilterIds, taskScope, pastFromDate, pastToDate, pastSort]);

  useEffect(() => {
    if (!selectedAssigneeId) {
      setAssigneeTasks([]);
      setTotalCount(0);
      return;
    }
    fetchAssigneeTasks(selectedAssigneeId);
  }, [fetchAssigneeTasks, selectedAssigneeId]);

  useEffect(() => {
    setSelectedTaskIds(new Set());
  }, [selectedAssigneeId, pageIndex, projectFilterIds, search, statusFilterIds, taskScope, pastFromDate, pastToDate, pastSort]);

  useEffect(() => {
    if (!selectedTaskId) return;
    if (!assigneeTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }, [assigneeTasks, selectedTaskId]);

  const filteredTasks = assigneeTasks;

  const selectedTask = useMemo(
    () => assigneeTasks.find((task) => task.id === selectedTaskId) ?? null,
    [assigneeTasks, selectedTaskId],
  );
  const selectedTaskProject = useMemo(
    () => projects.find((project) => project.id === selectedTask?.projectId) ?? null,
    [projects, selectedTask?.projectId],
  );
  const selectedTaskTags = useMemo(() => (
    selectedTask?.tagIds.map((tagId) => tagById.get(tagId)).filter(Boolean) ?? []
  ), [selectedTask?.tagIds, tagById]);
  const selectedTaskDescription = useMemo(() => {
    if (!selectedTask?.description) return '';
    if (!hasRichTags(selectedTask.description)) return selectedTask.description;
    return sanitizeDescription(selectedTask.description);
  }, [selectedTask?.description]);

  const allVisibleSelected = filteredTasks.length > 0 && filteredTasks.every((task) => selectedTaskIds.has(task.id));
  const someVisibleSelected = filteredTasks.some((task) => selectedTaskIds.has(task.id));
  const selectedCount = selectedTaskIds.size;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const statusFilterLabel = statusFilterIds.length === 0
    ? 'All statuses'
    : `${statusFilterIds.length} selected`;

  const projectFilterLabel = projectFilterIds.length === 0
    ? 'All projects'
    : `${projectFilterIds.length} selected`;

  const handleOpenTaskInTimeline = useCallback(() => {
    if (!selectedTask) return;
    setHighlightedTaskId(selectedTask.id);
    clearFilters();
    if (user?.id && typeof window !== 'undefined') {
      window.localStorage.removeItem(`planner-filters-${user.id}`);
    }
    setViewMode('week');
    setCurrentDate(selectedTask.startDate);
    requestScrollToDate(selectedTask.startDate);
    setSelectedTaskId(null);
    navigate('/');
  }, [
    clearFilters,
    navigate,
    requestScrollToDate,
    selectedTask,
    setHighlightedTaskId,
    setCurrentDate,
    setSelectedTaskId,
    setViewMode,
    user?.id,
  ]);

  const handleToggleStatus = (statusId: string) => {
    setStatusFilterIds((current) => (
      current.includes(statusId)
        ? current.filter((id) => id !== statusId)
        : [...current, statusId]
    ));
    setPageIndex(1);
  };

  const handleToggleProject = (projectId: string) => {
    setProjectFilterIds((current) => (
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId]
    ));
    setPageIndex(1);
  };

  const setStatusPreset = (mode: 'all' | 'open' | 'done') => {
    if (mode === 'all') {
      setStatusFilterIds([]);
      setPageIndex(1);
      return;
    }
    const targetIds = statuses
      .filter((status) => (mode === 'done'
        ? (status.isFinal || status.isCancelled)
        : (!status.isFinal && !status.isCancelled)))
      .map((status) => status.id);
    setStatusFilterIds(targetIds);
    setPageIndex(1);
  };

  const handleToggleAll = (value: boolean | 'indeterminate') => {
    if (value === true) {
      setSelectedTaskIds(new Set(filteredTasks.map((task) => task.id)));
    } else {
      setSelectedTaskIds(new Set());
    }
  };

  const handleToggleTask = (taskId: string, value: boolean | 'indeterminate') => {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (value === true) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  };

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedCount || tasksLoading) return;
    setTasksLoading(true);
    setTasksError('');
    const ids = Array.from(selectedTaskIds);
    const result = await deleteTasks(ids);
    if (result?.error) {
      setTasksError(result.error);
      setTasksLoading(false);
      return;
    }
    setAssigneeTasks((current) => current.filter((task) => !selectedTaskIds.has(task.id)));
    setTotalCount((current) => Math.max(0, current - ids.length));
    setSelectedTaskIds(new Set());
    setTasksLoading(false);
  }, [deleteTasks, selectedCount, selectedTaskIds, tasksLoading]);

  if (isSuperAdmin) {
    return <Navigate to="/admin/users" replace />;
  }

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

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 border-r border-border bg-card flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            {modeToggle}
          </div>

          {mode === 'tasks' && (
            <Tabs value={tab} onValueChange={(value) => setTab(value as 'active' | 'disabled')} className="flex-1 flex flex-col">
              <TabsList className="mx-4 mt-3 grid grid-cols-2">
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="disabled">Disabled</TabsTrigger>
              </TabsList>
              <TabsContent value="active" className="flex-1 overflow-hidden">
                <ScrollArea className="h-full px-4 py-3">
                  {activeAssignees.length === 0 && (
                    <div className="text-sm text-muted-foreground">No active members.</div>
                  )}
                  <div className="space-y-2">
                    {activeAssignees.map((assignee) => {
                      const count = assigneeCountsDate ? (assigneeTaskCounts[assignee.id] ?? 0) : null;
                      return (
                        <button
                          key={assignee.id}
                          type="button"
                          onClick={() => setSelectedAssigneeId(assignee.id)}
                          className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                            selectedAssigneeId === assignee.id ? 'border-foreground/60 bg-muted/60' : 'border-border hover:bg-muted/40'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{assignee.name}</span>
                            {count !== null && (
                              <Badge variant="secondary" className="ml-auto text-[10px]">
                                {count}
                              </Badge>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="disabled" className="flex-1 overflow-hidden">
                <ScrollArea className="h-full px-4 py-3">
                  {disabledAssignees.length === 0 && (
                    <div className="text-sm text-muted-foreground">No disabled members.</div>
                  )}
                  <div className="space-y-2">
                    {disabledAssignees.map((assignee) => {
                      const count = assigneeCountsDate ? (assigneeTaskCounts[assignee.id] ?? 0) : null;
                      return (
                        <button
                          key={assignee.id}
                          type="button"
                          onClick={() => setSelectedAssigneeId(assignee.id)}
                          className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                            selectedAssigneeId === assignee.id ? 'border-foreground/60 bg-muted/60' : 'border-border hover:bg-muted/40'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{assignee.name}</span>
                            <Badge variant="secondary" className="text-[10px]">Disabled</Badge>
                            {count !== null && (
                              <Badge variant="secondary" className="ml-auto text-[10px]">
                                {count}
                              </Badge>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </aside>

        <section className="flex-1 overflow-hidden flex flex-col">
          {mode === 'access' && (
            <div className="flex-1 overflow-auto px-6 py-4">
              <WorkspaceMembersPanel />
            </div>
          )}

          {mode === 'tasks' && (
            <>
              {!selectedAssignee && (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  Select a member to view details.
                </div>
              )}

              {selectedAssignee && (
                <div className="flex flex-1 flex-col overflow-hidden">
              <div className="border-b border-border px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="text-lg font-semibold">{selectedAssignee.name}</div>
                      {!selectedAssignee.isActive && (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </div>
                    <div>{scopeToggle}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {assigneeCountsDate ? 'Tasks from today' : 'Tasks count loading...'}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-b border-border">
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    className="w-[220px]"
                    placeholder="Search tasks..."
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPageIndex(1);
                    }}
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline">{statusFilterLabel}</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="start">
                      <div className="flex gap-2 pb-2">
                        <Button size="sm" variant="ghost" onClick={() => setStatusPreset('all')}>All</Button>
                        <Button size="sm" variant="ghost" onClick={() => setStatusPreset('open')}>Open</Button>
                        <Button size="sm" variant="ghost" onClick={() => setStatusPreset('done')}>Done</Button>
                      </div>
                      <ScrollArea className="max-h-48 pr-2">
                        <div className="space-y-1">
                          {statuses.map((status) => (
                            <label key={status.id} className="flex items-center gap-2 py-1 cursor-pointer">
                              <Checkbox
                                checked={statusFilterIds.includes(status.id)}
                                onCheckedChange={() => handleToggleStatus(status.id)}
                              />
                              <span className="inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
                              <span className="text-sm truncate">{formatStatusLabel(status.name, status.emoji)}</span>
                            </label>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline">{projectFilterLabel}</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="start">
                      <ScrollArea className="max-h-48 pr-2">
                        <div className="space-y-1">
                          {projectOptions.length === 0 && (
                            <div className="text-xs text-muted-foreground">No projects for this member.</div>
                          )}
                          {projectOptions.map((project) => (
                            <label key={project.id} className="flex items-center gap-2 py-1 cursor-pointer">
                              <Checkbox
                                checked={projectFilterIds.includes(project.id)}
                                onCheckedChange={() => handleToggleProject(project.id)}
                              />
                              <span className="inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} />
                              <span className="text-sm truncate">{project.name}</span>
                            </label>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>

                  {taskScope === 'past' && (
                    <>
                      <Input
                        type="date"
                        className="w-[160px]"
                        value={pastFromDate}
                        onChange={(event) => {
                          setPastFromDate(event.target.value);
                          setPageIndex(1);
                        }}
                      />
                      <Input
                        type="date"
                        className="w-[160px]"
                        value={pastToDate}
                        onChange={(event) => {
                          setPastToDate(event.target.value);
                          setPageIndex(1);
                        }}
                      />
                      <Select
                        value={pastSort}
                        onValueChange={(value) => {
                          setPastSort(value as typeof pastSort);
                          setPageIndex(1);
                        }}
                      >
                        <SelectTrigger className="w-[170px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="end_desc">End date ↓</SelectItem>
                          <SelectItem value="end_asc">End date ↑</SelectItem>
                          <SelectItem value="start_desc">Start date ↓</SelectItem>
                          <SelectItem value="start_asc">Start date ↑</SelectItem>
                          <SelectItem value="title_asc">Title A–Z</SelectItem>
                          <SelectItem value="title_desc">Title Z–A</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  )}

                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearch('');
      setStatusFilterIds([]);
      setProjectFilterIds([]);
      setPastFromDate('');
      setPastToDate('');
      setPageIndex(1);
    }}
  >
    Clear filters
  </Button>

                  <Button
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => selectedAssigneeId && fetchAssigneeTasks(selectedAssigneeId)}
                    disabled={!selectedAssigneeId || tasksLoading}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                  {selectedCount > 0 && (
                    <Button
                      variant="destructive"
                      onClick={handleDeleteSelected}
                      disabled={tasksLoading}
                    >
                      Delete selected ({selectedCount})
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-auto px-6 py-4">
                {tasksLoading && (
                  <div className="text-sm text-muted-foreground">Loading tasks...</div>
                )}
                {!tasksLoading && tasksError && (
                  <div className="text-sm text-destructive">{tasksError}</div>
                )}
                {!tasksLoading && !tasksError && (
                  <>
                    {filteredTasks.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No tasks match the current filters.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <Checkbox
                                checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                                onCheckedChange={handleToggleAll}
                                aria-label="Select all tasks"
                              />
                            </TableHead>
                            <TableHead>Task</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead>Dates</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTasks.map((task) => {
                            const status = statusById.get(task.statusId);
                            const project = task.projectId ? projectById.get(task.projectId) : null;
                            return (
                              <TableRow
                                key={task.id}
                                className="cursor-pointer"
                                onClick={() => setSelectedTaskId(task.id)}
                              >
                                <TableCell onClick={(event) => event.stopPropagation()}>
                                  <Checkbox
                                    checked={selectedTaskIds.has(task.id)}
                                    onCheckedChange={(value) => handleToggleTask(task.id, value)}
                                    aria-label={`Select task ${task.title}`}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{task.title}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2 text-sm">
                                    <span
                                      className="inline-flex h-2 w-2 rounded-full"
                                      style={{ backgroundColor: status?.color ?? '#94a3b8' }}
                                    />
                                    <span>{status ? formatStatusLabel(status.name, status.emoji) : 'Unknown'}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {project ? (
                                    <div className="flex items-center gap-2 text-sm">
                                      <span
                                        className="inline-flex h-2 w-2 rounded-full"
                                        style={{ backgroundColor: project.color }}
                                      />
                                      <span>{project.name}</span>
                                      {project.archived && (
                                        <Badge variant="secondary" className="text-[10px]">Archived</Badge>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">No project</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {format(parseISO(task.startDate), 'dd MMM yyyy')} – {format(parseISO(task.endDate), 'dd MMM yyyy')}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                    {totalCount > pageSize && (
                      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {Math.min(totalCount, (pageIndex - 1) * pageSize + 1)}–
                          {Math.min(totalCount, pageIndex * pageSize)} of {totalCount}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPageIndex((current) => Math.max(1, current - 1))}
                            disabled={pageIndex === 1}
                          >
                            Prev
                          </Button>
                          <span>
                            Page {pageIndex} / {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPageIndex((current) => Math.min(totalPages, current + 1))}
                            disabled={pageIndex >= totalPages}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <Dialog open={Boolean(selectedTaskId)} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
        <DialogContent className="w-[95vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title ?? 'Task details'}</DialogTitle>
          </DialogHeader>
          {!selectedTask && (
            <div className="text-sm text-muted-foreground">Task not found.</div>
          )}
          {selectedTask && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">Project</div>
                  <div className="text-sm">
                    {selectedTaskProject?.name ?? 'No project'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className="inline-flex h-2 w-2 rounded-full"
                      style={{ backgroundColor: statusById.get(selectedTask.statusId)?.color ?? '#94a3b8' }}
                    />
                    <span>{statusById.get(selectedTask.statusId)
                      ? formatStatusLabel(
                        statusById.get(selectedTask.statusId)!.name,
                        statusById.get(selectedTask.statusId)!.emoji,
                      )
                      : 'Unknown'}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Assignees</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedTask.assigneeIds.length === 0 && (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                    {selectedTask.assigneeIds.map((id) => {
                      const assignee = assigneeById.get(id);
                      if (!assignee) return null;
                      return (
                        <Badge key={assignee.id} variant="secondary" className="text-[10px]">
                          {assignee.name}
                          {!assignee.isActive && ' (disabled)'}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Dates</div>
                  <div className="text-sm text-muted-foreground">
                    {format(parseISO(selectedTask.startDate), 'dd MMM yyyy')} – {format(parseISO(selectedTask.endDate), 'dd MMM yyyy')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Type</div>
                  <div className="text-sm">
                    {taskTypeById.get(selectedTask.typeId)?.name ?? 'Unknown'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Priority</div>
                  <div className="text-sm">{selectedTask.priority ?? 'None'}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs text-muted-foreground">Tags</div>
                  {selectedTaskTags.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No tags</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTaskTags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          className="text-[10px]"
                          style={{ borderColor: tag.color, color: tag.color }}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Description</div>
                {!selectedTask.description && (
                  <div className="text-sm text-muted-foreground">No description.</div>
                )}
                {selectedTask.description && hasRichTags(selectedTask.description) && (
                  <div
                    className="text-sm leading-6"
                    dangerouslySetInnerHTML={{ __html: selectedTaskDescription }}
                  />
                )}
                {selectedTask.description && !hasRichTags(selectedTask.description) && (
                  <div className="text-sm whitespace-pre-wrap">{selectedTaskDescription}</div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={handleOpenTaskInTimeline}>
                  Перейти к задаче
                </Button>
                <Button variant="outline" onClick={() => setSelectedTaskId(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <SettingsPanel open={showSettings} onOpenChange={setShowSettings} />
      <AccountSettingsDialog open={showAccountSettings} onOpenChange={setShowAccountSettings} />
    </div>
  );
};

export default MembersPage;
