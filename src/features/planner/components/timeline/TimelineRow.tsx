import React from 'react';
import { isToday, isWeekend } from '@/features/planner/lib/dateUtils';
import { ViewMode } from '@/features/planner/types/planner';
import { cn } from '@/shared/lib/classNames';

interface TimelineRowProps {
  rowId: string;
  rowIndex: number;
  visibleDays: Date[];
  dayWidth: number;
  viewMode: ViewMode;
  height: number;
  children: React.ReactNode;
}

export const TimelineRow: React.FC<TimelineRowProps> = ({
  rowId,
  rowIndex,
  visibleDays,
  dayWidth,
  viewMode,
  height,
  children,
}) => {
  return (
    <div 
      className="relative border-b border-border"
      style={{ height }}
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
                today && 'today-hatch'
              )}
              style={{ width: dayWidth }}
            />
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
