import React, { useEffect, useState } from 'react';
import { usePlannerStore } from '@/features/planner/store/plannerStore';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useFilteredAssignees } from '@/features/planner/hooks/useFilteredAssignees';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Switch } from '@/shared/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
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
import { Plus, Trash2, Settings2 } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { ColorPicker } from '@/shared/ui/color-picker';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SectionCard: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
    {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
    {children}
  </div>
);

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ open, onOpenChange }) => {
  const {
    statuses, addStatus, updateStatus, deleteStatus,
    taskTypes, addTaskType, updateTaskType, deleteTaskType,
    tags, addTag, updateTag, deleteTag,
    projects, addProject, updateProject, deleteProject,
    assignees,
    workspaceId,
    loadWorkspaceData,
  } = usePlannerStore();

  const {
    user,
    workspaces,
    currentWorkspaceId,
    currentWorkspaceRole,
    updateWorkspaceName,
    deleteWorkspace,
  } = useAuthStore();

  // ✅ ВАЖНО: объявляем filteredAssignees, иначе будет ReferenceError и белый экран
  const filteredAssignees = useFilteredAssignees(assignees);

  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#3b82f6');

  const [newTypeName, setNewTypeName] = useState('');

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');

  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#3b82f6');

  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId);
  const isAdmin = currentWorkspaceRole === 'admin';

  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceError, setWorkspaceError] = useState('');
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [templateApplyError, setTemplateApplyError] = useState('');
  const [templateApplying, setTemplateApplying] = useState(false);
  const [templateApplied, setTemplateApplied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWorkspaceName(currentWorkspace?.name ?? '');
    setWorkspaceError('');
    setTemplateApplyError('');
    setTemplateApplied(false);
  }, [open, currentWorkspace?.name]);

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

  const handleSaveWorkspaceName = async () => {
    if (!currentWorkspaceId) {
      setWorkspaceError('Workspace not selected.');
      return;
    }
    setWorkspaceError('');
    setWorkspaceSaving(true);
    const result = await updateWorkspaceName(currentWorkspaceId, workspaceName);
    if (result.error) {
      setWorkspaceError(result.error);
      setWorkspaceSaving(false);
      return;
    }
    setWorkspaceSaving(false);
  };

  const handleDeleteWorkspace = async () => {
    if (!currentWorkspaceId) {
      setWorkspaceError('Workspace not selected.');
      return;
    }
    setWorkspaceError('');
    const result = await deleteWorkspace(currentWorkspaceId);
    if (result.error) {
      setWorkspaceError(result.error);
      return;
    }
    setDeleteOpen(false);
  };

  const handleApplyTemplate = async () => {
    if (!user) {
      setTemplateApplyError('You are not signed in.');
      return;
    }
    if (!workspaceId) {
      setTemplateApplyError('Workspace not selected.');
      return;
    }

    setTemplateApplying(true);
    setTemplateApplyError('');
    setTemplateApplied(false);

    const { data, error } = await supabase
      .from('user_workspace_templates')
      .select('statuses, task_types, tags')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if ((error as { code?: string }).code === 'PGRST116') {
        setTemplateApplyError('No template saved yet.');
      } else {
        setTemplateApplyError(error.message);
      }
      setTemplateApplying(false);
      return;
    }

    const templateStatuses = (data?.statuses as Array<{ name: string; color: string; is_final?: boolean }>) ?? [];
    const templateTypes = (data?.task_types as Array<{ name: string; icon?: string | null }>) ?? [];
    const templateTags = (data?.tags as Array<{ name: string; color: string }>) ?? [];

    const statusNames = new Set(statuses.map((status) => status.name.trim().toLowerCase()));
    const typeNames = new Set(taskTypes.map((type) => type.name.trim().toLowerCase()));
    const tagNames = new Set(tags.map((tag) => tag.name.trim().toLowerCase()));

    const newStatuses = templateStatuses.filter((status) => {
      const name = status.name?.trim().toLowerCase();
      return name && !statusNames.has(name);
    });
    const newTypes = templateTypes.filter((type) => {
      const name = type.name?.trim().toLowerCase();
      return name && !typeNames.has(name);
    });
    const newTags = templateTags.filter((tag) => {
      const name = tag.name?.trim().toLowerCase();
      return name && !tagNames.has(name);
    });

    try {
      if (newStatuses.length > 0) {
        const { error } = await supabase
          .from('statuses')
          .insert(newStatuses.map((status) => ({
            workspace_id: workspaceId,
            name: status.name.trim(),
            color: status.color ?? '#94a3b8',
            is_final: Boolean(status.is_final),
          })));
        if (error) throw error;
      }

      if (newTypes.length > 0) {
        const { error } = await supabase
          .from('task_types')
          .insert(newTypes.map((type) => ({
            workspace_id: workspaceId,
            name: type.name.trim(),
            icon: type.icon ?? null,
          })));
        if (error) throw error;
      }

      if (newTags.length > 0) {
        const { error } = await supabase
          .from('tags')
          .insert(newTags.map((tag) => ({
            workspace_id: workspaceId,
            name: tag.name.trim(),
            color: tag.color ?? '#94a3b8',
          })));
        if (error) throw error;
      }

      await loadWorkspaceData(workspaceId);
      setTemplateApplied(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply template.';
      setTemplateApplyError(message);
    } finally {
      setTemplateApplying(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              Workspace settings
            </SheetTitle>
          </SheetHeader>

          <Tabs defaultValue="workspace" className="flex-1 flex flex-col mt-4">
            <TabsList className="flex flex-wrap w-full h-auto items-start justify-start gap-2 mb-4">
              <TabsTrigger value="workspace" className="whitespace-nowrap">Workspace</TabsTrigger>
              <TabsTrigger value="statuses" className="whitespace-nowrap">Statuses</TabsTrigger>
              <TabsTrigger value="types" className="whitespace-nowrap">Types</TabsTrigger>
              <TabsTrigger value="tags" className="whitespace-nowrap">Tags</TabsTrigger>
              <TabsTrigger value="projects" className="whitespace-nowrap">Projects</TabsTrigger>
              <TabsTrigger value="people" className="whitespace-nowrap">People</TabsTrigger>
            </TabsList>

            <div className="flex-1 space-y-4">
              {/* Workspace */}
              <TabsContent value="workspace" className="space-y-4 m-0">
                {!isAdmin && (
                  <SectionCard title="Access">
                    <p className="text-sm text-muted-foreground">
                      You have view access and cannot edit this workspace.
                    </p>
                  </SectionCard>
                )}

                <SectionCard title="Name">
                  <div className="space-y-2">
                    <Label htmlFor="workspace-name">Workspace name</Label>
                    <Input
                      id="workspace-name"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      disabled={!isAdmin || !currentWorkspaceId || workspaceSaving}
                    />
                    {workspaceError && (
                      <div className="text-sm text-destructive">{workspaceError}</div>
                    )}
                    <Button
                      onClick={handleSaveWorkspaceName}
                      disabled={!isAdmin || !currentWorkspaceId || workspaceSaving || !workspaceName.trim()}
                    >
                      Save
                    </Button>
                  </div>
                </SectionCard>

                <SectionCard title="Template">
                  <p className="text-xs text-muted-foreground">
                    Apply your saved template to this workspace (adds missing items by name).
                  </p>
                  {templateApplyError && (
                    <div className="text-sm text-destructive">{templateApplyError}</div>
                  )}
                  {templateApplied && (
                    <div className="text-sm text-emerald-600">Template applied.</div>
                  )}
                  <Button
                    variant="secondary"
                    onClick={handleApplyTemplate}
                    disabled={!user || !currentWorkspaceId || templateApplying}
                  >
                    Apply template
                  </Button>
                </SectionCard>

                <SectionCard title="Danger zone">
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                    disabled={!isAdmin || !currentWorkspaceId}
                  >
                    Delete workspace
                  </Button>
                </SectionCard>
              </TabsContent>

              {/* Statuses */}
              <TabsContent value="statuses" className="space-y-4 m-0">
                <SectionCard title="Add status">
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
                </SectionCard>

                <SectionCard title="Statuses">
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
                </SectionCard>
              </TabsContent>

              {/* Types */}
              <TabsContent value="types" className="space-y-4 m-0">
                <SectionCard title="Add type">
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
                </SectionCard>

                <SectionCard title="Types">
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
                </SectionCard>
              </TabsContent>

              {/* Tags */}
              <TabsContent value="tags" className="space-y-4 m-0">
                <SectionCard title="Add tag">
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
                </SectionCard>

                <SectionCard title="Tags">
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
                </SectionCard>
              </TabsContent>

              {/* Projects */}
              <TabsContent value="projects" className="space-y-4 m-0">
                <SectionCard title="Add project">
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
                </SectionCard>

                <SectionCard title="Projects">
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
                </SectionCard>
              </TabsContent>

              {/* People */}
              <TabsContent value="people" className="space-y-4 m-0">
                <SectionCard title="People">
                  <p className="text-sm text-muted-foreground">
                    People are workspace members. Manage members from the workspace menu.
                  </p>

                  <div className="space-y-2">
                    {filteredAssignees.length === 0 && (
                      <div className="text-sm text-muted-foreground">No members yet.</div>
                    )}
                    {filteredAssignees.map((assignee) => (
                      <div key={assignee.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm font-medium truncate">{assignee.name}</span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </TabsContent>
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{currentWorkspace?.name ?? 'this workspace'}" and all its data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteWorkspace}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
