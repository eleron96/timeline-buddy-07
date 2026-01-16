import React, { useState, useCallback, useRef, useEffect } from 'react';
import { usePlannerStore } from '@/store/plannerStore';
import { Task } from '@/types/planner';
import { cn } from '@/lib/utils';
import { calculateNewDates, calculateResizedDates, differenceInDays, parseISO, format, addDays } from '@/utils/dateUtils';
import { AlertTriangle } from 'lucide-react';

interface TaskBarProps {
  task: Task;
  position: { left: number; width: number };
  dayWidth: number;
  visibleDays: Date[];
  isOverlapping: boolean;
}

export const TaskBar: React.FC<TaskBarProps> = ({
  task,
  position,
  dayWidth,
  visibleDays,
  isOverlapping,
}) => {
  const { projects, statuses, moveTask, setSelectedTaskId, selectedTaskId } = usePlannerStore();
  
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, startX: 0 });
  
  const barRef = useRef<HTMLDivElement>(null);
  
  const project = projects.find(p => p.id === task.projectId);
  const status = statuses.find(s => s.id === task.statusId);
  const isSelected = selectedTaskId === task.id;
  
  const bgColor = project?.color || '#94a3b8';
  const statusColor = status?.color || '#94a3b8';
  const isFinal = status?.isFinal || false;
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTaskId(task.id);
  }, [task.id, setSelectedTaskId]);
  
  const handleMouseDown = useCallback((e: React.MouseEvent, resize?: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    
    if (resize) {
      setIsResizing(resize);
    } else {
      setIsDragging(true);
    }
    
    setDragOffset({ x: 0, startX: e.clientX });
  }, []);
  
  useEffect(() => {
    if (!isDragging && !isResizing) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragOffset.startX;
      setDragOffset(prev => ({ ...prev, x: deltaX }));
    };
    
    const handleMouseUp = () => {
      const daysDelta = Math.round(dragOffset.x / dayWidth);
      
      if (daysDelta !== 0) {
        if (isResizing) {
          const { startDate, endDate } = calculateResizedDates(
            task.startDate,
            task.endDate,
            isResizing,
            daysDelta
          );
          moveTask(task.id, startDate, endDate);
        } else {
          const { startDate, endDate } = calculateNewDates(
            task.startDate,
            task.endDate,
            daysDelta
          );
          moveTask(task.id, startDate, endDate);
        }
      }
      
      setIsDragging(false);
      setIsResizing(null);
      setDragOffset({ x: 0, startX: 0 });
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset.startX, dragOffset.x, dayWidth, task, moveTask]);
  
  // Calculate visual position during drag
  const visualLeft = isDragging || isResizing === 'left'
    ? position.left + dragOffset.x
    : position.left;
    
  const visualWidth = isResizing === 'left'
    ? position.width - dragOffset.x
    : isResizing === 'right'
    ? position.width + dragOffset.x
    : position.width;
  
  return (
    <div
      ref={barRef}
      onClick={handleClick}
      onMouseDown={(e) => handleMouseDown(e)}
      className={cn(
        'task-bar absolute h-[calc(100%-8px)] flex items-center px-2 overflow-hidden select-none',
        isDragging && 'dragging z-50',
        isResizing && 'z-50',
        isSelected && 'ring-2 ring-primary ring-offset-1',
        isOverlapping && 'conflict',
        isFinal && 'opacity-60'
      )}
      style={{
        left: visualLeft,
        width: Math.max(visualWidth, dayWidth - 4),
        backgroundColor: bgColor,
        borderLeft: `3px solid ${statusColor}`,
      }}
    >
      {/* Left resize handle */}
      <div
        className="resize-handle left-0 hover:bg-black/20"
        onMouseDown={(e) => handleMouseDown(e, 'left')}
      />
      
      {/* Task content */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {isOverlapping && (
          <AlertTriangle className="w-3 h-3 text-white/90 flex-shrink-0" />
        )}
        <span className="text-xs font-medium text-white truncate">
          {task.title}
        </span>
      </div>
      
      {/* Right resize handle */}
      <div
        className="resize-handle right-0 hover:bg-black/20"
        onMouseDown={(e) => handleMouseDown(e, 'right')}
      />
    </div>
  );
};
