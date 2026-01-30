import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { usePlannerStore } from '@/features/planner/store/plannerStore';
import { useFilteredAssignees } from '@/features/planner/hooks/useFilteredAssignees';
import { useAuthStore } from '@/features/auth/store/authStore';
import { TimelineHeader } from './TimelineHeader';
import { TimelineRow } from './TimelineRow';
import { TaskBar } from './TaskBar';
import { MilestoneDialog } from './MilestoneDialog';
import { getVisibleDays, getDayWidth, getTaskPosition, SIDEBAR_WIDTH, HEADER_HEIGHT, MIN_ROW_HEIGHT, TASK_HEIGHT, TASK_GAP } from '@/features/planner/lib/dateUtils';
import { Milestone, Task } from '@/features/planner/types/planner';
import { calculateTaskLanes, getMaxLanes, TaskWithLane } from '@/features/planner/lib/taskLanes';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/classNames';
import { hexToRgba } from '@/features/planner/lib/colorUtils';
import { differenceInDays, format, isSameDay, parseISO } from 'date-fns';

interface TimelineGridProps {
  onCreateTask?: (payload: {
    startDate: string;
    endDate: string;
    projectId?: string | null;
    assigneeIds?: string[];
  }) => void;
}

export const TimelineGrid: React.FC<TimelineGridProps> = ({ onCreateTask }) => {
  const { 
    tasks,
    milestones,
    projects, 
    assignees, 
    viewMode, 
    groupMode, 
    currentDate,
    setCurrentDate,
    requestScrollToDate,
    scrollTargetDate,
    scrollRequestId,
    filters,
    assigneeTaskCounts,
    highlightedTaskId,
  } = usePlannerStore();
  const currentWorkspaceRole = useAuthStore((state) => state.currentWorkspaceRole);
  const canEdit = currentWorkspaceRole === 'editor' || currentWorkspaceRole === 'admin';
  const filteredAssignees = useFilteredAssignees(assignees);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef<HTMLDivElement | null>(null);
  const dragScrollRef = useRef<{
    startX: number;
    startScrollLeft: number;
    target: HTMLDivElement | null;
    didMove: boolean;
  } | null>(null);
  const lastDragTimeRef = useRef(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [isDragScrolling, setIsDragScrolling] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [milestoneDialogDate, setMilestoneDialogDate] = useState<string | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [milestoneLine, setMilestoneLine] = useState<{
    date: string;
    color: string;
    visible: boolean;
  } | null>(null);
  const milestoneRowHeight = 24;
  
  const visibleDays = useMemo(() => getVisibleDays(currentDate, viewMode, tasks), [currentDate, viewMode, tasks]);
  const dayWidth = useMemo(() => getDayWidth(viewMode), [viewMode]);
  const totalWidth = visibleDays.length * dayWidth;
  const currentDateObj = useMemo(() => parseISO(currentDate), [currentDate]);
  const centerIndex = useMemo(() => {
    if (!viewportWidth || dayWidth === 0) return -1;
    const centerPx = scrollLeft + viewportWidth / 2;
    return Math.min(visibleDays.length - 1, Math.max(0, Math.floor(centerPx / dayWidth)));
  }, [scrollLeft, viewportWidth, dayWidth, visibleDays.length]);
  const centerDate = useMemo(() => {
    if (centerIndex < 0 || centerIndex >= visibleDays.length) return null;
    return visibleDays[centerIndex];
  }, [centerIndex, visibleDays]);
  const showTodayButton = useMemo(() => {
    if (!centerDate) return false;
    return Math.abs(differenceInDays(centerDate, new Date())) > 7;
  }, [centerDate]);
  const scrollEndTimerRef = useRef<number | null>(null);
  const pendingScrollDateRef = useRef<string | null>(null);
  const visibleDaysRef = useRef<Date[]>([]);
  const ignoreScrollDateUpdateRef = useRef(false);
  const prevRangeRef = useRef<{ start: Date | null; currentDate: string; viewMode: string } | null>(null);

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );

  const filteredMilestones = useMemo(() => {
    if (filters.projectIds.length === 0) return milestones;
    return milestones.filter((milestone) => filters.projectIds.includes(milestone.projectId));
  }, [milestones, filters.projectIds]);

  const sortedMilestones = useMemo(() => {
    return [...filteredMilestones].sort((left, right) => {
      if (left.date === right.date) {
        return left.title.localeCompare(right.title);
      }
      return left.date.localeCompare(right.date);
    });
  }, [filteredMilestones]);

  const visibleDayIndex = useMemo(() => {
    const map = new Map<string, number>();
    visibleDays.forEach((day, index) => {
      map.set(format(day, 'yyyy-MM-dd'), index);
    });
    return map;
  }, [visibleDays]);

  const milestonesByDate = useMemo(() => {
    const map = new Map<string, Milestone[]>();
    sortedMilestones.forEach((milestone) => {
      const list = map.get(milestone.date) ?? [];
      list.push(milestone);
      map.set(milestone.date, list);
    });
    return map;
  }, [sortedMilestones]);

  const milestoneOffsets = useMemo(() => {
    const offsets = new Map<string, number>();
    milestonesByDate.forEach((items) => {
      items.forEach((item, index) => {
        const offset = items.length > 1 ? (index - (items.length - 1) / 2) * 8 : 0;
        offsets.set(item.id, offset);
      });
    });
    return offsets;
  }, [milestonesByDate]);
  
  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filters.projectIds.length > 0 && task.projectId && !filters.projectIds.includes(task.projectId)) {
        return false;
      }
      if (filters.assigneeIds.length > 0) {
        if (!task.assigneeIds.some((id) => filters.assigneeIds.includes(id))) {
          return false;
        }
      } else if (filters.hideUnassigned && task.assigneeIds.length === 0) {
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
  
  const visibleAssignees = useMemo(() => {
    if (groupMode !== 'assignee') return filteredAssignees;
    if (filters.assigneeIds.length === 0) return filteredAssignees;
    return filteredAssignees.filter((assignee) => filters.assigneeIds.includes(assignee.id));
  }, [filteredAssignees, filters.assigneeIds, groupMode]);

  // Group items (assignees or projects)
  const groupItems = useMemo(() => {
    if (groupMode === 'assignee') {
      return visibleAssignees.map(a => ({ id: a.id, name: a.name, color: undefined }));
    }
    return projects.map(p => ({ id: p.id, name: p.name, color: p.color }));
  }, [groupMode, visibleAssignees, projects]);
  
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
    
    const visibleGroupIds = new Set(groupItems.map((item) => item.id));

    filteredTasks.forEach(task => {
      if (groupMode === 'assignee') {
        const matchingAssignees = Array.from(new Set(task.assigneeIds)).filter((id) => visibleGroupIds.has(id));
        if (matchingAssignees.length === 0) {
          tasksPerGroup['unassigned'].push(task);
          return;
        }
        matchingAssignees.forEach((assigneeId) => {
          if (!tasksPerGroup[assigneeId]) {
            tasksPerGroup[assigneeId] = [];
          }
          tasksPerGroup[assigneeId].push(task);
        });
        return;
      }

      const groupId = task.projectId || 'unassigned';
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
  
  // Sync scroll between header and grid
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (syncingRef.current && syncingRef.current !== e.currentTarget) {
      return;
    }
    syncingRef.current = e.currentTarget;
    const newScrollLeft = e.currentTarget.scrollLeft;
    setScrollLeft(newScrollLeft);
    
    // Sync header scroll
    if (containerRef.current && e.currentTarget !== containerRef.current && containerRef.current.scrollLeft !== newScrollLeft) {
      containerRef.current.scrollLeft = newScrollLeft;
    }
    if (scrollContainerRef.current && e.currentTarget !== scrollContainerRef.current && scrollContainerRef.current.scrollLeft !== newScrollLeft) {
      scrollContainerRef.current.scrollLeft = newScrollLeft;
    }
    requestAnimationFrame(() => {
      syncingRef.current = null;
    });

    if (ignoreScrollDateUpdateRef.current) {
      return;
    }

    if (visibleDays.length > 0 && dayWidth > 0) {
      const viewWidth = viewportWidth || e.currentTarget.clientWidth;
      const centerPx = newScrollLeft + viewWidth / 2;
      const index = Math.min(
        visibleDays.length - 1,
        Math.max(0, Math.floor(centerPx / dayWidth)),
      );
      const date = format(visibleDays[index], 'yyyy-MM-dd');
      pendingScrollDateRef.current = date;
      if (scrollEndTimerRef.current) {
        window.clearTimeout(scrollEndTimerRef.current);
      }
      scrollEndTimerRef.current = window.setTimeout(() => {
        const nextDate = pendingScrollDateRef.current;
        if (nextDate && nextDate !== currentDate) {
          setCurrentDate(nextDate);
        }
      }, 300);
    }
  }, [currentDate, dayWidth, setCurrentDate, viewportWidth, visibleDays.length, visibleDays]);

  const handleDragStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target;
    if (target instanceof Element && target.closest('.task-bar, .milestone-dot')) {
      return;
    }
    dragScrollRef.current = {
      startX: e.clientX,
      startScrollLeft: e.currentTarget.scrollLeft,
      target: e.currentTarget,
      didMove: false,
    };
    setIsDragScrolling(true);
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!isDragScrolling) return;

    const handleMouseMove = (e: MouseEvent) => {
      const state = dragScrollRef.current;
      if (!state?.target) return;
      const deltaX = e.clientX - state.startX;
      if (!state.didMove && Math.abs(deltaX) > 4) {
        state.didMove = true;
      }
      const nextScrollLeft = state.startScrollLeft - deltaX;
      state.target.scrollLeft = nextScrollLeft;
      if (state.target === scrollContainerRef.current && containerRef.current) {
        if (containerRef.current.scrollLeft !== nextScrollLeft) {
          containerRef.current.scrollLeft = nextScrollLeft;
        }
      } else if (state.target === containerRef.current && scrollContainerRef.current) {
        if (scrollContainerRef.current.scrollLeft !== nextScrollLeft) {
          scrollContainerRef.current.scrollLeft = nextScrollLeft;
        }
      }
    };

    const handleMouseUp = () => {
      if (dragScrollRef.current?.didMove) {
        lastDragTimeRef.current = Date.now();
      }
      dragScrollRef.current = null;
      setIsDragScrolling(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragScrolling]);

  useEffect(() => () => {
    if (scrollEndTimerRef.current) {
      window.clearTimeout(scrollEndTimerRef.current);
    }
  }, []);

  const scrollToIndex = useCallback((index: number) => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const targetScroll = Math.max(0, index * dayWidth - container.clientWidth / 2 + dayWidth / 2);
    container.scrollLeft = targetScroll;
    setScrollLeft(targetScroll);

    if (containerRef.current) {
      containerRef.current.scrollLeft = targetScroll;
    }
  }, [dayWidth]);

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const updateWidth = () => setViewportWidth(container.clientWidth);
    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(container);
      return () => observer.disconnect();
    }
    return undefined;
  }, []);
  
  const lastCenteredRef = useRef<{ date: string; viewMode: string } | null>(null);

  useEffect(() => {
    visibleDaysRef.current = visibleDays;
  }, [visibleDays]);

  useEffect(() => {
    if (visibleDays.length === 0 || dayWidth === 0) {
      prevRangeRef.current = { start: visibleDays[0] ?? null, currentDate, viewMode };
      return;
    }

    const previous = prevRangeRef.current;
    const nextStart = visibleDays[0];

    if (
      previous?.start
      && previous.currentDate === currentDate
      && previous.viewMode === viewMode
    ) {
      const deltaDays = differenceInDays(nextStart, previous.start);
      if (deltaDays !== 0) {
        const shiftPx = deltaDays * dayWidth;
        const container = scrollContainerRef.current;
        if (container) {
          const nextScrollLeft = Math.max(0, container.scrollLeft - shiftPx);
          ignoreScrollDateUpdateRef.current = true;
          container.scrollLeft = nextScrollLeft;
          if (containerRef.current) {
            containerRef.current.scrollLeft = nextScrollLeft;
          }
          setScrollLeft(nextScrollLeft);
          requestAnimationFrame(() => {
            ignoreScrollDateUpdateRef.current = false;
          });
        }
      }
    }

    prevRangeRef.current = { start: nextStart, currentDate, viewMode };
  }, [currentDate, dayWidth, viewMode, visibleDays]);

  // Center scroll when the active date or view changes (not when tasks change)
  useEffect(() => {
    if (lastCenteredRef.current?.date === currentDate && lastCenteredRef.current?.viewMode === viewMode) {
      return;
    }
    const days = visibleDaysRef.current;
    if (days.length === 0) return;
    const targetIndex = days.findIndex((day) => isSameDay(day, currentDateObj));
    if (targetIndex >= 0) {
      scrollToIndex(targetIndex);
      lastCenteredRef.current = { date: currentDate, viewMode };
    }
  }, [currentDate, currentDateObj, scrollToIndex, viewMode]);

  useEffect(() => {
    if (!scrollTargetDate) return;
    const targetDate = parseISO(scrollTargetDate);
    const days = visibleDaysRef.current;
    if (days.length === 0) return;
    const targetIndex = days.findIndex((day) => isSameDay(day, targetDate));
    if (targetIndex >= 0) {
      scrollToIndex(targetIndex);
    }
  }, [scrollRequestId, scrollTargetDate, scrollToIndex]);
  
  // Rows to display (including unassigned if there are unassigned tasks)
  const displayRows = useMemo(() => {
    const rows = groupItems.map(item => ({
      ...item,
      tasks: tasksByRow[item.id] || [],
      height: rowHeights[item.id] || MIN_ROW_HEIGHT,
    }));

    const showUnassignedRow = tasksByRow['unassigned']?.length > 0
      && (groupMode === 'project' || (filters.assigneeIds.length === 0 && !filters.hideUnassigned));
    
    if (showUnassignedRow) {
      rows.push({
        id: 'unassigned',
        name: groupMode === 'assignee' ? 'Unassigned' : 'No Project',
        color: '#94a3b8',
        tasks: tasksByRow['unassigned'],
        height: rowHeights['unassigned'] || MIN_ROW_HEIGHT,
      });
    }
    
    return rows;
  }, [filters.assigneeIds.length, filters.hideUnassigned, groupItems, groupMode, rowHeights, tasksByRow]);
  
  const handleJumpToToday = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setCurrentDate(today);
    requestScrollToDate(today);
  };

  const handleMilestoneDialogChange = useCallback((open: boolean) => {
    setMilestoneDialogOpen(open);
    if (!open) {
      setMilestoneDialogDate(null);
      setEditingMilestone(null);
    }
  }, []);

  const handleCreateMilestone = useCallback((date: string) => {
    setEditingMilestone(null);
    setMilestoneDialogDate(date);
    setMilestoneDialogOpen(true);
  }, []);

  const handleEditMilestone = useCallback((milestone: Milestone) => {
    setEditingMilestone(milestone);
    setMilestoneDialogDate(null);
    setMilestoneDialogOpen(true);
  }, []);

  const handleMilestoneRowClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!canEdit) return;
    if (Date.now() - lastDragTimeRef.current < 200) return;
    const target = e.target;
    if (target instanceof Element && target.closest('.milestone-dot')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const index = Math.floor(offsetX / dayWidth);
    if (index < 0 || index >= visibleDays.length) return;
    handleCreateMilestone(format(visibleDays[index], 'yyyy-MM-dd'));
  }, [canEdit, dayWidth, handleCreateMilestone, visibleDays]);

  const handleMilestoneHover = useCallback((date: string, color: string) => {
    setMilestoneLine({ date, color, visible: true });
  }, []);

  const handleMilestoneHoverEnd = useCallback(() => {
    setMilestoneLine((prev) => (prev ? { ...prev, visible: false } : prev));
  }, []);

  const handleCreateTaskAt = useCallback((date: string, rowId: string) => {
    if (!canEdit) return;
    if (Date.now() - lastDragTimeRef.current < 200) return;
    const defaults: {
      startDate: string;
      endDate: string;
      projectId?: string | null;
      assigneeIds?: string[];
    } = {
      startDate: date,
      endDate: date,
      assigneeIds: [],
    };

    if (groupMode === 'project') {
      if (rowId === 'unassigned') {
        defaults.projectId = null;
      } else {
        const project = projects.find((item) => item.id === rowId);
        defaults.projectId = project && !project.archived ? project.id : null;
      }
    }

    if (groupMode === 'assignee' && rowId !== 'unassigned') {
      const assignee = assignees.find((item) => item.id === rowId);
      if (assignee?.isActive) {
        defaults.assigneeIds = [assignee.id];
      }
    }

    onCreateTask?.(defaults);
  }, [assignees, canEdit, groupMode, onCreateTask, projects]);

  useEffect(() => {
    if (!milestoneLine || milestoneLine.visible) return;
    const timer = window.setTimeout(() => setMilestoneLine(null), 200);
    return () => window.clearTimeout(timer);
  }, [milestoneLine]);

  const milestoneLineIndex = milestoneLine ? visibleDayIndex.get(milestoneLine.date) : undefined;
  const milestoneLineColor = milestoneLine
    ? (hexToRgba(milestoneLine.color, 0.6) ?? milestoneLine.color)
    : null;

  return (
    <div className={cn(
      'relative flex flex-col h-full overflow-hidden bg-background',
      highlightedTaskId && 'task-highlight-mode'
    )}>
      {milestoneLine && typeof milestoneLineIndex === 'number' && (
        <div
          className={cn(
            'pointer-events-none absolute z-10 w-px transition-opacity duration-200',
            milestoneLine.visible ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            left: SIDEBAR_WIDTH + milestoneLineIndex * dayWidth + dayWidth / 2 - scrollLeft,
            top: HEADER_HEIGHT + milestoneRowHeight / 2,
            height: `calc(100% - ${HEADER_HEIGHT + milestoneRowHeight / 2}px)`,
            backgroundColor: milestoneLineColor ?? undefined,
          }}
        />
      )}
      {/* Timeline Header + Milestones - Sticky */}
      <div className="sticky top-0 z-20 bg-background">
        <div className="flex">
          <div
            className="flex-shrink-0 bg-timeline-header border-r border-border"
            style={{ width: SIDEBAR_WIDTH }}
          >
            <div className="border-b border-border" style={{ height: HEADER_HEIGHT }} />
            <div className="border-b border-border" style={{ height: milestoneRowHeight }} />
          </div>
          <div 
            ref={containerRef}
            className={`flex-1 overflow-x-auto scrollbar-hidden ${isDragScrolling ? 'cursor-grabbing' : 'cursor-grab'}`}
            onScroll={handleScroll}
            onMouseDown={handleDragStart}
            style={{ overflowY: 'hidden' }}
          >
            <div className="border-b border-border" style={{ width: totalWidth }}>
              <TimelineHeader 
                visibleDays={visibleDays} 
                dayWidth={dayWidth} 
                viewMode={viewMode}
                scrollLeft={scrollLeft}
                viewportWidth={viewportWidth}
              />
            </div>
            <div
              className="relative border-b border-border"
              style={{ width: totalWidth, height: milestoneRowHeight }}
              onClick={handleMilestoneRowClick}
            >
              {sortedMilestones.map((milestone) => {
                const dayIndex = visibleDayIndex.get(milestone.date);
                if (dayIndex === undefined) return null;
                const project = projectById.get(milestone.projectId);
                const color = project?.color ?? '#94a3b8';
                const dotColor = hexToRgba(color, 0.45) ?? color;
                const dotBorder = hexToRgba(color, 0.8) ?? color;
                const offset = milestoneOffsets.get(milestone.id) ?? 0;
                const left = dayIndex * dayWidth + dayWidth / 2 + offset;

                return (
                  <button
                    key={milestone.id}
                    type="button"
                    className="milestone-dot absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-transform hover:scale-110"
                    style={{ left, backgroundColor: dotColor, borderColor: dotBorder }}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleEditMilestone(milestone);
                    }}
                    onMouseEnter={() => handleMilestoneHover(milestone.date, color)}
                    onMouseLeave={handleMilestoneHoverEnd}
                  />
                );
              })}
            </div>
          </div>
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
                {groupMode === 'assignee' && row.id !== 'unassigned'
                  ? (assigneeTaskCounts[row.id] ?? row.tasks.length)
                  : row.tasks.length}
              </span>
            </div>
          ))}
        </div>
        
        {/* Grid area */}
        <div 
          ref={scrollContainerRef}
          className={`flex-1 overflow-auto scrollbar-soft ${isDragScrolling ? 'cursor-grabbing' : 'cursor-grab'}`}
          onScroll={handleScroll}
          onMouseDown={handleDragStart}
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
                canEdit={canEdit}
                onCreateTask={handleCreateTaskAt}
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

      {showTodayButton && (
        <Button
          type="button"
          variant="secondary"
          className="absolute bottom-4 right-4 z-30 shadow-md"
          onClick={handleJumpToToday}
        >
          Today
        </Button>
      )}

      <MilestoneDialog
        open={milestoneDialogOpen}
        onOpenChange={handleMilestoneDialogChange}
        date={milestoneDialogDate}
        milestone={editingMilestone}
        canEdit={canEdit}
      />
    </div>
  );
};
