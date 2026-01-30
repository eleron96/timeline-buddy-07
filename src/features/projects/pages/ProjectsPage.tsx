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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { ColorPicker } from '@/shared/ui/color-picker';
import { supabase } from '@/shared/lib/supabaseClient';
import { formatStatusLabel } from '@/shared/lib/statusLabels';
import { format, parseISO } from 'date-fns';
import { FolderKanban, Settings, User, Plus, RefreshCcw, Pencil } from 'lucide-react';
import { Project, Task } from '@/features/planner/types/planner';
import DOMPurify from 'dompurify';
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/shared/ui/context-menu';

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

const ProjectsPage = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilterIds, setStatusFilterIds] = useState<string[]>([]);
  const [assigneeFilterIds, setAssigneeFilterIds] = useState<string[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#3b82f6');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<Project | null>(null);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const {
    projects,
    statuses,
    assignees,
    taskTypes,
    tags,
    loadWorkspaceData,
    addProject,
    updateProject,
    deleteProject,
    setHighlightedTaskId,
    setViewMode,
    setCurrentDate,
    requestScrollToDate,
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

  useEffect(() => {
    if (currentWorkspaceId) {
      loadWorkspaceData(currentWorkspaceId);
    }
  }, [currentWorkspaceId, loadWorkspaceData]);

  const activeProjects = useMemo(
    () => [...projects].filter((project) => !project.archived).sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );
  const archivedProjects = useMemo(
    () => [...projects].filter((project) => project.archived).sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );

  useEffect(() => {
    const list = tab === 'active' ? activeProjects : archivedProjects;
    if (list.length === 0) {
      setSelectedProjectId(null);
      return;
    }
    if (!selectedProjectId || !list.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(list[0].id);
    }
  }, [activeProjects, archivedProjects, selectedProjectId, tab]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const statusById = useMemo(
    () => new Map(statuses.map((status) => [status.id, status])),
    [statuses],
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

  const projectAssigneeIds = useMemo(() => {
    const ids = new Set<string>();
    projectTasks.forEach((task) => {
      task.assigneeIds.forEach((id) => ids.add(id));
    });
    return ids;
  }, [projectTasks]);

  const assigneeOptions = useMemo(
    () => assignees.filter((assignee) => projectAssigneeIds.has(assignee.id)),
    [assignees, projectAssigneeIds],
  );

  const fetchProjectTasks = useCallback(async (projectId: string) => {
    if (!currentWorkspaceId) return;
    setTasksLoading(true);
    setTasksError('');
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('workspace_id', currentWorkspaceId)
      .eq('project_id', projectId)
      .order('start_date', { ascending: true });
    if (error) {
      setTasksError(error.message);
      setTasksLoading(false);
      return;
    }
    setProjectTasks((data ?? []).map((row) => mapTaskRow(row as TaskRow)));
    setTasksLoading(false);
  }, [currentWorkspaceId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setProjectTasks([]);
      setSelectedTaskId(null);
      return;
    }
    fetchProjectTasks(selectedProjectId);
  }, [fetchProjectTasks, selectedProjectId]);

  useEffect(() => {
    if (!selectedTaskId) return;
    if (!projectTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }, [projectTasks, selectedTaskId]);

  const selectedTask = useMemo(
    () => projectTasks.find((task) => task.id === selectedTaskId) ?? null,
    [projectTasks, selectedTaskId],
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

  const navigate = useNavigate();

  const handleOpenTaskInTimeline = useCallback(() => {
    if (!selectedTask) return;
    setHighlightedTaskId(selectedTask.id);
    setViewMode('week');
    setCurrentDate(selectedTask.startDate);
    requestScrollToDate(selectedTask.startDate);
    setSelectedTaskId(null);
    navigate('/');
  }, [
    navigate,
    requestScrollToDate,
    selectedTask,
    setHighlightedTaskId,
    setCurrentDate,
    setSelectedTaskId,
    setViewMode,
  ]);

  const filteredTasks = useMemo(() => (
    projectTasks.filter((task) => {
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        if (!task.title.toLowerCase().includes(query)) return false;
      }
      if (statusFilterIds.length > 0 && !statusFilterIds.includes(task.statusId)) {
        return false;
      }
      if (assigneeFilterIds.length > 0) {
        if (!task.assigneeIds.some((id) => assigneeFilterIds.includes(id))) return false;
      }
      return true;
    })
  ), [assigneeFilterIds, projectTasks, search, statusFilterIds]);

  const statusFilterLabel = statusFilterIds.length === 0
    ? 'All statuses'
    : `${statusFilterIds.length} selected`;

  const assigneeFilterLabel = assigneeFilterIds.length === 0
    ? 'All assignees'
    : `${assigneeFilterIds.length} selected`;

  const handleToggleStatus = (statusId: string) => {
    setStatusFilterIds((current) => (
      current.includes(statusId)
        ? current.filter((id) => id !== statusId)
        : [...current, statusId]
    ));
  };

  const handleToggleAssignee = (assigneeId: string) => {
    setAssigneeFilterIds((current) => (
      current.includes(assigneeId)
        ? current.filter((id) => id !== assigneeId)
        : [...current, assigneeId]
    ));
  };

  const setStatusPreset = (mode: 'all' | 'open' | 'done') => {
    if (mode === 'all') {
      setStatusFilterIds([]);
      return;
    }
    const targetIds = statuses
      .filter((status) => (mode === 'done' ? status.isFinal : !status.isFinal))
      .map((status) => status.id);
    setStatusFilterIds(targetIds);
  };

  const handleAddProject = () => {
    if (!canEdit || !newProjectName.trim()) return;
    addProject({ name: newProjectName.trim(), color: newProjectColor, archived: false });
    setNewProjectName('');
  };

  const startProjectEdit = useCallback((project: Project) => {
    if (!canEdit) return;
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
    setSelectedProjectId(project.id);
  }, [canEdit]);

  const commitProjectEdit = useCallback((project: Project) => {
    if (!canEdit) return;
    const nextName = editingProjectName.trim();
    if (!nextName) {
      setEditingProjectId(null);
      setEditingProjectName('');
      return;
    }
    if (nextName !== project.name) {
      updateProject(project.id, { name: nextName });
    }
    setEditingProjectId(null);
    setEditingProjectName('');
  }, [canEdit, editingProjectName, updateProject]);

  const cancelProjectEdit = useCallback(() => {
    setEditingProjectId(null);
    setEditingProjectName('');
  }, []);

  const requestDeleteProject = useCallback((project: Project) => {
    if (!canEdit) return;
    setDeleteProjectTarget(project);
    setDeleteProjectOpen(true);
  }, [canEdit]);

  const handleConfirmDeleteProject = useCallback(() => {
    if (!deleteProjectTarget) return;
    deleteProject(deleteProjectTarget.id);
    setDeleteProjectOpen(false);
    setDeleteProjectTarget(null);
  }, [deleteProject, deleteProjectTarget]);

  useEffect(() => {
    if (editingProjectId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingProjectId]);

  if (isSuperAdmin) {
    return <Navigate to="/admin/users" replace />;
  }

  const renderProjectItem = (project: Project, showArchivedBadge: boolean) => {
    const isEditing = editingProjectId === project.id;
    return (
      <ContextMenu key={project.id}>
        <ContextMenuTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setSelectedProjectId(project.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedProjectId(project.id);
              }
            }}
            className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
              selectedProjectId === project.id ? 'border-foreground/60 bg-muted/60' : 'border-border hover:bg-muted/40'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} />
              {isEditing ? (
                <Input
                  ref={editInputRef}
                  value={editingProjectName}
                  onChange={(event) => setEditingProjectName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitProjectEdit(project);
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      cancelProjectEdit();
                    }
                  }}
                  onBlur={() => commitProjectEdit(project)}
                  className="h-8"
                  disabled={!canEdit}
                />
              ) : (
                <span className="text-sm font-medium truncate">{project.name}</span>
              )}
              {showArchivedBadge && (
                <Badge variant="secondary" className="text-[10px]">Archived</Badge>
              )}
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem disabled={!canEdit} onSelect={() => startProjectEdit(project)}>
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!canEdit}
            onSelect={() => updateProject(project.id, { archived: !project.archived })}
          >
            {project.archived ? 'Restore' : 'Archive'}
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!canEdit}
            onSelect={() => requestDeleteProject(project)}
            className="text-destructive focus:text-destructive"
          >
            Delete
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
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            <span className="text-sm font-semibold">Projects</span>
          </div>
          <div className="p-4 space-y-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Input
                placeholder="New project name..."
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleAddProject()}
                disabled={!canEdit}
              />
              <ColorPicker value={newProjectColor} onChange={setNewProjectColor} disabled={!canEdit} />
              <Button onClick={handleAddProject} size="icon" disabled={!canEdit || !newProjectName.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Tabs value={tab} onValueChange={(value) => setTab(value as 'active' | 'archived')} className="flex-1 flex flex-col">
            <TabsList className="mx-4 mt-3 grid grid-cols-2">
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full px-4 py-3">
                {activeProjects.length === 0 && (
                  <div className="text-sm text-muted-foreground">No active projects.</div>
                )}
                <div className="space-y-2">
                  {activeProjects.map((project) => renderProjectItem(project, false))}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="archived" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full px-4 py-3">
                {archivedProjects.length === 0 && (
                  <div className="text-sm text-muted-foreground">No archived projects.</div>
                )}
                <div className="space-y-2">
                  {archivedProjects.map((project) => renderProjectItem(project, true))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </aside>

        <section className="flex-1 overflow-hidden flex flex-col">
          {!selectedProject && (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Select a project to view details.
            </div>
          )}

          {selectedProject && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="border-b border-border px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold">{selectedProject.name}</span>
                    {selectedProject.archived && (
                      <Badge variant="secondary">Archived</Badge>
                    )}
                  </div>
                  
                </div>
              </div>

              <div className="px-6 py-4 border-b border-border">
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    className="w-[220px]"
                    placeholder="Search tasks..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
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
                              <span className="text-sm truncate">{formatStatusLabel(status.name)}</span>
                            </label>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline">{assigneeFilterLabel}</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="start">
                      <ScrollArea className="max-h-48 pr-2">
                        <div className="space-y-1">
                          {assigneeOptions.length === 0 && (
                            <div className="text-xs text-muted-foreground">No assignees on this project.</div>
                          )}
                          {assigneeOptions.map((assignee) => (
                            <label key={assignee.id} className="flex items-center gap-2 py-1 cursor-pointer">
                              <Checkbox
                                checked={assigneeFilterIds.includes(assignee.id)}
                                onCheckedChange={() => handleToggleAssignee(assignee.id)}
                              />
                              <span className="text-sm truncate">
                                {assignee.name}
                                {!assignee.isActive && (
                                  <span className="ml-1 text-[10px] text-muted-foreground">(disabled)</span>
                                )}
                              </span>
                            </label>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>

                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearch('');
                      setStatusFilterIds([]);
                      setAssigneeFilterIds([]);
                    }}
                  >
                    Clear filters
                  </Button>

                  <Button
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => selectedProjectId && fetchProjectTasks(selectedProjectId)}
                    disabled={!selectedProjectId || tasksLoading}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
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
                            <TableHead>Task</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Assignees</TableHead>
                            <TableHead>Dates</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTasks.map((task) => {
                            const status = statusById.get(task.statusId);
                            const assigneesList = task.assigneeIds
                              .map((id) => assigneeById.get(id))
                              .filter((assignee): assignee is NonNullable<typeof assignee> => Boolean(assignee));
                            return (
                              <TableRow
                                key={task.id}
                                role="button"
                                tabIndex={0}
                                className="cursor-pointer hover:bg-muted/40"
                                onClick={() => setSelectedTaskId(task.id)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    setSelectedTaskId(task.id);
                                  }
                                }}
                              >
                                <TableCell className="font-medium">{task.title}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2 text-sm">
                                    <span
                                      className="inline-flex h-2 w-2 rounded-full"
                                      style={{ backgroundColor: status?.color ?? '#94a3b8' }}
                                    />
                                    <span>{status ? formatStatusLabel(status.name) : 'Unknown'}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {assigneesList.length === 0 ? (
                                    <span className="text-xs text-muted-foreground">Unassigned</span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1">
                                      {assigneesList.map((assignee) => (
                                        <Badge
                                          key={assignee.id}
                                          variant="secondary"
                                          className="text-[10px]"
                                        >
                                          {assignee.name}
                                          {!assignee.isActive && ' (disabled)'}
                                        </Badge>
                                      ))}
                                    </div>
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
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      <SettingsPanel open={showSettings} onOpenChange={setShowSettings} />
      <AccountSettingsDialog open={showAccountSettings} onOpenChange={setShowAccountSettings} />
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
                      ? formatStatusLabel(statusById.get(selectedTask.statusId)!.name)
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
      <AlertDialog
        open={deleteProjectOpen}
        onOpenChange={(open) => {
          setDeleteProjectOpen(open);
          if (!open) {
            setDeleteProjectTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{deleteProjectTarget?.name ?? 'this project'}". Tasks will remain, but the project
              will be cleared from them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteProjectTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteProject}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectsPage;
