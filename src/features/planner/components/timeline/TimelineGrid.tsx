import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { usePlannerStore } from '@/features/planner/store/plannerStore';
import { useFilteredAssignees } from '@/features/planner/hooks/useFilteredAssignees';
import { useAuthStore } from '@/features/auth/store/authStore';
import { TimelineHeader } from './TimelineHeader';
import { TimelineRow } from './TimelineRow';
import { TaskBar } from './TaskBar';
import { MilestoneDialog } from './MilestoneDialog';
import { getVisibleDays, getDayWidth, getTaskPosition, SIDEBAR_WIDTH, HEADER_HEIGHT, MIN_ROW_HEIGHT, TASK_HEIGHT, TASK_GAP } from '@/features/planner/lib/dateUtils';
import { Milestone, Task } from '@/features/planner/types/planner';

/** Дополнительный отступ снизу у строки пользователя в режиме группировки по исполнителям (визуально больше расстояние между пользователями) */
const ASSIGNEE_ROW_GAP = 20;
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
  const user = useAuthStore((state) => state.user);
  const currentWorkspaceRole = useAuthStore((state) => state.currentWorkspaceRole);
  const canEdit = currentWorkspaceRole === 'editor' || currentWorkspaceRole === 'admin';
  const filteredAssignees = useFilteredAssignees(assignees);

  const myAssigneeId = useMemo(() => {
    if (!user?.id) return null;
    return assignees.find((a) => a.userId === user.id)?.id ?? null;
  }, [assignees, user?.id]);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef<HTMLDivElement | null>(null);
  const syncingVerticalRef = useRef(false);
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

  // Group items (assignees or projects). При группировке по исполнителям: сначала текущий пользователь, затем остальные по алфавиту.
  const groupItems = useMemo(() => {
    if (groupMode === 'assignee') {
      const sorted = [...visibleAssignees].sort((a, b) => {
        if (myAssigneeId && a.id === myAssigneeId) return -1;
        if (myAssigneeId && b.id === myAssigneeId) return 1;
        return (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' });
      });
      return sorted.map(a => ({ id: a.id, name: a.name, color: undefined }));
    }
    return projects.map(p => ({ id: p.id, name: p.name, color: p.color }));
  }, [groupMode, visibleAssignees, projects, myAssigneeId]);
  
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
  
  const handleSidebarScroll = useCallback(() => {
    if (syncingVerticalRef.current) {
      syncingVerticalRef.current = false;
      return;
    }
    const sidebar = sidebarRef.current;
    const grid = scrollContainerRef.current;
    if (!sidebar || !grid || sidebar.scrollTop === grid.scrollTop) return;
    syncingVerticalRef.current = true;
    grid.scrollTop = sidebar.scrollTop;
    requestAnimationFrame(() => {
      syncingVerticalRef.current = false;
    });
  }, []);

  // Горизонтальный скролл: scrollLeft для линий вех и подписи месяца; вертикальная синхронизация с сайдбаром
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (syncingRef.current && syncingRef.current !== e.currentTarget) {
      return;
    }
    syncingRef.current = e.currentTarget;
    const newScrollLeft = e.currentTarget.scrollLeft;
    flushSync(() => setScrollLeft(newScrollLeft));
    requestAnimationFrame(() => {
      syncingRef.current = null;
    });

    if (syncingVerticalRef.current) {
      syncingVerticalRef.current = false;
    } else {
      const sidebar = sidebarRef.current;
      const grid = e.currentTarget;
      if (sidebar && grid && sidebar.scrollTop !== grid.scrollTop) {
        syncingVerticalRef.current = true;
        sidebar.scrollTop = grid.scrollTop;
        requestAnimationFrame(() => {
          syncingVerticalRef.current = false;
        });
      }
    }

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
  
  // Rows to display (including unassigned if there are unassigned tasks). В режиме по исполнителям — чуть больше отступ между строками пользователей.
  const displayRows = useMemo(() => {
    const rows = groupItems.map(item => {
      const baseHeight = rowHeights[item.id] || MIN_ROW_HEIGHT;
      const height = groupMode === 'assignee' && item.id !== 'unassigned'
        ? baseHeight + ASSIGNEE_ROW_GAP
        : baseHeight;
      return {
        ...item,
        tasks: tasksByRow[item.id] || [],
        height,
      };
    });

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
    setMilestoneLine(null);
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

  // По умолчанию показываем линию от каждой вехи, попадающей в видимый диапазон дат
  const visibleMilestoneLines = useMemo(() => {
    const lines: { date: string; color: string }[] = [];
    const seenDates = new Set<string>();
    for (const m of sortedMilestones) {
      if (!visibleDayIndex.has(m.date) || seenDates.has(m.date)) continue;
      seenDates.add(m.date);
      const project = projectById.get(m.projectId);
      lines.push({ date: m.date, color: project?.color ?? '#94a3b8' });
    }
    return lines;
  }, [sortedMilestones, visibleDayIndex, projectById]);

  // Линия начинается от нижней точки круга вехи (h-2.5 = 10px, радиус 5px)
  const milestoneDotRadius = 5;
  const milestoneLineTop = HEADER_HEIGHT + milestoneRowHeight / 2 + milestoneDotRadius;
  const milestoneLineHeight = `calc(100% - ${milestoneLineTop}px)`;
  const milestoneLineWidth = 3;
  const milestoneLineHoverWidth = 4;

  return (
    <div className={cn(
      'relative flex flex-col h-full overflow-hidden bg-background',
      highlightedTaskId && 'task-highlight-mode'
    )}>
      {/* Сайдбар и сетка — два скролла с синхронизацией по вертикали */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col flex-shrink-0 bg-timeline-header border-r border-border" style={{ width: SIDEBAR_WIDTH }}>
          <div className="flex-shrink-0 border-b border-border" style={{ height: HEADER_HEIGHT }} />
          <div className="flex-shrink-0 border-b border-border" style={{ height: milestoneRowHeight }} />
          <div
            ref={sidebarRef}
            className="flex-1 min-h-0 overflow-y-auto scrollbar-hidden"
            onScroll={handleSidebarScroll}
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
        </div>
        <div
          ref={scrollContainerRef}
          className={`flex-1 min-w-0 overflow-auto scrollbar-soft ${isDragScrolling ? 'cursor-grabbing' : 'cursor-grab'}`}
          onScroll={handleScroll}
          onMouseDown={handleDragStart}
        >
          <div className="relative" style={{ width: totalWidth, minHeight: '100%' }}>
            {/* Линии вех внутри скролла — под задачами и под интерфейсом создания задачи */}
            <div
              className="pointer-events-none absolute z-0 left-0"
              style={{ top: milestoneLineTop, width: totalWidth, height: milestoneLineHeight }}
            >
              {visibleMilestoneLines.map(({ date, color }) => {
                const lineIndex = visibleDayIndex.get(date);
                if (typeof lineIndex !== 'number') return null;
                const isHovered = milestoneLine?.date === date;
                const lineColor = hexToRgba(color, isHovered ? 1 : 0.6) ?? color;
                return (
                  <div
                    key={date}
                    className="absolute top-0 bottom-0 transition-all duration-200"
                    style={{
                      left: lineIndex * dayWidth + dayWidth / 2,
                      transform: 'translateX(-50%)',
                      width: isHovered ? milestoneLineHoverWidth : milestoneLineWidth,
                      backgroundColor: lineColor,
                      opacity: isHovered ? 1 : 0.7,
                    }}
                  />
                );
              })}
            </div>
            <div className="sticky top-0 z-20 bg-background">
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
                className="relative border-b border-border bg-timeline-header"
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
