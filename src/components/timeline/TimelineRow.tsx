import React from 'react';
import { isToday, isWeekend } from '@/utils/dateUtils';
import { ViewMode } from '@/types/planner';
import { cn } from '@/lib/utils';
import { ROW_HEIGHT } from '@/utils/dateUtils';

interface TimelineRowProps {
  rowId: string;
  rowIndex: number;
  visibleDays: Date[];
  dayWidth: number;
  viewMode: ViewMode;
  children: React.ReactNode;
}

export const TimelineRow: React.FC<TimelineRowProps> = ({
  rowId,
  rowIndex,
  visibleDays,
  dayWidth,
  viewMode,
  children,
}) => {
  return (
    <div 
      className="relative border-b border-border"
      style={{ height: ROW_HEIGHT }}
    >
      {/* Grid background */}
      <div className="absolute inset-0 flex">
        {visibleDays.map((day, index) => {
          const today = isToday(day);
          const weekend = isWeekend(day);
          
          return (
            <div
              key={index}
              className={cn(
                'h-full border-r border-timeline-grid transition-colors relative',
                weekend && 'bg-timeline-weekend/50',
                today && 'bg-primary/5'
              )}
              style={{ width: dayWidth }}
            >
              {today && (
                <div className="absolute top-0 bottom-0 w-0.5 bg-primary left-1/2 -translate-x-1/2 z-10" />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Task bars container */}
      <div className="absolute inset-0 py-2 px-0.5">
        {children}
      </div>
    </div>
  );
};
