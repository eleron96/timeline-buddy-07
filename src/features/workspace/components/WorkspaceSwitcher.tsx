import React, { useEffect, useState } from 'react';
import { ChevronDown, Plus, Users } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { useAuthStore } from '@/features/auth/store/authStore';
import { WorkspaceMembersSheet } from '@/features/workspace/components/WorkspaceMembersSheet';
import { usePlannerStore } from '@/features/planner/store/plannerStore';
import { ColorPicker } from '@/shared/ui/color-picker';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion';
import { Switch } from '@/shared/ui/switch';
import { supabase } from '@/shared/lib/supabaseClient';

export const WorkspaceSwitcher: React.FC = () => {
  const {
    user,
    workspaces,
    currentWorkspaceId,
    currentWorkspaceRole,
    setCurrentWorkspaceId,
    createWorkspace,
  } = useAuthStore();
  const { statuses, taskTypes, tags } = usePlannerStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [templateStatuses, setTemplateStatuses] = useState<Array<{ name: string; color: string; is_final: boolean }>>([]);
  const [templateTypes, setTemplateTypes] = useState<Array<{ name: string; icon: string | null }>>([]);
  const [templateTags, setTemplateTags] = useState<Array<{ name: string; color: string }>>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState('');
  const [templateSaved, setTemplateSaved] = useState(false);
  const [newTemplateStatusName, setNewTemplateStatusName] = useState('');
  const [newTemplateStatusColor, setNewTemplateStatusColor] = useState('#3b82f6');
  const [newTemplateTypeName, setNewTemplateTypeName] = useState('');
  const [newTemplateTagName, setNewTemplateTagName] = useState('');
  const [newTemplateTagColor, setNewTemplateTagColor] = useState('#3b82f6');

  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId);
  const isAdmin = currentWorkspaceRole === 'admin';
  const canCreateWorkspace = workspaces.length < 5;

  useEffect(() => {
    if (!createOpen || !user) return;
    let active = true;

    const loadTemplate = async () => {
      setTemplateLoading(true);
      setTemplateError('');
      setTemplateSaved(false);
      const { data, error } = await supabase
        .from('user_workspace_templates')
        .select('statuses, task_types, tags')
        .eq('user_id', user.id)
        .single();

      if (!active) return;
      if (error) {
        if ((error as { code?: string }).code !== 'PGRST116') {
          setTemplateError(error.message);
        }
        setTemplateStatuses([]);
        setTemplateTypes([]);
        setTemplateTags([]);
        setTemplateLoading(false);
        return;
      }

      setTemplateStatuses((data?.statuses as Array<{ name: string; color: string; is_final?: boolean }>)?.map((item) => ({
        name: item.name ?? '',
        color: item.color ?? '#94a3b8',
        is_final: Boolean(item.is_final),
      })) ?? []);
      setTemplateTypes((data?.task_types as Array<{ name: string; icon?: string | null }>)?.map((item) => ({
        name: item.name ?? '',
        icon: item.icon ?? null,
      })) ?? []);
      setTemplateTags((data?.tags as Array<{ name: string; color: string }>)?.map((item) => ({
        name: item.name ?? '',
        color: item.color ?? '#94a3b8',
      })) ?? []);
      setTemplateLoading(false);
    };

    loadTemplate();
    return () => {
      active = false;
    };
  }, [createOpen, user]);

  const handleSaveTemplate = async () => {
    if (!user) return;
    setTemplateError('');
    setTemplateSaved(false);
    const { error } = await supabase
      .from('user_workspace_templates')
      .upsert({
        user_id: user.id,
        statuses: templateStatuses,
        task_types: templateTypes,
        tags: templateTags,
      });

    if (error) {
      setTemplateError(error.message);
      return;
    }
    setTemplateSaved(true);
  };

  const handleCopyWorkspaceToTemplate = () => {
    setTemplateStatuses(statuses.map((status) => ({
      name: status.name,
      color: status.color,
      is_final: status.isFinal,
    })));
    setTemplateTypes(taskTypes.map((type) => ({
      name: type.name,
      icon: type.icon ?? null,
    })));
    setTemplateTags(tags.map((tag) => ({
      name: tag.name,
      color: tag.color,
    })));
    setTemplateSaved(false);
  };

  const updateTemplateStatus = (index: number, updates: Partial<{ name: string; color: string; is_final: boolean }>) => {
    setTemplateStatuses((current) => current.map((item, i) => (i === index ? { ...item, ...updates } : item)));
    setTemplateSaved(false);
  };

  const updateTemplateType = (index: number, updates: Partial<{ name: string; icon: string | null }>) => {
    setTemplateTypes((current) => current.map((item, i) => (i === index ? { ...item, ...updates } : item)));
    setTemplateSaved(false);
  };

  const updateTemplateTag = (index: number, updates: Partial<{ name: string; color: string }>) => {
    setTemplateTags((current) => current.map((item, i) => (i === index ? { ...item, ...updates } : item)));
    setTemplateSaved(false);
  };

  const handleCreateWorkspace = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError('');
    if (!canCreateWorkspace) {
      setCreateError('Workspace limit reached (5).');
      return;
    }
    if (!workspaceName.trim()) return;

    setCreating(true);
    const result = await createWorkspace(workspaceName.trim());
    if (result.error) {
      setCreateError(result.error);
    } else {
      setWorkspaceName('');
      setCreateOpen(false);
    }
    setCreating(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <span className="max-w-[180px] truncate">{currentWorkspace?.name ?? 'Select workspace'}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={currentWorkspaceId ?? ''}
            onValueChange={(value) => setCurrentWorkspaceId(value)}
          >
            {workspaces.map((workspace) => (
              <DropdownMenuRadioItem
                key={workspace.id}
                value={workspace.id}
                className="data-[state=checked]:bg-zinc-800 data-[state=checked]:text-white"
              >
                <span className="truncate">{workspace.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => { event.preventDefault(); setCreateOpen(true); }}
            disabled={!canCreateWorkspace}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create workspace
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => { event.preventDefault(); setMembersOpen(true); }}
            disabled={!isAdmin}
          >
            <Users className="mr-2 h-4 w-4" />
            Manage members
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateWorkspace} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace name</Label>
              <Input
                id="workspace-name"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="My team workspace"
                autoFocus
                disabled={!canCreateWorkspace}
              />
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
            </div>

            <Accordion type="single" collapsible className="rounded-md border px-3">
              <AccordionItem value="template" className="border-none">
                <AccordionTrigger type="button" className="py-2 text-sm">Workspace template</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCopyWorkspaceToTemplate}
                        disabled={templateLoading}
                      >
                        Use current workspace
                      </Button>
                      <Button
                        type="button"
                        onClick={handleSaveTemplate}
                        disabled={!user || templateLoading}
                      >
                        Save template
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Template is used for all new workspaces.
                    </p>
                    {templateError && (
                      <div className="text-sm text-destructive">{templateError}</div>
                    )}
                    {templateSaved && (
                      <div className="text-sm text-emerald-600">Template saved.</div>
                    )}
                    {templateLoading && (
                      <div className="text-sm text-muted-foreground">Loading template...</div>
                    )}

                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">Statuses</h4>
                      <div className="flex gap-2">
                        <Input
                          placeholder="New status name..."
                          value={newTemplateStatusName}
                          onChange={(e) => setNewTemplateStatusName(e.target.value)}
                        />
                        <ColorPicker value={newTemplateStatusColor} onChange={setNewTemplateStatusColor} />
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => {
                            if (!newTemplateStatusName.trim()) return;
                            setTemplateStatuses((current) => [
                              ...current,
                              { name: newTemplateStatusName.trim(), color: newTemplateStatusColor, is_final: false },
                            ]);
                            setNewTemplateStatusName('');
                            setTemplateSaved(false);
                          }}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {templateStatuses.map((status, index) => (
                          <div key={`${status.name}-${index}`} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
                            <ColorPicker
                              value={status.color}
                              onChange={(color) => updateTemplateStatus(index, { color })}
                            />
                            <Input
                              value={status.name}
                              onChange={(e) => updateTemplateStatus(index, { name: e.target.value })}
                              className="flex-1 h-8"
                            />
                            <div className="flex items-center gap-1">
                              <Switch
                                id={`template-final-${index}`}
                                checked={status.is_final}
                                onCheckedChange={(isFinal) => updateTemplateStatus(index, { is_final: isFinal })}
                              />
                              <Label htmlFor={`template-final-${index}`} className="text-xs text-muted-foreground">
                                Final
                              </Label>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setTemplateStatuses((current) => current.filter((_, i) => i !== index));
                                setTemplateSaved(false);
                              }}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                              <Plus className="w-4 h-4 rotate-45" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">Types</h4>
                      <div className="flex gap-2">
                        <Input
                          placeholder="New type name..."
                          value={newTemplateTypeName}
                          onChange={(e) => setNewTemplateTypeName(e.target.value)}
                        />
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => {
                            if (!newTemplateTypeName.trim()) return;
                            setTemplateTypes((current) => [
                              ...current,
                              { name: newTemplateTypeName.trim(), icon: null },
                            ]);
                            setNewTemplateTypeName('');
                            setTemplateSaved(false);
                          }}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {templateTypes.map((type, index) => (
                          <div key={`${type.name}-${index}`} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                            <Input
                              value={type.name}
                              onChange={(e) => updateTemplateType(index, { name: e.target.value })}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setTemplateTypes((current) => current.filter((_, i) => i !== index));
                                setTemplateSaved(false);
                              }}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Plus className="w-4 h-4 rotate-45" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">Tags</h4>
                      <div className="flex gap-2">
                        <Input
                          placeholder="New tag name..."
                          value={newTemplateTagName}
                          onChange={(e) => setNewTemplateTagName(e.target.value)}
                        />
                        <ColorPicker value={newTemplateTagColor} onChange={setNewTemplateTagColor} />
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => {
                            if (!newTemplateTagName.trim()) return;
                            setTemplateTags((current) => [
                              ...current,
                              { name: newTemplateTagName.trim(), color: newTemplateTagColor },
                            ]);
                            setNewTemplateTagName('');
                            setTemplateSaved(false);
                          }}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {templateTags.map((tag, index) => (
                          <div key={`${tag.name}-${index}`} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
                            <ColorPicker
                              value={tag.color}
                              onChange={(color) => updateTemplateTag(index, { color })}
                            />
                            <Input
                              value={tag.name}
                              onChange={(e) => updateTemplateTag(index, { name: e.target.value })}
                              className="flex-1 h-8"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setTemplateTags((current) => current.filter((_, i) => i !== index));
                                setTemplateSaved(false);
                              }}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                              <Plus className="w-4 h-4 rotate-45" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !workspaceName.trim()}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <WorkspaceMembersSheet open={membersOpen} onOpenChange={setMembersOpen} />
    </>
  );
};
