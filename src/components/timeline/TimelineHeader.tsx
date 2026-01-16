import React from 'react';
import { format } from 'date-fns';
import { isToday, isWeekend, formatDayHeader } from '@/utils/dateUtils';
import { ViewMode } from '@/types/planner';
import { cn } from '@/lib/utils';

interface TimelineHeaderProps {
  visibleDays: Date[];
  dayWidth: number;
  viewMode: ViewMode;
}

export const TimelineHeader: React.FC<TimelineHeaderProps> = ({
  visibleDays,
  dayWidth,
  viewMode,
}) => {
  // Group days by month for month labels
  const monthGroups = React.useMemo(() => {
    const groups: { month: string; days: number; startIndex: number }[] = [];
    let currentMonth = '';
    let currentCount = 0;
    let startIndex = 0;
    
    visibleDays.forEach((day, index) => {
      const monthKey = format(day, 'MMMM yyyy');
      if (monthKey !== currentMonth) {
        if (currentMonth) {
          groups.push({ month: currentMonth, days: currentCount, startIndex });
        }
        currentMonth = monthKey;
        currentCount = 1;
        startIndex = index;
      } else {
        currentCount++;
      }
    });
    
    if (currentMonth) {
      groups.push({ month: currentMonth, days: currentCount, startIndex });
    }
    
    return groups;
  }, [visibleDays]);
  
  return (
    <div className="relative" style={{ width: visibleDays.length * dayWidth }}>
      {/* Month row */}
      <div className="flex h-6 bg-timeline-header border-b border-border">
        {monthGroups.map((group) => (
          <div
            key={`${group.month}-${group.startIndex}`}
            className="flex items-center px-2 border-r border-border"
            style={{ width: group.days * dayWidth }}
          >
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
              {group.month}
            </span>
          </div>
        ))}
      </div>
      
      {/* Day row */}
      <div className="flex h-[34px]">
        {visibleDays.map((day, index) => {
          const { day: dayName, date } = formatDayHeader(day, viewMode);
          const today = isToday(day);
          const weekend = isWeekend(day);
          
          return (
            <div
              key={index}
              className={cn(
                'flex flex-col items-center justify-center border-r border-border transition-colors',
                weekend && 'bg-timeline-weekend',
                today && 'bg-primary/10'
              )}
              style={{ width: dayWidth }}
            >
              <span className={cn(
                'text-[10px] uppercase tracking-wide',
                today ? 'text-primary font-semibold' : 'text-muted-foreground'
              )}>
                {dayName}
              </span>
              <span className={cn(
                'text-sm font-medium',
                today ? 'text-primary' : 'text-foreground'
              )}>
                {date}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
