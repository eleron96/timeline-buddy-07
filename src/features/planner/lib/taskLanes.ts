import { Task } from '@/features/planner/types/planner';
import { checkOverlap } from './dateUtils';

export interface TaskWithLane extends Task {
  lane: number;
}

/**
 * Calculate lanes for tasks to avoid visual overlapping.
 * Tasks that overlap in time are placed in different lanes.
 */
export const calculateTaskLanes = (tasks: Task[]): TaskWithLane[] => {
  if (tasks.length === 0) return [];
  
  // Sort tasks by start date, then by end date
  const sortedTasks = [...tasks].sort((a, b) => {
    const startCompare = a.startDate.localeCompare(b.startDate);
    if (startCompare !== 0) return startCompare;
    return a.endDate.localeCompare(b.endDate);
  });
  
  const result: TaskWithLane[] = [];
  const lanes: { endDate: string }[] = [];
  
  for (const task of sortedTasks) {
    // Find the first available lane
    let assignedLane = -1;
    
    for (let i = 0; i < lanes.length; i++) {
      // Check if this lane is free (task starts after lane's last task ends)
      if (!checkOverlap(task.startDate, task.endDate, lanes[i].endDate, lanes[i].endDate)) {
        // Check if task starts after lane ends
        if (task.startDate > lanes[i].endDate) {
          assignedLane = i;
          lanes[i].endDate = task.endDate;
          break;
        }
      }
    }
    
    // If no lane available, create a new one
    if (assignedLane === -1) {
      assignedLane = lanes.length;
      lanes.push({ endDate: task.endDate });
    }
    
    result.push({ ...task, lane: assignedLane });
  }
  
  return result;
};

/**
 * Get the maximum number of lanes for a set of tasks
 */
export const getMaxLanes = (tasksWithLanes: TaskWithLane[]): number => {
  if (tasksWithLanes.length === 0) return 1;
  return Math.max(...tasksWithLanes.map(t => t.lane)) + 1;
};
