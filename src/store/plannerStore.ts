import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Task, Project, Assignee, Status, TaskType, Tag, ViewMode, GroupMode, Filters, PlannerState } from '@/types/planner';
import { addDays, format } from 'date-fns';

const generateId = () => crypto.randomUUID();

// Sample data
const sampleProjects: Project[] = [
  { id: generateId(), name: 'Website Redesign', color: '#3b82f6' },
  { id: generateId(), name: 'Mobile App', color: '#22c55e' },
  { id: generateId(), name: 'Marketing Campaign', color: '#f59e0b' },
  { id: generateId(), name: 'Backend API', color: '#8b5cf6' },
];

const sampleAssignees: Assignee[] = [
  { id: generateId(), name: 'Alex Chen' },
  { id: generateId(), name: 'Sarah Miller' },
  { id: generateId(), name: 'Mike Johnson' },
  { id: generateId(), name: 'Emma Wilson' },
];

const sampleStatuses: Status[] = [
  { id: generateId(), name: 'To Do', color: '#94a3b8', isFinal: false },
  { id: generateId(), name: 'In Progress', color: '#3b82f6', isFinal: false },
  { id: generateId(), name: 'Review', color: '#f59e0b', isFinal: false },
  { id: generateId(), name: 'Done', color: '#22c55e', isFinal: true },
];

const sampleTaskTypes: TaskType[] = [
  { id: generateId(), name: 'Feature', icon: 'Sparkles' },
  { id: generateId(), name: 'Bug', icon: 'Bug' },
  { id: generateId(), name: 'Task', icon: 'CheckSquare' },
  { id: generateId(), name: 'Meeting', icon: 'Users' },
];

const sampleTags: Tag[] = [
  { id: generateId(), name: 'Urgent', color: '#ef4444' },
  { id: generateId(), name: 'Backend', color: '#8b5cf6' },
  { id: generateId(), name: 'Frontend', color: '#3b82f6' },
  { id: generateId(), name: 'Design', color: '#ec4899' },
];

const today = new Date();

const createSampleTasks = (projects: Project[], assignees: Assignee[], statuses: Status[], types: TaskType[]): Task[] => [
  {
    id: generateId(),
    title: 'Design homepage mockups',
    projectId: projects[0].id,
    assigneeId: assignees[0].id,
    startDate: format(addDays(today, -2), 'yyyy-MM-dd'),
    endDate: format(addDays(today, 1), 'yyyy-MM-dd'),
    statusId: statuses[1].id,
    typeId: types[0].id,
    tagIds: [],
    description: 'Create high-fidelity mockups for the new homepage design',
  },
  {
    id: generateId(),
    title: 'Implement auth flow',
    projectId: projects[1].id,
    assigneeId: assignees[1].id,
    startDate: format(addDays(today, 0), 'yyyy-MM-dd'),
    endDate: format(addDays(today, 4), 'yyyy-MM-dd'),
    statusId: statuses[1].id,
    typeId: types[0].id,
    tagIds: [],
    description: 'Build the authentication flow for mobile app',
  },
  {
    id: generateId(),
    title: 'Write blog post',
    projectId: projects[2].id,
    assigneeId: assignees[2].id,
    startDate: format(addDays(today, 1), 'yyyy-MM-dd'),
    endDate: format(addDays(today, 3), 'yyyy-MM-dd'),
    statusId: statuses[0].id,
    typeId: types[2].id,
    tagIds: [],
    description: 'Write content for product launch announcement',
  },
  {
    id: generateId(),
    title: 'API endpoints',
    projectId: projects[3].id,
    assigneeId: assignees[3].id,
    startDate: format(addDays(today, -1), 'yyyy-MM-dd'),
    endDate: format(addDays(today, 5), 'yyyy-MM-dd'),
    statusId: statuses[1].id,
    typeId: types[0].id,
    tagIds: [],
    description: 'Build REST API endpoints for user management',
  },
  {
    id: generateId(),
    title: 'Code review',
    projectId: projects[0].id,
    assigneeId: assignees[1].id,
    startDate: format(addDays(today, 2), 'yyyy-MM-dd'),
    endDate: format(addDays(today, 3), 'yyyy-MM-dd'),
    statusId: statuses[2].id,
    typeId: types[2].id,
    tagIds: [],
    description: 'Review pull requests from the team',
  },
  {
    id: generateId(),
    title: 'Fix navigation bug',
    projectId: projects[1].id,
    assigneeId: assignees[0].id,
    startDate: format(addDays(today, 3), 'yyyy-MM-dd'),
    endDate: format(addDays(today, 4), 'yyyy-MM-dd'),
    statusId: statuses[0].id,
    typeId: types[1].id,
    tagIds: [],
    description: 'Navigation drawer not closing on route change',
  },
  {
    id: generateId(),
    title: 'Team standup',
    projectId: null,
    assigneeId: assignees[2].id,
    startDate: format(addDays(today, 0), 'yyyy-MM-dd'),
    endDate: format(addDays(today, 0), 'yyyy-MM-dd'),
    statusId: statuses[1].id,
    typeId: types[3].id,
    tagIds: [],
    description: 'Daily team sync meeting',
  },
  {
    id: generateId(),
    title: 'Database optimization',
    projectId: projects[3].id,
    assigneeId: assignees[3].id,
    startDate: format(addDays(today, 4), 'yyyy-MM-dd'),
    endDate: format(addDays(today, 7), 'yyyy-MM-dd'),
    statusId: statuses[0].id,
    typeId: types[2].id,
    tagIds: [],
    description: 'Optimize slow queries and add indexes',
  },
];

interface PlannerStore extends PlannerState {
  // Task actions
  addTask: (task: Omit<Task, 'id'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, startDate: string, endDate: string) => void;
  reassignTask: (id: string, assigneeId: string | null, projectId?: string | null) => void;
  
  // Project actions
  addProject: (project: Omit<Project, 'id'>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  
  // Assignee actions
  addAssignee: (assignee: Omit<Assignee, 'id'>) => void;
  updateAssignee: (id: string, updates: Partial<Assignee>) => void;
  deleteAssignee: (id: string) => void;
  
  // Status actions
  addStatus: (status: Omit<Status, 'id'>) => void;
  updateStatus: (id: string, updates: Partial<Status>) => void;
  deleteStatus: (id: string) => void;
  
  // TaskType actions
  addTaskType: (taskType: Omit<TaskType, 'id'>) => void;
  updateTaskType: (id: string, updates: Partial<TaskType>) => void;
  deleteTaskType: (id: string) => void;
  
  // Tag actions
  addTag: (tag: Omit<Tag, 'id'>) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  deleteTag: (id: string) => void;
  
  // View actions
  setViewMode: (mode: ViewMode) => void;
  setGroupMode: (mode: GroupMode) => void;
  setCurrentDate: (date: string) => void;
  setFilters: (filters: Partial<Filters>) => void;
  clearFilters: () => void;
  setSelectedTaskId: (id: string | null) => void;
}

const initialFilters: Filters = {
  projectIds: [],
  assigneeIds: [],
  statusIds: [],
  typeIds: [],
  tagIds: [],
};

export const usePlannerStore = create<PlannerStore>()(
  persist(
    (set) => ({
      // Initial state with sample data
      tasks: createSampleTasks(sampleProjects, sampleAssignees, sampleStatuses, sampleTaskTypes),
      projects: sampleProjects,
      assignees: sampleAssignees,
      statuses: sampleStatuses,
      taskTypes: sampleTaskTypes,
      tags: sampleTags,
      viewMode: 'week',
      groupMode: 'assignee',
      currentDate: format(today, 'yyyy-MM-dd'),
      filters: initialFilters,
      selectedTaskId: null,
      
      // Task actions
      addTask: (task) => set((state) => ({
        tasks: [...state.tasks, { ...task, id: generateId() }],
      })),
      
      updateTask: (id, updates) => set((state) => ({
        tasks: state.tasks.map((t) => t.id === id ? { ...t, ...updates } : t),
      })),
      
      deleteTask: (id) => set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
      })),
      
      moveTask: (id, startDate, endDate) => set((state) => ({
        tasks: state.tasks.map((t) => 
          t.id === id ? { ...t, startDate, endDate } : t
        ),
      })),
      
      reassignTask: (id, assigneeId, projectId) => set((state) => ({
        tasks: state.tasks.map((t) => 
          t.id === id 
            ? { ...t, assigneeId, ...(projectId !== undefined && { projectId }) } 
            : t
        ),
      })),
      
      // Project actions
      addProject: (project) => set((state) => ({
        projects: [...state.projects, { ...project, id: generateId() }],
      })),
      
      updateProject: (id, updates) => set((state) => ({
        projects: state.projects.map((p) => p.id === id ? { ...p, ...updates } : p),
      })),
      
      deleteProject: (id) => set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        tasks: state.tasks.map((t) => t.projectId === id ? { ...t, projectId: null } : t),
      })),
      
      // Assignee actions
      addAssignee: (assignee) => set((state) => ({
        assignees: [...state.assignees, { ...assignee, id: generateId() }],
      })),
      
      updateAssignee: (id, updates) => set((state) => ({
        assignees: state.assignees.map((a) => a.id === id ? { ...a, ...updates } : a),
      })),
      
      deleteAssignee: (id) => set((state) => ({
        assignees: state.assignees.filter((a) => a.id !== id),
        tasks: state.tasks.map((t) => t.assigneeId === id ? { ...t, assigneeId: null } : t),
      })),
      
      // Status actions
      addStatus: (status) => set((state) => ({
        statuses: [...state.statuses, { ...status, id: generateId() }],
      })),
      
      updateStatus: (id, updates) => set((state) => ({
        statuses: state.statuses.map((s) => s.id === id ? { ...s, ...updates } : s),
      })),
      
      deleteStatus: (id) => set((state) => ({
        statuses: state.statuses.filter((s) => s.id !== id),
      })),
      
      // TaskType actions
      addTaskType: (taskType) => set((state) => ({
        taskTypes: [...state.taskTypes, { ...taskType, id: generateId() }],
      })),
      
      updateTaskType: (id, updates) => set((state) => ({
        taskTypes: state.taskTypes.map((t) => t.id === id ? { ...t, ...updates } : t),
      })),
      
      deleteTaskType: (id) => set((state) => ({
        taskTypes: state.taskTypes.filter((t) => t.id !== id),
      })),
      
      // Tag actions
      addTag: (tag) => set((state) => ({
        tags: [...state.tags, { ...tag, id: generateId() }],
      })),
      
      updateTag: (id, updates) => set((state) => ({
        tags: state.tags.map((t) => t.id === id ? { ...t, ...updates } : t),
      })),
      
      deleteTag: (id) => set((state) => ({
        tags: state.tags.filter((t) => t.id !== id),
        tasks: state.tasks.map((t) => ({
          ...t,
          tagIds: t.tagIds.filter((tagId) => tagId !== id),
        })),
      })),
      
      // View actions
      setViewMode: (mode) => set({ viewMode: mode }),
      setGroupMode: (mode) => set({ groupMode: mode }),
      setCurrentDate: (date) => set({ currentDate: date }),
      setFilters: (filters) => set((state) => ({
        filters: { ...state.filters, ...filters },
      })),
      clearFilters: () => set({ filters: initialFilters }),
      setSelectedTaskId: (id) => set({ selectedTaskId: id }),
    }),
    {
      name: 'planner-storage',
    }
  )
);
