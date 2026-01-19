import React, { useState } from 'react';
import { usePlannerStore } from '@/store/plannerStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Palette, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const PRESET_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899',
  '#ef4444', '#14b8a6', '#6366f1', '#f97316', '#84cc16',
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange }) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-6 h-6 rounded-full border-2 border-border hover:scale-110 transition-transform flex-shrink-0"
          style={{ backgroundColor: value }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="end">
        <div className="flex flex-wrap gap-2 max-w-[180px]">
          {PRESET_COLORS.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              className={cn(
                'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                value === color ? 'border-foreground scale-110' : 'border-transparent'
              )}
              style={{ backgroundColor: color }}
            />
          ))}
          <Input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-6 h-6 p-0 border-0 cursor-pointer"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ open, onOpenChange }) => {
  const {
    statuses, addStatus, updateStatus, deleteStatus,
    taskTypes, addTaskType, updateTaskType, deleteTaskType,
    tags, addTag, updateTag, deleteTag,
    projects, addProject, updateProject, deleteProject,
    assignees, addAssignee, updateAssignee, deleteAssignee,
  } = usePlannerStore();
  
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#3b82f6');
  
  const [newTypeName, setNewTypeName] = useState('');
  
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#3b82f6');
  
  const [newAssigneeName, setNewAssigneeName] = useState('');
  
  const handleAddStatus = () => {
    if (!newStatusName.trim()) return;
    addStatus({ name: newStatusName.trim(), color: newStatusColor, isFinal: false });
    setNewStatusName('');
  };
  
  const handleAddType = () => {
    if (!newTypeName.trim()) return;
    addTaskType({ name: newTypeName.trim(), icon: null });
    setNewTypeName('');
  };
  
  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    addTag({ name: newTagName.trim(), color: newTagColor });
    setNewTagName('');
  };
  
  const handleAddProject = () => {
    if (!newProjectName.trim()) return;
    addProject({ name: newProjectName.trim(), color: newProjectColor });
    setNewProjectName('');
  };
  
  const handleAddAssignee = () => {
    if (!newAssigneeName.trim()) return;
    addAssignee({ name: newAssigneeName.trim() });
    setNewAssigneeName('');
  };
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:w-[600px] overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Settings
          </SheetTitle>
        </SheetHeader>
        
        <Tabs defaultValue="statuses" className="flex-1 flex flex-col mt-4 overflow-hidden">
          <TabsList className="grid grid-cols-5 mb-4">
            <TabsTrigger value="statuses">Statuses</TabsTrigger>
            <TabsTrigger value="types">Types</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
          </TabsList>
          
          <ScrollArea className="flex-1">
            {/* Statuses */}
            <TabsContent value="statuses" className="space-y-4 m-0">
              <div className="flex gap-2">
                <Input
                  placeholder="New status name..."
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddStatus()}
                />
                <Button onClick={handleAddStatus} size="icon">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                {statuses.map(status => (
                  <div key={status.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <ColorPicker
                      value={status.color}
                      onChange={(color) => updateStatus(status.id, { color })}
                    />
                    <Input
                      value={status.name}
                      onChange={(e) => updateStatus(status.id, { name: e.target.value })}
                      className="flex-1 h-8"
                    />
                    <div className="flex items-center gap-1">
                      <Switch
                        id={`final-${status.id}`}
                        checked={status.isFinal}
                        onCheckedChange={(isFinal) => updateStatus(status.id, { isFinal })}
                      />
                      <Label htmlFor={`final-${status.id}`} className="text-xs text-muted-foreground">
                        Final
                      </Label>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteStatus(status.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>
            
            {/* Types */}
            <TabsContent value="types" className="space-y-4 m-0">
              <div className="flex gap-2">
                <Input
                  placeholder="New type name..."
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddType()}
                />
                <Button onClick={handleAddType} size="icon">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                {taskTypes.map(type => (
                  <div key={type.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Input
                      value={type.name}
                      onChange={(e) => updateTaskType(type.id, { name: e.target.value })}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTaskType(type.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>
            
            {/* Tags */}
            <TabsContent value="tags" className="space-y-4 m-0">
              <div className="flex gap-2">
                <Input
                  placeholder="New tag name..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                />
                <Button onClick={handleAddTag} size="icon">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                {tags.map(tag => (
                  <div key={tag.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <ColorPicker
                      value={tag.color}
                      onChange={(color) => updateTag(tag.id, { color })}
                    />
                    <Input
                      value={tag.name}
                      onChange={(e) => updateTag(tag.id, { name: e.target.value })}
                      className="flex-1 h-8"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTag(tag.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>
            
            {/* Projects */}
            <TabsContent value="projects" className="space-y-4 m-0">
              <div className="flex gap-2">
                <Input
                  placeholder="New project name..."
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddProject()}
                />
                <Button onClick={handleAddProject} size="icon">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                {projects.map(project => (
                  <div key={project.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <ColorPicker
                      value={project.color}
                      onChange={(color) => updateProject(project.id, { color })}
                    />
                    <Input
                      value={project.name}
                      onChange={(e) => updateProject(project.id, { name: e.target.value })}
                      className="flex-1 h-8"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteProject(project.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>
            
            {/* People */}
            <TabsContent value="people" className="space-y-4 m-0">
              <div className="flex gap-2">
                <Input
                  placeholder="New person name..."
                  value={newAssigneeName}
                  onChange={(e) => setNewAssigneeName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddAssignee()}
                />
                <Button onClick={handleAddAssignee} size="icon">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                {assignees.map(assignee => (
                  <div key={assignee.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Input
                      value={assignee.name}
                      onChange={(e) => updateAssignee(assignee.id, { name: e.target.value })}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteAssignee(assignee.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
