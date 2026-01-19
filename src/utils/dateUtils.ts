import { 
  startOfWeek, 
  endOfWeek, 
  startOfDay, 
  endOfDay,
  addDays, 
  addYears,
  addWeeks, 
  subDays, 
  subYears,
  subWeeks,
  differenceInDays,
  format,
  parseISO,
  isSameDay,
  isWeekend,
  eachDayOfInterval,
  max,
  min,
} from 'date-fns';
import { ViewMode } from '@/types/planner';

export const DAY_WIDTH = 120; // pixels per day in day view
export const WEEK_DAY_WIDTH = 48; // pixels per day in week view
export const MIN_ROW_HEIGHT = 56; // minimum pixels per row
export const TASK_HEIGHT = 28; // height of task bar
export const TASK_GAP = 4; // gap between stacked tasks
export const HEADER_HEIGHT = 96; // pixels for timeline header
export const SIDEBAR_WIDTH = 200; // pixels for left sidebar

export const getVisibleDays = (
  currentDate: string,
  viewMode: ViewMode,
  tasks: Array<{ startDate: string; endDate: string }> = []
): Date[] => {
  const date = parseISO(currentDate);

  let rangeStart = subYears(date, 1);
  let rangeEnd = addYears(date, 1);

  if (tasks.length > 0) {
    const startDates = tasks.map((task) => parseISO(task.startDate));
    const endDates = tasks.map((task) => parseISO(task.endDate));
    const minDate = min([date, ...startDates]);
    const maxDate = max([date, ...endDates]);

    rangeStart = subYears(minDate, 1);
    rangeEnd = addYears(maxDate, 1);
  }

  if (viewMode === 'week') {
    rangeStart = startOfWeek(rangeStart, { weekStartsOn: 1 });
    rangeEnd = endOfWeek(rangeEnd, { weekStartsOn: 1 });
  }

  return eachDayOfInterval({ start: rangeStart, end: rangeEnd });
};

export const getDayWidth = (viewMode: ViewMode): number => {
  return viewMode === 'day' ? DAY_WIDTH : WEEK_DAY_WIDTH;
};

export const getTaskPosition = (
  startDate: string,
  endDate: string,
  visibleDays: Date[],
  dayWidth: number
): { left: number; width: number } | null => {
  if (visibleDays.length === 0) return null;
  
  const taskStart = parseISO(startDate);
  const taskEnd = parseISO(endDate);
  const firstVisibleDay = visibleDays[0];
  const lastVisibleDay = visibleDays[visibleDays.length - 1];
  
  // Check if task is visible at all
  if (taskEnd < firstVisibleDay || taskStart > lastVisibleDay) {
    return null;
  }
  
  const startOffset = differenceInDays(taskStart, firstVisibleDay);
  const duration = differenceInDays(taskEnd, taskStart) + 1;
  
  const left = startOffset * dayWidth;
  const width = duration * dayWidth - 4; // 4px gap
  
  return { left, width };
};

export const formatDateRange = (startDate: string, endDate: string): string => {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  
  if (isSameDay(start, end)) {
    return format(start, 'MMM d, yyyy');
  }
  
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${format(start, 'MMM d')} - ${format(end, 'd, yyyy')}`;
  }
  
  return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
};

export const formatDayHeader = (date: Date, viewMode: ViewMode): { day: string; date: string } => {
  if (viewMode === 'day') {
    return {
      day: format(date, 'EEE'),
      date: format(date, 'd'),
    };
  }
  return {
    day: format(date, 'EEEEE'),
    date: format(date, 'd'),
  };
};

export const isToday = (date: Date): boolean => {
  return isSameDay(date, new Date());
};

export const calculateNewDates = (
  originalStart: string,
  originalEnd: string,
  daysDelta: number
): { startDate: string; endDate: string } => {
  const start = parseISO(originalStart);
  const end = parseISO(originalEnd);
  
  return {
    startDate: format(addDays(start, daysDelta), 'yyyy-MM-dd'),
    endDate: format(addDays(end, daysDelta), 'yyyy-MM-dd'),
  };
};

export const calculateResizedDates = (
  originalStart: string,
  originalEnd: string,
  edge: 'left' | 'right',
  daysDelta: number
): { startDate: string; endDate: string } => {
  const start = parseISO(originalStart);
  const end = parseISO(originalEnd);
  
  if (edge === 'left') {
    const newStart = addDays(start, daysDelta);
    // Ensure start doesn't go past end
    if (newStart > end) {
      return { startDate: format(end, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd') };
    }
    return { startDate: format(newStart, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd') };
  } else {
    const newEnd = addDays(end, daysDelta);
    // Ensure end doesn't go before start
    if (newEnd < start) {
      return { startDate: format(start, 'yyyy-MM-dd'), endDate: format(start, 'yyyy-MM-dd') };
    }
    return { startDate: format(start, 'yyyy-MM-dd'), endDate: format(newEnd, 'yyyy-MM-dd') };
  }
};

export const checkOverlap = (
  task1Start: string,
  task1End: string,
  task2Start: string,
  task2End: string
): boolean => {
  const s1 = parseISO(task1Start);
  const e1 = parseISO(task1End);
  const s2 = parseISO(task2Start);
  const e2 = parseISO(task2End);
  
  return s1 <= e2 && e1 >= s2;
};

export { isWeekend, format, parseISO, addDays, subDays, addWeeks, subWeeks, differenceInDays };
