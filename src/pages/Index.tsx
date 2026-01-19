import React, { useState } from 'react';
import { TimelineGrid } from '@/components/timeline/TimelineGrid';
import { TimelineControls } from '@/components/timeline/TimelineControls';
import { FilterPanel } from '@/components/FilterPanel';
import { TaskDetailPanel } from '@/components/TaskDetailPanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { Button } from '@/components/ui/button';
import { Plus, Settings } from 'lucide-react';
import { usePlannerStore } from '@/store/plannerStore';

const Index = () => {
  const [filterCollapsed, setFilterCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const { setSelectedTaskId } = usePlannerStore();
  
  const handleBackgroundClick = () => {
    setSelectedTaskId(null);
  };
  
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">Timeline Planner</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowAddTask(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSettings(true)}
            className="h-9 w-9"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>
      
      {/* Main content */}
      <div className="flex flex-1 overflow-hidden" onClick={handleBackgroundClick}>
        {/* Filter sidebar */}
        <FilterPanel 
          collapsed={filterCollapsed} 
          onToggle={() => setFilterCollapsed(!filterCollapsed)} 
        />
        
        {/* Timeline area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <TimelineControls />
          <TimelineGrid />
        </div>
      </div>
      
      {/* Panels */}
      <TaskDetailPanel />
      <SettingsPanel open={showSettings} onOpenChange={setShowSettings} />
      <AddTaskDialog open={showAddTask} onOpenChange={setShowAddTask} />
    </div>
  );
};

export default Index;
