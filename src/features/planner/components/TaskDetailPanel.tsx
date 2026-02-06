import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePlannerStore } from '@/features/planner/store/plannerStore';
import { useFilteredAssignees } from '@/features/planner/hooks/useFilteredAssignees';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';
import { RichTextEditor } from '@/features/planner/components/RichTextEditor';
import { Label } from '@/shared/ui/label';
import { formatStatusLabel } from '@/shared/lib/statusLabels';
import { formatProjectLabel } from '@/shared/lib/projectLabels';
import { sortProjectsByTracking } from '@/shared/lib/projectSorting';
import { cn } from '@/shared/lib/classNames';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Badge } from '@/shared/ui/badge';
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
import { AlertTriangle, ChevronDown, CircleDot, Layers, RotateCw, Trash2, User, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { Task, TaskPriority } from '@/features/planner/types/planner';
import { useAuthStore } from '@/features/auth/store/authStore';
import { addDays, endOfMonth, format, isSameMonth, isSameYear, parseISO } from 'date-fns';

const areArraysEqual = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};

const areTasksEqual = (left: Task, right: Task) => (
  left.title === right.title &&
  left.projectId === right.projectId &&
  areArraysEqual(left.assigneeIds, right.assigneeIds) &&
  left.statusId === right.statusId &&
  left.typeId === right.typeId &&
  left.priority === right.priority &&
  left.startDate === right.startDate &&
  left.endDate === right.endDate &&
  left.description === right.description &&
  areArraysEqual(left.tagIds, right.tagIds)
);

const shouldIgnoreOutsideInteraction = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('[data-radix-popper-content-wrapper]'));
};

export const TaskDetailPanel: React.FC = () => {
  const { 
    selectedTaskId, 
    setSelectedTaskId, 
    tasks, 
    projects, 
    trackedProjectIds,
    customers,
    assignees, 
    statuses, 
    taskTypes, 
    tags,
    updateTask,
    deleteTask,
    deleteTaskSeries,
    duplicateTask,
    createRepeats,
  } = usePlannerStore();
  const currentWorkspaceRole = useAuthStore((state) => state.currentWorkspaceRole);
  const canEdit = currentWorkspaceRole === 'editor' || currentWorkspaceRole === 'admin';
  const isReadOnly = !canEdit;
  const filteredAssignees = useFilteredAssignees(assignees);
  const activeProjects = useMemo(
    () => sortProjectsByTracking(
      projects.filter((project) => !project.archived),
      trackedProjectIds,
    ),
    [projects, trackedProjectIds],
  );
  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  const originalTaskRef = useRef<Task | null>(null);
  const repeatInFlightRef = useRef(false);
  const repeatUntilAutoRef = useRef(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [repeatFrequency, setRepeatFrequency] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('none');
  const [repeatEnds, setRepeatEnds] = useState<'never' | 'on' | 'after'>('never');
  const [repeatUntil, setRepeatUntil] = useState('');
  const [repeatCount, setRepeatCount] = useState(4);
  const [repeatError, setRepeatError] = useState('');
  const [repeatNotice, setRepeatNotice] = useState('');
  const [repeatCreating, setRepeatCreating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  
  const task = tasks.find(t => t.id === selectedTaskId);
  const currentProject = useMemo(
    () => projects.find((project) => project.id === task?.projectId),
    [projects, task?.projectId],
  );
  const archivedProject = currentProject?.archived ? currentProject : null;
  const projectOptions = useMemo(() => {
    if (!archivedProject) return activeProjects;
    return [archivedProject, ...activeProjects.filter((project) => project.id !== archivedProject.id)];
  }, [activeProjects, archivedProject]);
  const currentProjectCustomer = currentProject?.customerId
    ? customerById.get(currentProject.customerId)
    : null;
  const selectableAssignees = useMemo(() => {
    if (!task) return filteredAssignees.filter((assignee) => assignee.isActive);
    return filteredAssignees.filter(
      (assignee) => assignee.isActive || task.assigneeIds.includes(assignee.id),
    );
  }, [filteredAssignees, task]);

  useEffect(() => {
    if (!selectedTaskId) {
      originalTaskRef.current = null;
      return;
    }
    if (originalTaskRef.current?.id === selectedTaskId) return;
    if (task) {
      originalTaskRef.current = {
        ...task,
        assigneeIds: [...task.assigneeIds],
        tagIds: [...task.tagIds],
      };
    }
  }, [selectedTaskId, task]);

  const getDefaultRepeatUntil = (baseDate: string) => {
    const start = parseISO(baseDate);
    const next = addDays(start, 1);
    if (isSameMonth(next, start) && isSameYear(next, start)) {
      return format(next, 'yyyy-MM-dd');
    }
    return format(endOfMonth(start), 'yyyy-MM-dd');
  };

  useEffect(() => {
    if (!task) return;
    setRepeatFrequency('none');
    setRepeatEnds('never');
    repeatUntilAutoRef.current = true;
    setRepeatUntil(getDefaultRepeatUntil(task.startDate));
    setRepeatCount(4);
    setRepeatError('');
    setRepeatNotice('');
    setRepeatCreating(false);
  }, [task?.id]);

  useEffect(() => {
    if (!task) return;
    if (repeatFrequency === 'none' || repeatEnds !== 'on') return;
    if (!repeatUntilAutoRef.current) return;
    setRepeatUntil(getDefaultRepeatUntil(task.startDate));
  }, [repeatEnds, repeatFrequency, task?.startDate]);

  const handleRepeatFrequencyChange = (value: typeof repeatFrequency) => {
    setRepeatFrequency(value);
    if (value === 'none') return;
    if (repeatEnds === 'on' && task) {
      repeatUntilAutoRef.current = true;
      setRepeatUntil(getDefaultRepeatUntil(task.startDate));
    }
  };

  const handleRepeatEndsChange = (value: typeof repeatEnds) => {
    setRepeatEnds(value);
    if (value !== 'on' || !task) return;
    repeatUntilAutoRef.current = true;
    setRepeatUntil(getDefaultRepeatUntil(task.startDate));
  };

  const isDirty = useMemo(() => {
    if (!task || !originalTaskRef.current) return false;
    return !areTasksEqual(originalTaskRef.current, task);
  }, [task]);

  const assigneeLabel = useMemo(() => {
    if (!task || task.assigneeIds.length === 0) return 'Unassigned';
    const selected = filteredAssignees
      .filter((assignee) => task.assigneeIds.includes(assignee.id))
      .map((assignee) => assignee.name);
    if (selected.length === 1 && task.assigneeIds.length === 1) return selected[0];
    return `${task.assigneeIds.length} assignees`;
  }, [filteredAssignees, task]);

  const requestClose = () => {
    if (!isDirty) {
      setSelectedTaskId(null);
      return;
    }
    setConfirmOpen(true);
  };

  const handleSaveAndClose = () => {
    setConfirmOpen(false);
    setSelectedTaskId(null);
  };

  const handleDiscardAndClose = () => {
    const originalTask = originalTaskRef.current;
    if (originalTask) {
      const { id, ...updates } = originalTask;
      updateTask(id, updates);
    }
    setConfirmOpen(false);
    setSelectedTaskId(null);
  };
  
  if (!task) {
    return (
      <Dialog open={!!selectedTaskId} onOpenChange={(open) => !open && requestClose()}>
        <DialogContent className="w-[90vw] max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Task not found</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }
  
  const isRepeating = Boolean(task.repeatId);
  const hasFutureRepeats = isRepeating
    ? tasks.some((item) => item.repeatId === task.repeatId && item.startDate > task.startDate)
    : false;
  
  const handleUpdate = (field: keyof Task, value: Task[keyof Task]) => {
    if (!canEdit) return;
    updateTask(task.id, { [field]: value } as Partial<Task>);
  };

  const handleAssigneeToggle = (assigneeId: string) => {
    if (!canEdit) return;
    const targetAssignee = assignees.find((assignee) => assignee.id === assigneeId);
    if (targetAssignee && !targetAssignee.isActive && !task.assigneeIds.includes(assigneeId)) {
      return;
    }
    const next = task.assigneeIds.includes(assigneeId)
      ? task.assigneeIds.filter((id) => id !== assigneeId)
      : [...task.assigneeIds, assigneeId];
    const order = new Map(assignees.map((assignee, index) => [assignee.id, index]));
    const sorted = [...new Set(next)].sort((left, right) => (
      (order.get(left) ?? 0) - (order.get(right) ?? 0)
    ));
    updateTask(task.id, { assigneeIds: sorted });
  };
  
  const handleTagToggle = (tagId: string) => {
    if (!canEdit) return;
    const newTagIds = task.tagIds.includes(tagId)
      ? task.tagIds.filter(id => id !== tagId)
      : [...task.tagIds, tagId];
    updateTask(task.id, { tagIds: newTagIds });
  };
  
  const handleDelete = () => {
    if (!canEdit) return;
    setDeleteOpen(true);
  };

  const handleCreateRepeats = async () => {
    if (!canEdit) return;
    if (repeatInFlightRef.current) return;
    repeatInFlightRef.current = true;
    setRepeatError('');
    setRepeatNotice('');
    if (repeatFrequency === 'none') {
      setRepeatError('Select a repeat schedule.');
      repeatInFlightRef.current = false;
      return;
    }
    if (repeatEnds === 'after' && (!repeatCount || repeatCount < 1)) {
      setRepeatError('Enter how many repeats to create.');
      repeatInFlightRef.current = false;
      return;
    }
    if (repeatEnds === 'on' && !repeatUntil) {
      setRepeatError('Select an end date.');
      repeatInFlightRef.current = false;
      return;
    }

    setRepeatCreating(true);
    const result = await createRepeats(task.id, {
      frequency: repeatFrequency,
      ends: repeatEnds,
      untilDate: repeatEnds === 'on' ? repeatUntil : undefined,
      count: repeatEnds === 'after' ? repeatCount : undefined,
    });
    repeatInFlightRef.current = false;
    if (result.error) {
      setRepeatError(result.error);
      setRepeatCreating(false);
      return;
    }
    setRepeatNotice(`Created ${result.created ?? 0} tasks.`);
    setRepeatCreating(false);
  };
  
  return (
    <>
      <Dialog open={!!selectedTaskId} onOpenChange={(open) => !open && requestClose()}>
        <DialogContent
          className="w-[95vw] max-w-5xl max-h-[85vh] overflow-y-auto pt-10"
          onInteractOutside={(e) => {
            if (shouldIgnoreOutsideInteraction(e.target)) {
              e.preventDefault();
            }
          }}
          onPointerDownOutside={(e) => {
            if (shouldIgnoreOutsideInteraction(e.target)) {
              e.preventDefault();
            }
          }}
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <div className="space-y-1.5">
                  <Input
                    id="title"
                    value={task.title}
                    onChange={(e) => handleUpdate('title', e.target.value)}
                    className="text-lg font-semibold"
                    disabled={isReadOnly}
                  />
                  {task.repeatId && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <RotateCw className="h-3 w-3" aria-hidden="true" />
                      <span>Repeat</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Project</Label>
                <Select
                  value={task.projectId || 'none'}
                  onValueChange={(v) => handleUpdate('projectId', v === 'none' ? null : v)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Project</SelectItem>
                    {projectOptions.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          {formatProjectLabel(project.name, project.code)}
                          {project.archived && (
                            <span className="ml-1 text-[10px] text-muted-foreground">(archived)</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentProject && (
                  <div className="text-xs text-muted-foreground">
                    Customer: {currentProjectCustomer?.name ?? 'No customer'}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <RichTextEditor
                  id="description"
                  value={task.description || ''}
                  onChange={(value) => handleUpdate('description', value || null)}
                  placeholder="Add a description..."
                  disabled={isReadOnly}
                  className="max-h-[45vh] overflow-y-auto pr-2"
                />
              </div>
            </div>

            <div className="space-y-3 lg:border-l lg:pl-6">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted/40">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Исполнители</TooltipContent>
                  </Tooltip>
                  <div className="flex-1 min-w-0">
                    <Label className="sr-only">Assignees</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-8 w-full justify-between pl-3 pr-2 text-left text-sm" disabled={isReadOnly}>
                          <span className="flex-1 truncate text-left">{assigneeLabel}</span>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-2" align="start">
                        {selectableAssignees.length === 0 ? (
                          <div className="text-xs text-muted-foreground">Нет доступных исполнителей.</div>
                        ) : (
                          <ScrollArea className="max-h-48 pr-2">
                            <div className="space-y-1">
                              {selectableAssignees.map((assignee) => {
                                const isAssigned = task.assigneeIds.includes(assignee.id);
                                const isDisabled = isReadOnly || (!assignee.isActive && !isAssigned);
                                return (
                                <label key={assignee.id} className="flex items-center gap-2 py-1 cursor-pointer">
                                  <Checkbox
                                    checked={isAssigned}
                                    onCheckedChange={() => handleAssigneeToggle(assignee.id)}
                                    disabled={isDisabled}
                                  />
                                  <span className="text-sm truncate">
                                    {assignee.name}
                                    {!assignee.isActive && (
                                      <span className="ml-1 text-[10px] text-muted-foreground">(disabled)</span>
                                    )}
                                  </span>
                                </label>
                              );
                              })}
                            </div>
                          </ScrollArea>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted/40">
                        <CircleDot className="h-4 w-4 text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Статус</TooltipContent>
                  </Tooltip>
                  <div className="flex-1 min-w-0">
                    <Label className="sr-only">Status</Label>
                    <Select
                      value={task.statusId}
                      onValueChange={(v) => handleUpdate('statusId', v)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="h-8 w-full min-w-0 overflow-hidden pl-3 pr-2 text-left text-sm whitespace-nowrap">
                        <SelectValue placeholder="Select status" className="truncate text-left" />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: s.color }}
                              />
                              <span className="truncate">{formatStatusLabel(s.name, s.emoji)}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted/40">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Тип</TooltipContent>
                  </Tooltip>
                  <div className="flex-1 min-w-0">
                    <Label className="sr-only">Type</Label>
                    <Select
                      value={task.typeId}
                      onValueChange={(v) => handleUpdate('typeId', v)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="h-8 w-full pl-3 pr-2 text-left text-sm">
                        <SelectValue placeholder="Select type" className="truncate text-left" />
                      </SelectTrigger>
                      <SelectContent>
                        {taskTypes.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted/40">
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Приоритет</TooltipContent>
                  </Tooltip>
                  <div className="flex-1 min-w-0">
                    <Label className="sr-only">Priority</Label>
                    <Select
                      value={task.priority ?? 'none'}
                      onValueChange={(value) => handleUpdate('priority', value === 'none' ? null : (value as TaskPriority))}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="h-8 w-full pl-3 pr-2 text-left text-sm">
                        <SelectValue placeholder="Select priority" className="truncate text-left" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No priority</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="startDate" className="text-xs text-muted-foreground">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={task.startDate}
                    onChange={(e) => handleUpdate('startDate', e.target.value)}
                    disabled={isReadOnly}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="endDate" className="text-xs text-muted-foreground">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={task.endDate}
                    onChange={(e) => handleUpdate('endDate', e.target.value)}
                    disabled={isReadOnly}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Repeat</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={repeatFrequency}
                    onValueChange={(value) => handleRepeatFrequencyChange(value as typeof repeatFrequency)}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Repeat" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Does not repeat</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={repeatEnds}
                    onValueChange={(value) => handleRepeatEndsChange(value as typeof repeatEnds)}
                    disabled={isReadOnly || repeatFrequency === 'none'}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Ends" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="on">On date</SelectItem>
                      <SelectItem value="after">After count</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {repeatFrequency !== 'none' && repeatEnds === 'on' && (
                  <div className="space-y-1">
                    <Label htmlFor="repeat-until" className="text-xs text-muted-foreground">End date</Label>
                    <Input
                      id="repeat-until"
                      type="date"
                      value={repeatUntil}
                      onChange={(e) => {
                        repeatUntilAutoRef.current = false;
                        setRepeatUntil(e.target.value);
                      }}
                      disabled={isReadOnly}
                      className="h-8 text-sm"
                    />
                  </div>
                )}
                {repeatFrequency !== 'none' && repeatEnds === 'after' && (
                  <div className="space-y-1">
                    <Label htmlFor="repeat-count" className="text-xs text-muted-foreground">Occurrences</Label>
                    <Input
                      id="repeat-count"
                      type="number"
                      min={1}
                      value={repeatCount}
                      onChange={(e) => setRepeatCount(Number(e.target.value))}
                      disabled={isReadOnly}
                      className="h-8 text-sm"
                    />
                  </div>
                )}
                {repeatFrequency !== 'none' && repeatEnds === 'never' && (
                  <p className="text-[11px] text-muted-foreground">
                    Creates repeats for the next 12 months.
                  </p>
                )}
                {repeatError && (
                  <div className="text-xs text-destructive">{repeatError}</div>
                )}
                {repeatNotice && (
                  <div className="text-xs text-emerald-600">{repeatNotice}</div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={handleCreateRepeats}
                  disabled={isReadOnly || repeatFrequency === 'none' || repeatCreating}
                >
                  Create repeats
                </Button>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(tag => {
                    const isSelected = task.tagIds.includes(tag.id);
                    return (
                      <Badge
                        key={tag.id}
                        variant={isSelected ? 'default' : 'outline'}
                        className={cn(
                          'transition-all text-xs px-2 py-0.5',
                          isReadOnly ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
                        )}
                        style={isSelected ? {
                          backgroundColor: tag.color,
                          borderColor: tag.color,
                        } : {
                          borderColor: tag.color,
                          color: tag.color,
                        }}
                        onClick={canEdit ? () => handleTagToggle(tag.id) : undefined}
                      >
                        {tag.name}
                        {isSelected && <X className="w-3 h-3 ml-1" />}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-destructive hover:text-destructive"
                  onClick={handleDelete}
                  disabled={isReadOnly}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>

              <div className="pt-3 border-t border-border">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => duplicateTask(task.id)}
                    disabled={isReadOnly}
                  >
                    Duplicate
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8"
                    onClick={handleSaveAndClose}
                  >
                    OK
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Do you want to save them before closing?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardAndClose}>Don&apos;t save</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveAndClose}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRepeating ? 'Delete repeated task?' : 'Delete task?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRepeating
                ? `Delete only this task or this and ${hasFutureRepeats ? 'future' : 'subsequent'} repeats? Previous repeats stay.`
                : `This will permanently delete "${task.title}".`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {isRepeating ? (
              <>
                <AlertDialogAction
                  className="bg-muted text-foreground hover:bg-muted/80"
                  onClick={async () => {
                    if (!canEdit) return;
                    await deleteTask(task.id);
                    setDeleteOpen(false);
                  }}
                >
                  Delete this
                </AlertDialogAction>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    if (!canEdit || !task.repeatId) return;
                    await deleteTaskSeries(task.repeatId, task.startDate);
                    setDeleteOpen(false);
                  }}
                >
                  Delete this & following
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction
                onClick={async () => {
                  if (!canEdit) return;
                  await deleteTask(task.id);
                  setDeleteOpen(false);
                }}
              >
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
