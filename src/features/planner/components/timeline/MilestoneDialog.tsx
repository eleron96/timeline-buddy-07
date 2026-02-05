import React, { useEffect, useMemo, useState } from 'react';
import { usePlannerStore } from '@/features/planner/store/plannerStore';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { formatProjectLabel } from '@/shared/lib/projectLabels';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Milestone } from '@/features/planner/types/planner';
import { format, parseISO } from 'date-fns';

interface MilestoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string | null;
  milestone: Milestone | null;
  canEdit: boolean;
}

export const MilestoneDialog: React.FC<MilestoneDialogProps> = ({
  open,
  onOpenChange,
  date,
  milestone,
  canEdit,
}) => {
  const { projects, addMilestone, updateMilestone, deleteMilestone } = usePlannerStore();
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');

  const mode = milestone ? 'edit' : 'create';
  const activeProjects = useMemo(() => projects.filter((project) => !project.archived), [projects]);
  const currentProject = useMemo(
    () => projects.find((project) => project.id === milestone?.projectId),
    [projects, milestone?.projectId],
  );
  const archivedProject = currentProject?.archived ? currentProject : null;
  const projectOptions = useMemo(() => {
    if (!archivedProject) return activeProjects;
    return [archivedProject, ...activeProjects.filter((project) => project.id !== archivedProject.id)];
  }, [activeProjects, archivedProject]);
  const hasProjects = activeProjects.length > 0 || Boolean(archivedProject);
  const selectedDate = milestone?.date ?? date;
  const formattedDate = useMemo(() => {
    if (!selectedDate) return '';
    return format(parseISO(selectedDate), 'd MMM yyyy');
  }, [selectedDate]);

  useEffect(() => {
    if (!open) return;
    if (milestone) {
      setTitle(milestone.title);
      setProjectId(milestone.projectId);
      return;
    }
    setTitle('');
    setProjectId(activeProjects[0]?.id ?? '');
  }, [milestone, open, activeProjects]);

  const handleSave = async () => {
    if (!canEdit || !selectedDate || !projectId || !title.trim()) return;
    const payload = {
      title: title.trim(),
      projectId,
      date: selectedDate,
    };
    if (milestone) {
      await updateMilestone(milestone.id, payload);
    } else {
      await addMilestone(payload);
    }
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!canEdit || !milestone) return;
    await deleteMilestone(milestone.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit milestone' : 'Create milestone'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {selectedDate && (
            <div className="text-sm text-muted-foreground">
              Date: <span className="text-foreground font-medium">{formattedDate}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="milestone-title">Name</Label>
            <Input
              id="milestone-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Milestone name..."
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label>Project</Label>
            <Select
              value={projectId}
              onValueChange={setProjectId}
              disabled={!canEdit || !hasProjects}
            >
              <SelectTrigger>
                <SelectValue placeholder={hasProjects ? 'Select project' : 'No projects'} />
              </SelectTrigger>
              <SelectContent>
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
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {mode === 'edit' && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={!canEdit}
            >
              Delete
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canEdit || !title.trim() || !projectId}
          >
            {mode === 'edit' ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
