import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { usePlannerStore } from '@/store/plannerStore';
import { TimelineHeader } from './TimelineHeader';
import { TimelineRow } from './TimelineRow';
import { TaskBar } from './TaskBar';
import { getVisibleDays, getDayWidth, getTaskPosition, checkOverlap, SIDEBAR_WIDTH, HEADER_HEIGHT, ROW_HEIGHT } from '@/utils/dateUtils';
import { Task } from '@/types/planner';

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
  
  const containerRef = useRef<HTMLDivElement>(null);
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
  
  // Group tasks by row
  const tasksByRow = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    
    groupItems.forEach(item => {
      grouped[item.id] = [];
    });
    grouped['unassigned'] = [];
    
    filteredTasks.forEach(task => {
      const groupId = groupMode === 'assignee' 
        ? (task.assigneeId || 'unassigned')
        : (task.projectId || 'unassigned');
      
      if (!grouped[groupId]) {
        grouped[groupId] = [];
      }
      grouped[groupId].push(task);
    });
    
    return grouped;
  }, [filteredTasks, groupItems, groupMode]);
  
  // Check for overlapping tasks per assignee
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
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft(e.currentTarget.scrollLeft);
  }, []);
  
  // Center scroll on mount
  useEffect(() => {
    if (containerRef.current) {
      const centerOffset = (totalWidth - containerRef.current.clientWidth) / 2;
      containerRef.current.scrollLeft = Math.max(0, centerOffset);
      setScrollLeft(containerRef.current.scrollLeft);
    }
  }, [totalWidth]);
  
  // Rows to display (including unassigned if there are unassigned tasks)
  const displayRows = useMemo(() => {
    const rows = groupItems.map(item => ({
      ...item,
      tasks: tasksByRow[item.id] || [],
    }));
    
    if (tasksByRow['unassigned']?.length > 0) {
      rows.push({
        id: 'unassigned',
        name: groupMode === 'assignee' ? 'Unassigned' : 'No Project',
        color: '#94a3b8',
        tasks: tasksByRow['unassigned'],
      });
    }
    
    return rows;
  }, [groupItems, tasksByRow, groupMode]);
  
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Timeline Header */}
      <div className="flex border-b border-border" style={{ height: HEADER_HEIGHT }}>
        {/* Sidebar header spacer */}
        <div 
          className="flex-shrink-0 bg-timeline-header border-r border-border"
          style={{ width: SIDEBAR_WIDTH }}
        />
        {/* Day headers */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-x-auto scrollbar-thin"
          onScroll={handleScroll}
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
        {/* Sidebar */}
        <div 
          className="flex-shrink-0 overflow-y-auto bg-card border-r border-border scrollbar-thin"
          style={{ width: SIDEBAR_WIDTH }}
        >
          {displayRows.map((row) => (
            <div 
              key={row.id}
              className="flex items-center px-4 border-b border-border hover:bg-timeline-row-hover transition-colors"
              style={{ height: ROW_HEIGHT }}
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
