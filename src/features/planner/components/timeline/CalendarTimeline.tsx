import React, { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { usePlannerStore } from '@/features/planner/store/plannerStore';
import { useAuthStore } from '@/features/auth/store/authStore';
import { MilestoneDialog } from '@/features/planner/components/timeline/MilestoneDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/lib/classNames';
import { hexToRgba } from '@/features/planner/lib/colorUtils';
import { Milestone } from '@/features/planner/types/planner';
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  eachDayOfInterval,
  format,
  isToday,
  isWeekend,
  max,
  min,
  parseISO,
  startOfMonth,
  startOfWeek,
  isSameMonth,
} from 'date-fns';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const HOLIDAY_COUNTRY_CODE = 'RU';

export const CalendarTimeline: React.FC = () => {
  const {
    tasks,
    milestones,
    projects,
    assignees,
    filters,
    currentDate,
    setCurrentDate,
    setViewMode,
    requestScrollToDate,
  } = usePlannerStore();
  const user = useAuthStore((state) => state.user);
  const currentWorkspaceRole = useAuthStore((state) => state.currentWorkspaceRole);
  const canEdit = currentWorkspaceRole === 'editor' || currentWorkspaceRole === 'admin';
  const containerRef = useRef<HTMLDivElement>(null);
  const monthRefs = useRef(new Map<string, HTMLDivElement>());
  const loadedHolidayYears = useRef(new Set<number>());
  const loadingHolidayYears = useRef(new Set<number>());
  const [holidayMap, setHolidayMap] = useState<Record<string, string[]>>({});
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [milestoneDialogDate, setMilestoneDialogDate] = useState<string | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);

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

  const milestonesByDate = useMemo(() => {
    const map = new Map<string, Milestone[]>();
    sortedMilestones.forEach((milestone) => {
      const list = map.get(milestone.date) ?? [];
      list.push(milestone);
      map.set(milestone.date, list);
    });
    return map;
  }, [sortedMilestones]);

  const myAssigneeId = useMemo(() => {
    if (!user?.id) return null;
    return assignees.find((assignee) => assignee.userId === user.id)?.id ?? null;
  }, [assignees, user?.id]);

  const taskCounts = useMemo(() => {
    const counts = new Map<string, { total: number; mine: number }>();
    filteredTasks.forEach(task => {
      const start = parseISO(task.startDate);
      const end = parseISO(task.endDate);
      eachDayOfInterval({ start, end }).forEach(day => {
        const key = format(day, 'yyyy-MM-dd');
        const entry = counts.get(key) ?? { total: 0, mine: 0 };
        entry.total += 1;
        if (myAssigneeId && task.assigneeIds.includes(myAssigneeId)) {
          entry.mine += 1;
        }
        counts.set(key, entry);
      });
    });
    return counts;
  }, [filteredTasks, myAssigneeId]);

  const months = useMemo(() => {
    const baseDate = parseISO(currentDate);
    let rangeStart = startOfMonth(addMonths(baseDate, -6));
    let rangeEnd = endOfMonth(addMonths(baseDate, 6));

    if (filteredTasks.length > 0) {
      const startDates = filteredTasks.map((task) => parseISO(task.startDate));
      const endDates = filteredTasks.map((task) => parseISO(task.endDate));
      const minDate = min([baseDate, ...startDates]);
      const maxDate = max([baseDate, ...endDates]);
      rangeStart = startOfMonth(addMonths(minDate, -1));
      rangeEnd = endOfMonth(addMonths(maxDate, 1));
    }

    const result: Date[] = [];
    let cursor = startOfMonth(rangeStart);
    while (cursor <= rangeEnd) {
      result.push(cursor);
      cursor = addMonths(cursor, 1);
    }
    return result;
  }, [currentDate, filteredTasks]);

  useEffect(() => {
    const years = Array.from(new Set(months.map((month) => month.getFullYear())));
    const toLoad = years.filter((year) => (
      !loadedHolidayYears.current.has(year) && !loadingHolidayYears.current.has(year)
    ));
    if (toLoad.length === 0) return;

    let active = true;
    const controller = new AbortController();

    const loadYear = async (year: number) => {
      loadingHolidayYears.current.add(year);
      try {
        const response = await fetch(
          `https://date.nager.at/api/v3/PublicHolidays/${year}/${HOLIDAY_COUNTRY_CODE}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`Holiday fetch failed: ${response.status}`);
        }
        const data = (await response.json()) as Array<{ date?: string; localName?: string; name?: string }>;
        if (!active) return;
        setHolidayMap((prev) => {
          const next = { ...prev };
          data.forEach((holiday) => {
            if (!holiday.date) return;
            const label = holiday.localName || holiday.name || 'Holiday';
            const existing = next[holiday.date] ?? [];
            if (existing.includes(label)) return;
            next[holiday.date] = [...existing, label];
          });
          return next;
        });
        loadedHolidayYears.current.add(year);
      } catch (error) {
        if ((error as { name?: string })?.name !== 'AbortError') {
          console.error(error);
        }
        loadedHolidayYears.current.add(year);
      } finally {
        loadingHolidayYears.current.delete(year);
      }
    };

    toLoad.forEach((year) => {
      void loadYear(year);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [months]);

  const holidayDates = useMemo(() => new Set(Object.keys(holidayMap)), [holidayMap]);

  const setMonthRef = useCallback((key: string) => (node: HTMLDivElement | null) => {
    if (!node) {
      monthRefs.current.delete(key);
      return;
    }
    monthRefs.current.set(key, node);
  }, []);

  useEffect(() => {
    const key = format(parseISO(currentDate), 'yyyy-MM');
    const target = monthRefs.current.get(key);
    if (target && containerRef.current) {
      target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentDate, months.length]);

  const handleDateClick = (day: Date) => {
    const nextDate = format(day, 'yyyy-MM-dd');
    setCurrentDate(nextDate);
    setViewMode('week');
    requestScrollToDate(nextDate);
  };

  const handleMilestoneDialogChange = useCallback((open: boolean) => {
    setMilestoneDialogOpen(open);
    if (!open) {
      setMilestoneDialogDate(null);
      setEditingMilestone(null);
    }
  }, []);

  const handleEditMilestone = useCallback((milestone: Milestone) => {
    setEditingMilestone(milestone);
    setMilestoneDialogDate(null);
    setMilestoneDialogOpen(true);
  }, []);

  return (
    <TooltipProvider delayDuration={350}>
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-auto scrollbar-soft select-none"
      >
        <div className="flex gap-6 px-4 py-4 min-w-max">
          {months.map((month) => {
            const monthKey = format(month, 'yyyy-MM');
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);
            const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
            const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
            const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

            return (
              <div
                key={monthKey}
                ref={setMonthRef(monthKey)}
                className="min-w-[280px] rounded-lg border border-border bg-card p-3 shadow-sm"
              >
                <div className="mb-2 text-sm font-semibold text-foreground">
                  {format(month, 'LLLL yyyy')}
                </div>
                <div className="grid grid-cols-7 text-[11px] text-muted-foreground uppercase tracking-wide">
                  {WEEKDAY_LABELS.map((label) => (
                    <div key={label} className="flex items-center justify-center py-1">
                      {label}
                    </div>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-0">
                  {days.map((day, index) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const counts = taskCounts.get(key) ?? { total: 0, mine: 0 };
                    const inMonth = isSameMonth(day, month);
                    const weekend = isWeekend(day);
                    const today = isToday(day);
                    const isHoliday = holidayDates.has(key);
                    const prevKey = index > 0 ? format(days[index - 1], 'yyyy-MM-dd') : '';
                    const nextKey = index < days.length - 1 ? format(days[index + 1], 'yyyy-MM-dd') : '';
                    const holidayStarts = isHoliday && (index % 7 === 0 || !holidayDates.has(prevKey));
                    const holidayEnds = isHoliday && (index % 7 === 6 || !holidayDates.has(nextKey));
                    const holidayRadius = holidayStarts && holidayEnds
                      ? 'rounded-full'
                      : holidayStarts
                      ? 'rounded-l-full'
                      : holidayEnds
                      ? 'rounded-r-full'
                      : 'rounded-none';
                    const holidayNames = holidayMap[key] ?? [];
                    const milestonesForDay = milestonesByDate.get(key) ?? [];

                    return (
                      <div
                        key={key}
                        className={cn(
                          'relative flex h-9 w-9 items-center justify-center',
                          weekend && 'bg-muted/30'
                        )}
                      >
                        {isHoliday && (
                          <div
                            className={cn(
                              'pointer-events-none absolute inset-0 bg-rose-200/60',
                              holidayRadius
                            )}
                          />
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="relative z-10 flex h-full w-full items-center justify-center">
                              <button
                                type="button"
                                onClick={() => handleDateClick(day)}
                                className={cn(
                                  'flex h-7 w-7 items-center justify-center text-xs focus-visible:outline-none',
                                  inMonth ? 'text-foreground' : 'text-muted-foreground/40',
                                  counts.total > 0 && 'font-semibold',
                                  today ? 'rounded-full border border-sky-500/70 bg-sky-100/70 text-sky-700' : 'rounded-md',
                                  'hover:bg-muted/40'
                                )}
                              >
                                {format(day, 'd')}
                              </button>
                              {milestonesByDate.has(key) && (
                                <div className="absolute bottom-0.5 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-0.5">
                                  {(milestonesByDate.get(key) ?? []).map((milestone) => {
                                    const project = projectById.get(milestone.projectId);
                                    const color = project?.color ?? '#94a3b8';
                                    const dotColor = hexToRgba(color, 0.8) ?? color;

                                    return (
                                      <span
                                        key={milestone.id}
                                        className="h-2 w-2 rounded-full"
                                        style={{ backgroundColor: dotColor }}
                                        onClick={(event) => event.stopPropagation()}
                                        onContextMenu={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          handleEditMilestone(milestone);
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            sideOffset={6}
                            className="w-44 rounded-lg border border-border bg-card/95 px-3 py-2 text-xs text-foreground shadow-sm backdrop-blur"
                          >
                            <div className="space-y-1">
                              {milestonesForDay.length > 0 && (
                                <div className="border-b border-border/60 pb-1">
                                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    Вехи
                                  </div>
                                  <div className="mt-1 space-y-1">
                                    {milestonesForDay.map((milestone) => {
                                      const project = projectById.get(milestone.projectId);
                                      const color = project?.color ?? '#94a3b8';
                                      const dotColor = hexToRgba(color, 0.8) ?? color;
                                      return (
                                        <div key={milestone.id} className="flex items-center gap-2">
                                          <span
                                            className="h-2 w-2 rounded-full"
                                            style={{ backgroundColor: dotColor }}
                                          />
                                          <div className="min-w-0">
                                            <div className="truncate">{milestone.title}</div>
                                            <div className="text-[10px] text-muted-foreground truncate">
                                              {project?.name ?? 'Проект'}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Всего</span>
                                <span className="font-semibold">{counts.total}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Мои</span>
                                <span className="font-semibold">{counts.mine}</span>
                              </div>
                              {holidayNames.length > 0 && (
                                <div className="border-t border-border/60 pt-1 text-[11px] text-muted-foreground">
                                  <span className="text-foreground">Праздник:</span>{' '}
                                  {holidayNames.join(', ')}
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <MilestoneDialog
        open={milestoneDialogOpen}
        onOpenChange={handleMilestoneDialogChange}
        date={milestoneDialogDate}
        milestone={editingMilestone}
        canEdit={canEdit}
      />
    </TooltipProvider>
  );
};
