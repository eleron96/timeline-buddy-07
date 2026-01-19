import React, { useEffect, useState } from 'react';
import { TimelineGrid } from '@/components/timeline/TimelineGrid';
import { TimelineControls } from '@/components/timeline/TimelineControls';
import { FilterPanel } from '@/components/FilterPanel';
import { TaskDetailPanel } from '@/components/TaskDetailPanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import { AccountSettingsDialog } from '@/components/AccountSettingsDialog';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { Button } from '@/components/ui/button';
import { Plus, Settings, User } from 'lucide-react';
import { usePlannerStore } from '@/store/plannerStore';
import { useAuthStore } from '@/store/authStore';
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher';

const Index = () => {
  const [filterCollapsed, setFilterCollapsed] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const loadWorkspaceData = usePlannerStore((state) => state.loadWorkspaceData);
  const plannerLoading = usePlannerStore((state) => state.loading);
  const plannerError = usePlannerStore((state) => state.error);
  const currentWorkspaceId = useAuthStore((state) => state.currentWorkspaceId);
  const currentWorkspaceRole = useAuthStore((state) => state.currentWorkspaceRole);
  const canEdit = currentWorkspaceRole === 'editor' || currentWorkspaceRole === 'admin';

  useEffect(() => {
    if (currentWorkspaceId) {
      loadWorkspaceData(currentWorkspaceId);
    }
  }, [currentWorkspaceId, loadWorkspaceData]);
  
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <WorkspaceSwitcher />
          <div className="h-6 w-px bg-border" />
          <h1 className="text-xl font-semibold text-foreground">Timeline Planner</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowAddTask(true)} className="gap-2" disabled={!canEdit}>
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSettings(true)}
            className="h-9 w-9"
            disabled={!canEdit}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowAccountSettings(true)}
            className="h-9 w-9"
          >
            <User className="h-4 w-4" />
          </Button>
        </div>
      </header>
      
      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Filter sidebar */}
        <FilterPanel 
          collapsed={filterCollapsed} 
          onToggle={() => setFilterCollapsed(!filterCollapsed)} 
        />
        
        {/* Timeline area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <TimelineControls />
          {plannerLoading && (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Loading workspace...
            </div>
          )}
          {!plannerLoading && plannerError && (
            <div className="flex flex-1 items-center justify-center text-sm text-destructive">
              {plannerError}
            </div>
          )}
          {!plannerLoading && !plannerError && <TimelineGrid />}
        </div>
      </div>
      
      {/* Panels */}
      <TaskDetailPanel />
      <SettingsPanel open={showSettings} onOpenChange={setShowSettings} />
      <AccountSettingsDialog open={showAccountSettings} onOpenChange={setShowAccountSettings} />
      <AddTaskDialog open={showAddTask} onOpenChange={setShowAddTask} />
    </div>
  );
};

export default Index;
