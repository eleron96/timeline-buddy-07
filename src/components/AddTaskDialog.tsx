import React, { useEffect, useState } from 'react';
import { usePlannerStore } from '@/store/plannerStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { format, addDays } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';
import { TaskPriority } from '@/types/planner';

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddTaskDialog: React.FC<AddTaskDialogProps> = ({ open, onOpenChange }) => {
  const { projects, assignees, statuses, taskTypes, tags, addTask } = usePlannerStore();
  
  const today = new Date();
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<string>('none');
  const [projectInitialized, setProjectInitialized] = useState(false);
  const [assigneeId, setAssigneeId] = useState<string>('none');
  const [statusId, setStatusId] = useState(statuses[0]?.id || '');
  const [typeId, setTypeId] = useState(taskTypes[0]?.id || '');
  const [priority, setPriority] = useState<TaskPriority | 'none'>('none');
  const [startDate, setStartDate] = useState(format(today, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(today, 2), 'yyyy-MM-dd'));
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [description, setDescription] = useState('');

  const handleTagToggle = (tagId: string) => {
    setTagIds((prev) => (
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    ));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !statusId || !typeId) return;
    
    addTask({
      title: title.trim(),
      projectId: projectId === 'none' ? null : projectId,
      assigneeId: assigneeId === 'none' ? null : assigneeId,
      statusId,
      typeId,
      priority: priority === 'none' ? null : priority,
      startDate,
      endDate,
      tagIds,
      description: description.trim() || null,
      repeatId: null,
    });
    
    // Reset form
    setTitle('');
    setProjectId(projects[0]?.id || 'none');
    setProjectInitialized(false);
    setAssigneeId('none');
    setStatusId(statuses[0]?.id || '');
    setTypeId(taskTypes[0]?.id || '');
    setPriority('none');
    setStartDate(format(today, 'yyyy-MM-dd'));
    setEndDate(format(addDays(today, 2), 'yyyy-MM-dd'));
    setTagIds([]);
    setDescription('');
    
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
    setProjectId(projects[0]?.id || 'none');
    setProjectInitialized(true);
  }, [open, projectInitialized, projects]);

  useEffect(() => {
    if (!typeId && taskTypes[0]?.id) {
      setTypeId(taskTypes[0].id);
    }
  }, [taskTypes, typeId]);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="new-title">Title *</Label>
            <Input
              id="new-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title..."
              autoFocus
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
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
              <Label>Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
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
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
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
            
            <div className="space-y-2">
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

          <div className="space-y-2">
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
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-start">Start Date</Label>
              <Input
                id="new-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
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
              <div className="flex flex-wrap gap-2">
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
            <Button type="submit" disabled={!title.trim() || !statusId || !typeId}>
              <Plus className="w-4 h-4 mr-2" />
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
