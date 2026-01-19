import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePlannerStore } from '@/store/plannerStore';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Trash2, X } from 'lucide-react';
import { Task } from '@/types/planner';
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
      <Sheet open={!!selectedTaskId} onOpenChange={(open) => !open && requestClose()}>
        <SheetContent className="w-[400px] sm:w-[450px]">
          <SheetHeader>
            <SheetTitle>Task not found</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }
  
  const project = projects.find(p => p.id === task.projectId);
  const assignee = assignees.find(a => a.id === task.assigneeId);
  const status = statuses.find(s => s.id === task.statusId);
  const taskType = taskTypes.find(t => t.id === task.typeId);
  
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
    if (confirm('Are you sure you want to delete this task?')) {
      deleteTask(task.id);
    }
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
      <Sheet open={!!selectedTaskId} onOpenChange={(open) => !open && requestClose()}>
        <SheetContent 
          className="w-[400px] sm:w-[450px] overflow-y-auto"
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
          <SheetHeader className="space-y-1">
            <div className="flex items-center gap-2">
              {project && (
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: project.color }}
                />
              )}
              <SheetTitle className="text-lg">Task Details</SheetTitle>
            </div>
          </SheetHeader>
          
          <div className="space-y-6 mt-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={task.title}
              onChange={(e) => handleUpdate('title', e.target.value)}
              className="text-base"
              disabled={isReadOnly}
            />
          </div>
          
          {/* Project */}
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
          
          {/* Assignee */}
          <div className="space-y-2">
            <Label>Assignee</Label>
            <Select 
              value={task.assigneeId || 'none'} 
              onValueChange={(v) => handleUpdate('assigneeId', v === 'none' ? null : v)}
              disabled={isReadOnly}
            >
              <SelectTrigger>
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
          
          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select 
              value={task.statusId} 
              onValueChange={(v) => handleUpdate('statusId', v)}
              disabled={isReadOnly}
            >
              <SelectTrigger>
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
          
          {/* Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Select 
              value={task.typeId} 
              onValueChange={(v) => handleUpdate('typeId', v)}
              disabled={isReadOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {taskTypes.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={task.startDate}
                onChange={(e) => handleUpdate('startDate', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={task.endDate}
                onChange={(e) => handleUpdate('endDate', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          {/* Repeat */}
          <div className="space-y-2">
            <Label>Repeat</Label>
            <div className="grid grid-cols-2 gap-4">
              <Select
                value={repeatFrequency}
                onValueChange={(value) => setRepeatFrequency(value as typeof repeatFrequency)}
                disabled={isReadOnly}
              >
                <SelectTrigger>
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
                <SelectTrigger>
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
              <div className="space-y-2">
                <Label htmlFor="repeat-until">End date</Label>
                <Input
                  id="repeat-until"
                  type="date"
                  value={repeatUntil}
                  onChange={(e) => setRepeatUntil(e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
            )}
            {repeatFrequency !== 'none' && repeatEnds === 'after' && (
              <div className="space-y-2">
                <Label htmlFor="repeat-count">Occurrences</Label>
                <Input
                  id="repeat-count"
                  type="number"
                  min={1}
                  value={repeatCount}
                  onChange={(e) => setRepeatCount(Number(e.target.value))}
                  disabled={isReadOnly}
                />
              </div>
            )}
            {repeatFrequency !== 'none' && repeatEnds === 'never' && (
              <p className="text-xs text-muted-foreground">
                Creates repeats for the next 12 months.
              </p>
            )}
            {repeatError && (
              <div className="text-sm text-destructive">{repeatError}</div>
            )}
            {repeatNotice && (
              <div className="text-sm text-emerald-600">{repeatNotice}</div>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleCreateRepeats}
              disabled={isReadOnly || repeatFrequency === 'none' || repeatCreating}
            >
              Create repeats
            </Button>
          </div>
          
          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => {
                const isSelected = task.tagIds.includes(tag.id);
                return (
                  <Badge
                    key={tag.id}
                    variant={isSelected ? 'default' : 'outline'}
                    className={cn(
                      'transition-all',
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
          
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={task.description || ''}
              onChange={(e) => handleUpdate('description', e.target.value)}
              placeholder="Add a description..."
              rows={4}
              disabled={isReadOnly}
            />
          </div>
          
          {/* Actions */}
          <div className="pt-4 border-t border-border space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => duplicateTask(task.id)}
              disabled={isReadOnly}
            >
              Duplicate Task
            </Button>
            <Button 
              variant="destructive" 
              className="w-full"
              onClick={handleDelete}
              disabled={isReadOnly}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Task
            </Button>
          </div>
          </div>
        </SheetContent>
      </Sheet>
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
    </>
  );
};
