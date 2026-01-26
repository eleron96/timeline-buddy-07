import React from 'react';
import { usePlannerStore } from '@/features/planner/store/plannerStore';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Users,
  FolderKanban,
} from 'lucide-react';
import { format, parseISO, addDays, subDays, addWeeks, subWeeks } from '@/features/planner/lib/dateUtils';
import { addMonths, subMonths } from 'date-fns';
import { cn } from '@/shared/lib/classNames';

export const TimelineControls: React.FC = () => {
  const { 
    viewMode, 
    setViewMode, 
    groupMode, 
    setGroupMode, 
    currentDate, 
    setCurrentDate,
    requestScrollToDate,
    filters,
    setFilters,
  } = usePlannerStore();
  const hideUnassignedId = 'hide-unassigned-toggle';
  
  const handlePrev = () => {
    const date = parseISO(currentDate);
    const newDate = viewMode === 'day' 
      ? subDays(date, 7) 
      : viewMode === 'calendar'
      ? subMonths(date, 1)
      : subWeeks(date, 2);
    setCurrentDate(format(newDate, 'yyyy-MM-dd'));
  };
  
  const handleNext = () => {
    const date = parseISO(currentDate);
    const newDate = viewMode === 'day' 
      ? addDays(date, 7) 
      : viewMode === 'calendar'
      ? addMonths(date, 1)
      : addWeeks(date, 2);
    setCurrentDate(format(newDate, 'yyyy-MM-dd'));
  };
  
  const handleToday = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setCurrentDate(today);
    requestScrollToDate(today);
  };
  
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
      <div className="flex items-center gap-3">
        {/* Navigation */}
        <div className="flex items-center gap-1">
          <Button 
            variant="outline" 
            size="icon"
            onClick={handlePrev}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline"
            onClick={handleToday}
            className="h-8 px-3 text-sm"
          >
            Today
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleNext}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Current date display */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{format(parseISO(currentDate), 'MMMM yyyy')}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {/* View mode toggle */}
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('day')}
            className={cn(
              'h-7 px-3 text-xs rounded-md',
              viewMode === 'day' && 'bg-background shadow-sm'
            )}
          >
            Day
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('week')}
            className={cn(
              'h-7 px-3 text-xs rounded-md',
              viewMode === 'week' && 'bg-background shadow-sm'
            )}
          >
            Week
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('calendar')}
            className={cn(
              'h-7 px-3 text-xs rounded-md',
              viewMode === 'calendar' && 'bg-background shadow-sm'
            )}
          >
            Calendar
          </Button>
        </div>
        
        {/* Group mode toggle */}
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setGroupMode('assignee')}
            className={cn(
              'h-7 px-3 text-xs rounded-md gap-1.5',
              groupMode === 'assignee' && 'bg-background shadow-sm'
            )}
          >
            <Users className="h-3.5 w-3.5" />
            People
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setGroupMode('project')}
            className={cn(
              'h-7 px-3 text-xs rounded-md gap-1.5',
              groupMode === 'project' && 'bg-background shadow-sm'
            )}
          >
            <FolderKanban className="h-3.5 w-3.5" />
            Projects
          </Button>
        </div>

        <div
          className="flex items-center gap-2 text-[11px] text-muted-foreground/70 select-none"
          title="Не показывать неназначенные"
        >
          <Checkbox
            id={hideUnassignedId}
            checked={filters.hideUnassigned}
            onCheckedChange={(value) => setFilters({ hideUnassigned: value === true })}
            className="scale-75 border-muted-foreground/40 data-[state=checked]:bg-muted-foreground/60 data-[state=checked]:border-muted-foreground/60 data-[state=checked]:text-white/90"
            aria-label="Не показывать неназначенные"
          />
          <label htmlFor={hideUnassignedId} className="cursor-pointer">
            Без&nbsp;назнач.
          </label>
        </div>
      </div>
    </div>
  );
};
