import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePlannerStore } from '@/store/plannerStore';
import { Task, TaskPriority } from '@/types/planner';
import { cn } from '@/lib/utils';
import { calculateNewDates, calculateResizedDates, formatDateRange, TASK_HEIGHT, TASK_GAP } from '@/utils/dateUtils';
import { Ban } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TaskBarProps {
  task: Task;
  position: { left: number; width: number };
  dayWidth: number;
  visibleDays: Date[];
  lane: number;
  canEdit: boolean;
}

const normalizeHex = (color: string) => {
  const raw = color.startsWith('#') ? color.slice(1) : color;
  if (raw.length === 3) {
    return raw.split('').map((char) => `${char}${char}`).join('');
  }
  if (raw.length === 6) {
    return raw;
  }
  return null;
};

const isDarkColor = (color: string) => {
  const hex = normalizeHex(color);
  if (!hex || !/^[0-9a-fA-F]{6}$/.test(hex)) {
    return false;
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.5;
};

const hexToRgba = (color: string, alpha: number) => {
  const hex = normalizeHex(color);
  if (!hex || !/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null;
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getBadgeStyle = (color?: string) => {
  if (!color) return undefined;
  const background = hexToRgba(color, 0.18);
  const border = hexToRgba(color, 0.45);
  const text = isDarkColor(color) ? color : '#0f172a';
  if (!background || !border) return undefined;
  return { backgroundColor: background, borderColor: border, color: text };
};

const priorityStyles: Record<TaskPriority, { className: string; label: string; color: string }> = {
  low: { className: 'text-emerald-600', label: 'Low priority', color: '#16a34a' },
  medium: { className: 'text-amber-500', label: 'Medium priority', color: '#f59e0b' },
  high: { className: 'text-red-600', label: 'High priority', color: '#dc2626' },
};

export const TaskBar: React.FC<TaskBarProps> = ({
  task,
  position,
  dayWidth,
  visibleDays,
  lane,
  canEdit,
}) => {
  const {
    tasks,
    projects,
    statuses,
    taskTypes,
    assignees,
    moveTask,
    updateTask,
    deleteTask,
    deleteTaskSeries,
    duplicateTask,
    setSelectedTaskId,
    selectedTaskId,
  } = usePlannerStore();
  
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, startX: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [deleteOpen, setDeleteOpen] = useState(false);
  
  const barRef = useRef<HTMLDivElement>(null);
  
  const project = projects.find(p => p.id === task.projectId);
  const status = statuses.find(s => s.id === task.statusId);
  const taskType = taskTypes.find(t => t.id === task.typeId);
  const assignee = assignees.find(a => a.id === task.assigneeId);
  const isSelected = selectedTaskId === task.id;
  const priorityMeta = task.priority ? priorityStyles[task.priority] : null;
  const isCancelled = status
    ? ['отменена', 'cancelled', 'canceled'].includes(status.name.trim().toLowerCase())
    : false;
  const isRepeating = Boolean(task.repeatId);
  const hasFutureRepeats = isRepeating
    ? tasks.some((item) => item.repeatId === task.repeatId && item.startDate > task.startDate)
    : false;
  
  const fallbackProjectColor = projects.length === 1 ? projects[0]?.color : undefined;
  const bgColor = project?.color || fallbackProjectColor || '#94a3b8';
  const statusColor = status?.color || '#94a3b8';
  const isDarkBackground = isDarkColor(bgColor);
  const textColor = isDarkBackground ? '#f8fafc' : '#0f172a';
  const statusOutline = isDarkBackground ? 'rgba(248, 250, 252, 0.65)' : 'rgba(15, 23, 42, 0.25)';
  const priorityBadgeStyle = priorityMeta
    ? {
        backgroundColor: '#ffffff',
        borderColor: priorityMeta.color,
        boxShadow: task.priority === 'high'
          ? `0 0 0 1px ${priorityMeta.color}, 0 0 8px ${hexToRgba(priorityMeta.color, 0.45) ?? priorityMeta.color}`
          : `0 0 0 1px ${priorityMeta.color}`,
      }
    : undefined;
  const prioritySymbol = task.priority === 'high' ? '‼' : '!';
  const isFinal = status?.isFinal || false;
  const showTooltip = isHovering && !isDragging && !isResizing;
  
  // Calculate vertical position based on lane
  const topPosition = lane * (TASK_HEIGHT + TASK_GAP);

  const updateTooltipPosition = useCallback((event: React.MouseEvent) => {
    const offset = 14;
    const tooltipWidth = 260;
    const tooltipHeight = 180;
    const { innerWidth, innerHeight } = window;
    let x = event.clientX + offset;
    let y = event.clientY + offset;
    if (x + tooltipWidth > innerWidth) {
      x = Math.max(8, event.clientX - tooltipWidth - offset);
    }
    if (y + tooltipHeight > innerHeight) {
      y = Math.max(8, event.clientY - tooltipHeight - offset);
    }
    setTooltipPos({ x, y });
  }, []);
  
  const handleMouseDown = useCallback((e: React.MouseEvent, resize?: 'left' | 'right') => {
    if (!canEdit) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    
    setHasMoved(false);
    
    if (resize) {
      setIsResizing(resize);
    } else {
      setIsDragging(true);
    }
    
    setDragOffset({ x: 0, startX: e.clientX });
  }, [canEdit]);
  
  useEffect(() => {
    if (!isDragging && !isResizing) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragOffset.startX;
      if (Math.abs(deltaX) > 3) {
        setHasMoved(true);
      }
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
      
      // Only open panel on clean click (no movement)
      if (!hasMoved && !isResizing) {
        setSelectedTaskId(task.id);
      }
      
      setIsDragging(false);
      setIsResizing(null);
      setDragOffset({ x: 0, startX: 0 });
      setHasMoved(false);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset.startX, dragOffset.x, dayWidth, task, moveTask, hasMoved, setSelectedTaskId]);
  
  // Calculate visual position during drag
  const visualLeft = isDragging || isResizing === 'left'
    ? position.left + dragOffset.x
    : position.left;
    
  const visualWidth = isResizing === 'left'
    ? position.width - dragOffset.x
    : isResizing === 'right'
    ? position.width + dragOffset.x
    : position.width;

  const handleStatusChange = (statusId: string) => {
    if (!canEdit || statusId === task.statusId) return;
    updateTask(task.id, { statusId });
  };

  const handleProjectChange = (projectId: string) => {
    if (!canEdit) return;
    const nextProjectId = projectId === 'none' ? null : projectId;
    if (nextProjectId === task.projectId) return;
    updateTask(task.id, { projectId: nextProjectId });
  };

  const projectValue = task.projectId ?? 'none';

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={barRef}
          onMouseDown={(e) => handleMouseDown(e)}
          onMouseEnter={(e) => {
            setIsHovering(true);
            updateTooltipPosition(e);
          }}
          onMouseMove={updateTooltipPosition}
          onMouseLeave={() => setIsHovering(false)}
          onClick={(e) => {
            e.stopPropagation();
            if (!canEdit) {
              setSelectedTaskId(task.id);
            }
          }}
          className={cn(
            'task-bar absolute flex items-center px-2 overflow-hidden select-none',
            isDragging && 'dragging z-50',
            isResizing && 'z-50',
            isSelected && 'ring-2 ring-primary ring-offset-1',
            isFinal && 'opacity-60 saturate-50'
          )}
          style={{
            left: visualLeft,
            top: topPosition,
            width: Math.max(visualWidth, dayWidth - 4),
            height: TASK_HEIGHT,
            backgroundColor: bgColor,
          }}
        >
          {/* Left resize handle */}
          <div
            className="resize-handle left-0 hover:bg-black/20"
            onMouseDown={(e) => handleMouseDown(e, 'left')}
          />
          
          {/* Task content */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className="inline-flex h-4 w-1.5 flex-shrink-0 rounded-[2px]"
              style={{ backgroundColor: statusColor, boxShadow: `0 0 0 1px ${statusOutline}` }}
            />
            {isCancelled && (
              <Ban className="h-3 w-3 text-red-500" aria-label="Cancelled" title="Cancelled" />
            )}
            {priorityMeta && (
              <span
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
                style={priorityBadgeStyle}
                title={priorityMeta.label}
                aria-label={priorityMeta.label}
              >
                <span className={cn('text-[11px] font-black leading-none priority-blink', priorityMeta.className)}>
                  {prioritySymbol}
                </span>
              </span>
            )}
            <span
              className={cn('task-label text-sm font-semibold leading-tight truncate', isFinal && 'line-through')}
              style={{ color: textColor }}
            >
              {task.title}
            </span>
          </div>
          
          {/* Right resize handle */}
          <div
            className="resize-handle right-0 hover:bg-black/20"
            onMouseDown={(e) => handleMouseDown(e, 'right')}
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Status</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuLabel>Status</ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuRadioGroup value={task.statusId} onValueChange={handleStatusChange}>
              {statuses.map((item) => (
                <ContextMenuRadioItem key={item.id} value={item.id} disabled={!canEdit}>
                  <span className="mr-2 inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem onSelect={() => duplicateTask(task.id)} disabled={!canEdit}>
          Duplicate task
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Assign project</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuLabel>Project</ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuRadioGroup value={projectValue} onValueChange={handleProjectChange}>
              <ContextMenuRadioItem value="none" disabled={!canEdit}>
                No Project
              </ContextMenuRadioItem>
              {projects.map((project) => (
                <ContextMenuRadioItem key={project.id} value={project.id} disabled={!canEdit}>
                  <span className="mr-2 inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} />
                  {project.name}
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => setDeleteOpen(true)} disabled={!canEdit} className="text-destructive">
          Delete task
        </ContextMenuItem>
      </ContextMenuContent>
      {showTooltip && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-50 w-64 max-w-xs rounded-lg border bg-background p-3 shadow-xl"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="space-y-2">
            <div className="text-sm font-semibold text-foreground leading-snug break-words">
              {task.title}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDateRange(task.startDate, task.endDate)}
            </div>
            <div className="text-xs text-muted-foreground">
              Assignee: <span className="text-foreground font-medium">{assignee?.name ?? 'Unassigned'}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {status && (
                <Badge className="text-[10px]" style={getBadgeStyle(status.color)}>
                  {status.name}
                </Badge>
              )}
              {taskType && (
                <Badge className="text-[10px]" variant="secondary">
                  {taskType.name}
                </Badge>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRepeating ? 'Delete repeated task?' : 'Delete task?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRepeating
                ? `Delete only this task or this and ${hasFutureRepeats ? 'future' : 'subsequent'} repeats? Previous repeats stay.`
                : `This will permanently delete "${task.title}".`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {isRepeating ? (
              <>
                <AlertDialogAction
                  className="bg-muted text-foreground hover:bg-muted/80"
                  onClick={async () => {
                    if (!canEdit) return;
                    await deleteTask(task.id);
                    setDeleteOpen(false);
                  }}
                >
                  Delete this
                </AlertDialogAction>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    if (!canEdit || !task.repeatId) return;
                    await deleteTaskSeries(task.repeatId, task.startDate);
                    setDeleteOpen(false);
                  }}
                >
                  Delete this & following
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction
                onClick={async () => {
                  if (!canEdit) return;
                  await deleteTask(task.id);
                  setDeleteOpen(false);
                }}
              >
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ContextMenu>
  );
};
