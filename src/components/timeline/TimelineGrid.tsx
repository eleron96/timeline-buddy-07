import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { usePlannerStore } from '@/store/plannerStore';
import { useAuthStore } from '@/store/authStore';
import { TimelineHeader } from './TimelineHeader';
import { TimelineRow } from './TimelineRow';
import { TaskBar } from './TaskBar';
import { getVisibleDays, getDayWidth, getTaskPosition, checkOverlap, SIDEBAR_WIDTH, HEADER_HEIGHT, MIN_ROW_HEIGHT, TASK_HEIGHT, TASK_GAP } from '@/utils/dateUtils';
import { Task } from '@/types/planner';
import { calculateTaskLanes, getMaxLanes, TaskWithLane } from '@/utils/taskLanes';

export const TimelineGrid: React.FC = () => {
  const { 
    tasks, 
    projects, 
    assignees, 
    viewMode, 
    groupMode, 
    currentDate,
    filters,
  } = usePlannerStore();
  const currentWorkspaceRole = useAuthStore((state) => state.currentWorkspaceRole);
  const canEdit = currentWorkspaceRole === 'editor' || currentWorkspaceRole === 'admin';
  
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  
  const visibleDays = useMemo(() => getVisibleDays(currentDate, viewMode), [currentDate, viewMode]);
  const dayWidth = useMemo(() => getDayWidth(viewMode), [viewMode]);
  const totalWidth = visibleDays.length * dayWidth;
  
  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filters.projectIds.length > 0 && task.projectId && !filters.projectIds.includes(task.projectId)) {
        return false;
      }
      if (filters.assigneeIds.length > 0 && task.assigneeId && !filters.assigneeIds.includes(task.assigneeId)) {
        return false;
      }
      if (filters.statusIds.length > 0 && !filters.statusIds.includes(task.statusId)) {
        return false;
      }
      if (filters.typeIds.length > 0 && !filters.typeIds.includes(task.typeId)) {
        return false;
      }
      if (filters.tagIds.length > 0 && !filters.tagIds.some(id => task.tagIds.includes(id))) {
        return false;
      }
      return true;
    });
  }, [tasks, filters]);
  
  // Group items (assignees or projects)
  const groupItems = useMemo(() => {
    if (groupMode === 'assignee') {
      return assignees.map(a => ({ id: a.id, name: a.name, color: undefined }));
    }
    return projects.map(p => ({ id: p.id, name: p.name, color: p.color }));
  }, [groupMode, assignees, projects]);
  
  // Group tasks by row with lane calculation
  const tasksByRow = useMemo(() => {
    const grouped: Record<string, TaskWithLane[]> = {};
    
    groupItems.forEach(item => {
      grouped[item.id] = [];
    });
    grouped['unassigned'] = [];
    
    // Group tasks first
    const tasksPerGroup: Record<string, Task[]> = {};
    groupItems.forEach(item => {
      tasksPerGroup[item.id] = [];
    });
    tasksPerGroup['unassigned'] = [];
    
    filteredTasks.forEach(task => {
      const groupId = groupMode === 'assignee' 
        ? (task.assigneeId || 'unassigned')
        : (task.projectId || 'unassigned');
      
      if (!tasksPerGroup[groupId]) {
        tasksPerGroup[groupId] = [];
      }
      tasksPerGroup[groupId].push(task);
    });
    
    // Calculate lanes for each group
    Object.entries(tasksPerGroup).forEach(([groupId, tasks]) => {
      grouped[groupId] = calculateTaskLanes(tasks);
    });
    
    return grouped;
  }, [filteredTasks, groupItems, groupMode]);
  
  // Calculate row heights based on max lanes
  const rowHeights = useMemo(() => {
    const heights: Record<string, number> = {};
    
    Object.entries(tasksByRow).forEach(([groupId, tasks]) => {
      const maxLanes = getMaxLanes(tasks);
      // Calculate height: padding (16px) + (task height + gap) * lanes
      const calculatedHeight = 16 + maxLanes * (TASK_HEIGHT + TASK_GAP);
      heights[groupId] = Math.max(MIN_ROW_HEIGHT, calculatedHeight);
    });
    
    return heights;
  }, [tasksByRow]);
  
  // Check for overlapping tasks per assignee (for warning indicators)
  const overlappingTaskIds = useMemo(() => {
    const overlaps = new Set<string>();
    
    // Only check overlaps for assignee view
    if (groupMode !== 'assignee') return overlaps;
    
    Object.values(tasksByRow).forEach(rowTasks => {
      for (let i = 0; i < rowTasks.length; i++) {
        for (let j = i + 1; j < rowTasks.length; j++) {
          if (checkOverlap(
            rowTasks[i].startDate,
            rowTasks[i].endDate,
            rowTasks[j].startDate,
            rowTasks[j].endDate
          )) {
            overlaps.add(rowTasks[i].id);
            overlaps.add(rowTasks[j].id);
          }
        }
      }
    });
    
    return overlaps;
  }, [tasksByRow, groupMode]);
  
  // Sync scroll between header and grid
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollLeft = e.currentTarget.scrollLeft;
    setScrollLeft(newScrollLeft);
    
    // Sync header scroll
    if (containerRef.current && e.currentTarget !== containerRef.current) {
      containerRef.current.scrollLeft = newScrollLeft;
    }
    if (scrollContainerRef.current && e.currentTarget !== scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = newScrollLeft;
    }
  }, []);
  
  // Center scroll on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      const centerOffset = (totalWidth - scrollContainerRef.current.clientWidth) / 2;
      scrollContainerRef.current.scrollLeft = Math.max(0, centerOffset);
      setScrollLeft(scrollContainerRef.current.scrollLeft);
      
      if (containerRef.current) {
        containerRef.current.scrollLeft = scrollContainerRef.current.scrollLeft;
      }
    }
  }, [totalWidth]);
  
  // Rows to display (including unassigned if there are unassigned tasks)
  const displayRows = useMemo(() => {
    const rows = groupItems.map(item => ({
      ...item,
      tasks: tasksByRow[item.id] || [],
      height: rowHeights[item.id] || MIN_ROW_HEIGHT,
    }));
    
    if (tasksByRow['unassigned']?.length > 0) {
      rows.push({
        id: 'unassigned',
        name: groupMode === 'assignee' ? 'Unassigned' : 'No Project',
        color: '#94a3b8',
        tasks: tasksByRow['unassigned'],
        height: rowHeights['unassigned'] || MIN_ROW_HEIGHT,
      });
    }
    
    return rows;
  }, [groupItems, tasksByRow, rowHeights, groupMode]);
  
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Timeline Header - Sticky */}
      <div className="flex border-b border-border sticky top-0 z-20 bg-background" style={{ height: HEADER_HEIGHT }}>
        {/* Sidebar header spacer */}
        <div 
          className="flex-shrink-0 bg-timeline-header border-r border-border"
          style={{ width: SIDEBAR_WIDTH }}
        />
        {/* Day headers - synced scroll, hide scrollbar */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-x-auto scrollbar-thin"
          onScroll={handleScroll}
          style={{ overflowY: 'hidden' }}
        >
          <TimelineHeader 
            visibleDays={visibleDays} 
            dayWidth={dayWidth} 
            viewMode={viewMode}
          />
        </div>
      </div>
      
      {/* Timeline Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - fixed left */}
        <div 
          className="flex-shrink-0 overflow-y-auto bg-card border-r border-border scrollbar-thin"
          style={{ width: SIDEBAR_WIDTH }}
        >
          {displayRows.map((row) => (
            <div 
              key={row.id}
              className="flex items-center px-4 border-b border-border hover:bg-timeline-row-hover transition-colors"
              style={{ height: row.height }}
            >
              {row.color && (
                <div 
                  className="w-3 h-3 rounded-full mr-3 flex-shrink-0"
                  style={{ backgroundColor: row.color }}
                />
              )}
              <span className="text-sm font-medium text-foreground truncate">
                {row.name}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {row.tasks.length}
              </span>
            </div>
          ))}
        </div>
        
        {/* Grid area */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-auto scrollbar-thin"
          onScroll={handleScroll}
        >
          <div style={{ width: totalWidth, minHeight: '100%' }}>
            {displayRows.map((row, rowIndex) => (
              <TimelineRow
                key={row.id}
                rowId={row.id}
                rowIndex={rowIndex}
                visibleDays={visibleDays}
                dayWidth={dayWidth}
                viewMode={viewMode}
                height={row.height}
              >
                {row.tasks.map(task => {
                  const position = getTaskPosition(
                    task.startDate,
                    task.endDate,
                    visibleDays,
                    dayWidth
                  );
                  
                  if (!position) return null;
                  
                  return (
                    <TaskBar
                      key={task.id}
                      task={task}
                      position={position}
                      dayWidth={dayWidth}
                      visibleDays={visibleDays}
                      isOverlapping={overlappingTaskIds.has(task.id)}
                      lane={task.lane}
                      canEdit={canEdit}
                    />
                  );
                })}
              </TimelineRow>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
