export interface Task {
  id: string;
  title: string;
  projectId: string | null;
  assigneeId: string | null;
  startDate: string; // ISO date
  endDate: string; // ISO date
  statusId: string;
  typeId: string;
  tagIds: string[];
  description: string | null;
}

export interface Project {
  id: string;
  name: string;
  color: string; // hex
}

export interface Assignee {
  id: string;
  name: string;
  avatar?: string;
}

export interface Status {
  id: string;
  name: string;
  color: string; // hex
  isFinal: boolean;
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

export type ViewMode = 'day' | 'week';
export type GroupMode = 'assignee' | 'project';

export interface Filters {
  projectIds: string[];
  assigneeIds: string[];
  statusIds: string[];
  typeIds: string[];
  tagIds: string[];
}

export interface PlannerState {
  tasks: Task[];
  projects: Project[];
  assignees: Assignee[];
  statuses: Status[];
  taskTypes: TaskType[];
  tags: Tag[];
  viewMode: ViewMode;
  groupMode: GroupMode;
  currentDate: string;
  filters: Filters;
  selectedTaskId: string | null;
}
