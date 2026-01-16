import React, { useState } from 'react';
import { usePlannerStore } from '@/store/plannerStore';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, X } from 'lucide-react';
import { format, parseISO } from '@/utils/dateUtils';

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
  } = usePlannerStore();
  
  const task = tasks.find(t => t.id === selectedTaskId);
  
  if (!task) {
    return (
      <Sheet open={!!selectedTaskId} onOpenChange={() => setSelectedTaskId(null)}>
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
  
  const handleUpdate = (field: string, value: any) => {
    updateTask(task.id, { [field]: value });
  };
  
  const handleTagToggle = (tagId: string) => {
    const newTagIds = task.tagIds.includes(tagId)
      ? task.tagIds.filter(id => id !== tagId)
      : [...task.tagIds, tagId];
    updateTask(task.id, { tagIds: newTagIds });
  };
  
  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this task?')) {
      deleteTask(task.id);
    }
  };
  
  return (
    <Sheet open={!!selectedTaskId} onOpenChange={() => setSelectedTaskId(null)}>
      <SheetContent className="w-[400px] sm:w-[450px] overflow-y-auto">
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
            />
          </div>
          
          {/* Project */}
          <div className="space-y-2">
            <Label>Project</Label>
            <Select 
              value={task.projectId || 'none'} 
              onValueChange={(v) => handleUpdate('projectId', v === 'none' ? null : v)}
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={task.endDate}
                onChange={(e) => handleUpdate('endDate', e.target.value)}
              />
            </div>
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
                    className="cursor-pointer transition-all"
                    style={isSelected ? { 
                      backgroundColor: tag.color,
                      borderColor: tag.color,
                    } : {
                      borderColor: tag.color,
                      color: tag.color,
                    }}
                    onClick={() => handleTagToggle(tag.id)}
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
            />
          </div>
          
          {/* Delete button */}
          <div className="pt-4 border-t border-border">
            <Button 
              variant="destructive" 
              className="w-full"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Task
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
