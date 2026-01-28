import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlannerStore } from '@/features/planner/store/plannerStore';
import { useFilteredAssignees } from '@/features/planner/hooks/useFilteredAssignees';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { RichTextEditor } from '@/features/planner/components/RichTextEditor';
import { Badge } from '@/shared/ui/badge';
import { Checkbox } from '@/shared/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { ChevronDown, Plus } from 'lucide-react';
import { format, addDays } from '@/features/planner/lib/dateUtils';
import { cn } from '@/shared/lib/classNames';
import { TaskPriority } from '@/features/planner/types/planner';
import { endOfMonth, isSameMonth, isSameYear, parseISO } from 'date-fns';

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStartDate?: string;
  initialEndDate?: string;
  initialProjectId?: string | null;
  initialAssigneeIds?: string[];
}

export const AddTaskDialog: React.FC<AddTaskDialogProps> = ({
  open,
  onOpenChange,
  initialStartDate,
  initialEndDate,
  initialProjectId,
  initialAssigneeIds,
}) => {
  const { projects, assignees, statuses, taskTypes, tags, addTask, createRepeats } = usePlannerStore();
  const filteredAssignees = useFilteredAssignees(assignees);
  const activeProjects = useMemo(() => projects.filter((project) => !project.archived), [projects]);
  const selectableAssignees = useMemo(
    () => filteredAssignees.filter((assignee) => assignee.isActive),
    [filteredAssignees],
  );
  
  const today = new Date();
  const defaultStart = format(today, 'yyyy-MM-dd');
  const initialStart = initialStartDate ?? defaultStart;
  const initialEnd = initialEndDate ?? initialStart;
  const getDefaultRepeatUntil = (baseDate: string) => {
    const start = parseISO(baseDate);
    const next = addDays(start, 1);
    if (isSameMonth(next, start) && isSameYear(next, start)) {
      return format(next, 'yyyy-MM-dd');
    }
    return format(endOfMonth(start), 'yyyy-MM-dd');
  };
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<string>('none');
  const [projectInitialized, setProjectInitialized] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [statusId, setStatusId] = useState(statuses[0]?.id || '');
  const [typeId, setTypeId] = useState(taskTypes[0]?.id || '');
  const [priority, setPriority] = useState<TaskPriority | 'none'>('none');
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const repeatUntilAutoRef = useRef(true);
  const [repeatFrequency, setRepeatFrequency] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('none');
  const [repeatEnds, setRepeatEnds] = useState<'never' | 'on' | 'after'>('never');
  const [repeatUntil, setRepeatUntil] = useState(getDefaultRepeatUntil(initialStart));
  const [repeatCount, setRepeatCount] = useState(4);
  const [repeatError, setRepeatError] = useState('');
  const [repeatCreating, setRepeatCreating] = useState(false);

  const normalizeAssigneeSelection = useCallback((ids: string[] | undefined) => {
    if (!ids || ids.length === 0) return [];
    const order = new Map(assignees.map((assignee, index) => [assignee.id, index]));
    return Array.from(new Set(ids)).sort((left, right) => (
      (order.get(left) ?? 0) - (order.get(right) ?? 0)
    ));
  }, [assignees]);

  const handleTagToggle = (tagId: string) => {
    setTagIds((prev) => (
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    ));
  };

  const handleAssigneeToggle = (assigneeId: string) => {
    setAssigneeIds((prev) => {
      const next = prev.includes(assigneeId)
        ? prev.filter((id) => id !== assigneeId)
        : [...prev, assigneeId];
      const order = new Map(assignees.map((assignee, index) => [assignee.id, index]));
      return [...new Set(next)].sort((left, right) => (
        (order.get(left) ?? 0) - (order.get(right) ?? 0)
      ));
    });
  };

  const handleRepeatFrequencyChange = (value: typeof repeatFrequency) => {
    setRepeatFrequency(value);
    if (value === 'none') return;
    if (repeatEnds !== 'on') return;
    repeatUntilAutoRef.current = true;
    setRepeatUntil(getDefaultRepeatUntil(startDate));
  };

  const handleRepeatEndsChange = (value: typeof repeatEnds) => {
    setRepeatEnds(value);
    if (value !== 'on') return;
    repeatUntilAutoRef.current = true;
    setRepeatUntil(getDefaultRepeatUntil(startDate));
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (repeatEnds !== 'on' || repeatFrequency === 'none') return;
    if (!repeatUntilAutoRef.current) return;
    setRepeatUntil(getDefaultRepeatUntil(value));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !statusId || !typeId) return;

    setRepeatError('');
    if (repeatFrequency !== 'none') {
      if (repeatEnds === 'after' && (!repeatCount || repeatCount < 1)) {
        setRepeatError('Enter how many repeats to create.');
        return;
      }
      if (repeatEnds === 'on' && !repeatUntil) {
        setRepeatError('Select an end date.');
        return;
      }
    }

    setRepeatCreating(true);
    const createdTask = await addTask({
      title: title.trim(),
      projectId: projectId === 'none' ? null : projectId,
      assigneeIds,
      statusId,
      typeId,
      priority: priority === 'none' ? null : priority,
      startDate,
      endDate,
      tagIds,
      description: description.trim() || null,
      repeatId: null,
    });

    if (!createdTask) {
      setRepeatError('Failed to create task.');
      setRepeatCreating(false);
      return;
    }

    if (repeatFrequency !== 'none') {
      const result = await createRepeats(createdTask.id, {
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
    }
    
    // Reset form
    setTitle('');
    setProjectId(activeProjects[0]?.id || 'none');
    setProjectInitialized(false);
    setAssigneeIds([]);
    setStatusId(statuses[0]?.id || '');
    setTypeId(taskTypes[0]?.id || '');
    setPriority('none');
    setStartDate(defaultStart);
    setEndDate(defaultStart);
    setTagIds([]);
    setDescription('');
    setRepeatFrequency('none');
    setRepeatEnds('never');
    repeatUntilAutoRef.current = true;
    setRepeatUntil(getDefaultRepeatUntil(defaultStart));
    setRepeatCount(4);
    setRepeatError('');
    setRepeatCreating(false);
    
    onOpenChange(false);
  };

  useEffect(() => {
    if (!statusId && statuses[0]?.id) {
      setStatusId(statuses[0].id);
    }
  }, [statusId, statuses]);

  useEffect(() => {
    if (!open) {
      setProjectInitialized(false);
      return;
    }
    if (projectInitialized) return;
    const nextStart = initialStartDate ?? defaultStart;
    const nextEnd = initialEndDate ?? nextStart;
    const nextProjectId = initialProjectId === null
      ? 'none'
      : (initialProjectId ?? activeProjects[0]?.id ?? 'none');
    const nextAssignees = normalizeAssigneeSelection(initialAssigneeIds)
      .filter((id) => selectableAssignees.some((assignee) => assignee.id === id));

    setStartDate(nextStart);
    setEndDate(nextEnd);
    setProjectId(nextProjectId);
    setAssigneeIds(nextAssignees);
    setRepeatFrequency('none');
    setRepeatEnds('never');
    repeatUntilAutoRef.current = true;
    setRepeatUntil(getDefaultRepeatUntil(nextStart));
    setRepeatCount(4);
    setRepeatError('');
    setProjectInitialized(true);
  }, [
    activeProjects,
    defaultStart,
    initialAssigneeIds,
    initialEndDate,
    initialProjectId,
    initialStartDate,
    normalizeAssigneeSelection,
    open,
    projectInitialized,
    selectableAssignees,
  ]);

  useEffect(() => {
    if (!typeId && taskTypes[0]?.id) {
      setTypeId(taskTypes[0].id);
    }
  }, [taskTypes, typeId]);

  const assigneeLabel = useMemo(() => {
    if (assigneeIds.length === 0) return 'Unassigned';
    const selected = selectableAssignees
      .filter((assignee) => assigneeIds.includes(assignee.id))
      .map((assignee) => assignee.name);
    if (selected.length === 1 && assigneeIds.length === 1) return selected[0];
    return `${assigneeIds.length} assignees`;
  }, [assigneeIds, selectableAssignees]);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-3 mt-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-title">Title *</Label>
            <Input
              id="new-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title..."
              autoFocus
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Project</SelectItem>
                  {activeProjects.map(p => (
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
            
            <div className="space-y-1.5">
              <Label>Assignees</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="truncate">{assigneeLabel}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  {selectableAssignees.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No assignees yet.</div>
                  ) : (
                    <ScrollArea className="max-h-48 pr-2">
                      <div className="space-y-1">
                        {selectableAssignees.map((assignee) => (
                          <label key={assignee.id} className="flex items-center gap-2 py-1 cursor-pointer">
                            <Checkbox
                              checked={assigneeIds.includes(assignee.id)}
                              onCheckedChange={() => handleAssigneeToggle(assignee.id)}
                            />
                            <span className="text-sm truncate">{assignee.name}</span>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={statusId} onValueChange={setStatusId}>
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
            
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={typeId} onValueChange={setTypeId}>
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
          </div>

          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority | 'none')}>
              <SelectTrigger>
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
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-start">Start Date</Label>
              <Input
                id="new-start"
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-end">End Date</Label>
              <Input
                id="new-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Repeat</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={repeatFrequency}
                onValueChange={(value) => handleRepeatFrequencyChange(value as typeof repeatFrequency)}
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
                onValueChange={(value) => handleRepeatEndsChange(value as typeof repeatEnds)}
                disabled={repeatFrequency === 'none'}
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
              <div className="space-y-1.5">
                <Label htmlFor="new-repeat-until" className="text-xs text-muted-foreground">End date</Label>
                <Input
                  id="new-repeat-until"
                  type="date"
                  value={repeatUntil}
                  onChange={(e) => {
                    repeatUntilAutoRef.current = false;
                    setRepeatUntil(e.target.value);
                  }}
                />
              </div>
            )}
            {repeatFrequency !== 'none' && repeatEnds === 'after' && (
              <div className="space-y-1.5">
                <Label htmlFor="new-repeat-count" className="text-xs text-muted-foreground">Occurrences</Label>
                <Input
                  id="new-repeat-count"
                  type="number"
                  min={1}
                  value={repeatCount}
                  onChange={(e) => setRepeatCount(Number(e.target.value))}
                />
              </div>
            )}
            {repeatError && (
              <div className="text-xs text-destructive">{repeatError}</div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="new-description">Description</Label>
            <RichTextEditor
              id="new-description"
              value={description}
              onChange={setDescription}
              placeholder="Add a description..."
            />
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            {tags.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tags available yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => {
                  const isSelected = tagIds.includes(tag.id);
                  return (
                    <Badge
                      key={tag.id}
                      variant={isSelected ? 'default' : 'outline'}
                      className={cn('transition-all cursor-pointer')}
                      style={isSelected ? { 
                        backgroundColor: tag.color,
                        borderColor: tag.color,
                      } : {
                        borderColor: tag.color,
                        color: tag.color,
                      }}
                      onClick={() => handleTagToggle(tag.id)}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                      </span>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || !statusId || !typeId || repeatCreating}>
              <Plus className="w-4 h-4 mr-2" />
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
