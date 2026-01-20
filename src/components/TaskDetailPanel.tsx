import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePlannerStore } from '@/store/plannerStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, CircleDot, Layers, Trash2, User, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Task, TaskPriority } from '@/types/planner';
import { useAuthStore } from '@/store/authStore';
import { addYears, format, parseISO } from 'date-fns';

const areArraysEqual = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};

const areTasksEqual = (left: Task, right: Task) => (
  left.title === right.title &&
  left.projectId === right.projectId &&
  left.assigneeId === right.assigneeId &&
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

  const originalTaskRef = useRef<Task | null>(null);
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

  useEffect(() => {
    if (!selectedTaskId) {
      originalTaskRef.current = null;
      return;
    }
    if (originalTaskRef.current?.id === selectedTaskId) return;
    if (task) {
      originalTaskRef.current = { ...task, tagIds: [...task.tagIds] };
    }
  }, [selectedTaskId, task]);

  useEffect(() => {
    if (!task) return;
    setRepeatFrequency('none');
    setRepeatEnds('never');
    setRepeatUntil(format(addYears(parseISO(task.startDate), 1), 'yyyy-MM-dd'));
    setRepeatCount(4);
    setRepeatError('');
    setRepeatNotice('');
    setRepeatCreating(false);
  }, [task?.id]);

  const isDirty = useMemo(() => {
    if (!task || !originalTaskRef.current) return false;
    return !areTasksEqual(originalTaskRef.current, task);
  }, [task]);

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
    setRepeatError('');
    setRepeatNotice('');
    if (repeatFrequency === 'none') {
      setRepeatError('Select a repeat schedule.');
      return;
    }
    if (repeatEnds === 'after' && (!repeatCount || repeatCount < 1)) {
      setRepeatError('Enter how many repeats to create.');
      return;
    }
    if (repeatEnds === 'on' && !repeatUntil) {
      setRepeatError('Select an end date.');
      return;
    }

    setRepeatCreating(true);
    const result = await createRepeats(task.id, {
      frequency: repeatFrequency,
      ends: repeatEnds,
      untilDate: repeatEnds === 'on' ? repeatUntil : undefined,
      count: repeatEnds === 'after' ? repeatCount : undefined,
    });
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
                <Input
                  id="title"
                  value={task.title}
                  onChange={(e) => handleUpdate('title', e.target.value)}
                  className="text-lg font-semibold"
                  disabled={isReadOnly}
                />
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
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: p.color }}
                          />
                          {p.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <TooltipContent>Исполнитель</TooltipContent>
                  </Tooltip>
                  <div className="flex-1">
                    <Label className="sr-only">Assignee</Label>
                    <Select
                      value={task.assigneeId || 'none'}
                      onValueChange={(v) => handleUpdate('assigneeId', v === 'none' ? null : v)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {assignees.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  <div className="flex-1">
                    <Label className="sr-only">Status</Label>
                    <Select
                      value={task.statusId}
                      onValueChange={(v) => handleUpdate('statusId', v)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: s.color }}
                              />
                              {s.name}
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
                  <div className="flex-1">
                    <Label className="sr-only">Type</Label>
                    <Select
                      value={task.typeId}
                      onValueChange={(v) => handleUpdate('typeId', v)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select type" />
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
                  <div className="flex-1">
                    <Label className="sr-only">Priority</Label>
                    <Select
                      value={task.priority ?? 'none'}
                      onValueChange={(value) => handleUpdate('priority', value === 'none' ? null : (value as TaskPriority))}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select priority" />
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
                    onValueChange={(value) => setRepeatFrequency(value as typeof repeatFrequency)}
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
                    onValueChange={(value) => setRepeatEnds(value as typeof repeatEnds)}
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
                      onChange={(e) => setRepeatUntil(e.target.value)}
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
                    variant="destructive"
                    size="sm"
                    className="h-8"
                    onClick={handleDelete}
                    disabled={isReadOnly}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
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
