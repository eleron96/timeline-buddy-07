export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  projectId: string | null;
  assigneeIds: string[];
  startDate: string; // ISO date
  endDate: string; // ISO date
  statusId: string;
  typeId: string;
  priority: TaskPriority | null;
  tagIds: string[];
  description: string | null;
  repeatId: string | null;
}

export interface Project {
  id: string;
  name: string;
  color: string; // hex
  archived: boolean;
  customerId: string | null;
}

export interface Customer {
  id: string;
  name: string;
}

export interface Assignee {
  id: string;
  name: string;
  avatar?: string;
  userId?: string | null;
  isActive: boolean;
}

export interface Status {
  id: string;
  name: string;
  emoji: string | null;
  color: string; // hex
  isFinal: boolean;
  isCancelled: boolean;
}

export interface TaskType {
  id: string;
  name: string;
  icon: string | null;
}

export interface Tag {
  id: string;
  name: string;
  color: string; // hex
}

export interface Milestone {
  id: string;
  title: string;
  projectId: string;
  date: string; // ISO date
}

export type ViewMode = 'day' | 'week' | 'calendar';
export type GroupMode = 'assignee' | 'project';

export interface Filters {
  projectIds: string[];
  assigneeIds: string[];
  statusIds: string[];
  typeIds: string[];
  tagIds: string[];
  hideUnassigned: boolean;
}

export interface PlannerState {
  tasks: Task[];
  milestones: Milestone[];
  projects: Project[];
  customers: Customer[];
  assignees: Assignee[];
  statuses: Status[];
  taskTypes: TaskType[];
  tags: Tag[];
  viewMode: ViewMode;
  groupMode: GroupMode;
  currentDate: string;
  filters: Filters;
  selectedTaskId: string | null;
  highlightedTaskId: string | null;
}
