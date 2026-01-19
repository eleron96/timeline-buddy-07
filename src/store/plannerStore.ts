import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addDays, addMonths, addWeeks, addYears, differenceInDays, format, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import {
  Task,
  Project,
  Assignee,
  Status,
  TaskType,
  Tag,
  ViewMode,
  GroupMode,
  Filters,
  PlannerState,
} from '@/types/planner';

type TaskRow = {
  id: string;
  workspace_id: string;
  title: string;
  project_id: string | null;
  assignee_id: string | null;
  start_date: string;
  end_date: string;
  status_id: string;
  type_id: string;
  tag_ids: string[] | null;
  description: string | null;
};

type ProjectRow = {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
};

type AssigneeRow = {
  id: string;
  workspace_id: string;
  name: string;
  user_id: string | null;
};

type StatusRow = {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  is_final: boolean;
};

type TaskTypeRow = {
  id: string;
  workspace_id: string;
  name: string;
  icon: string | null;
};

type TagRow = {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
};

interface PlannerStore extends PlannerState {
  workspaceId: string | null;
  loading: boolean;
  error: string | null;
  scrollRequestId: number;
  scrollTargetDate: string | null;
  setWorkspaceId: (id: string | null) => void;
  loadWorkspaceData: (workspaceId: string) => Promise<void>;
  refreshAssignees: () => Promise<void>;
  reset: () => void;

  addTask: (task: Omit<Task, 'id'>) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  duplicateTask: (id: string) => Promise<void>;
  createRepeats: (id: string, options: { frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'; ends: 'never' | 'on' | 'after'; untilDate?: string; count?: number }) => Promise<{ error?: string; created?: number }>;
  moveTask: (id: string, startDate: string, endDate: string) => Promise<void>;
  reassignTask: (id: string, assigneeId: string | null, projectId?: string | null) => Promise<void>;

  addProject: (project: Omit<Project, 'id'>) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  addAssignee: (assignee: Omit<Assignee, 'id'>) => Promise<void>;
  updateAssignee: (id: string, updates: Partial<Assignee>) => Promise<void>;
  deleteAssignee: (id: string) => Promise<void>;

  addStatus: (status: Omit<Status, 'id'>) => Promise<void>;
  updateStatus: (id: string, updates: Partial<Status>) => Promise<void>;
  deleteStatus: (id: string) => Promise<void>;

  addTaskType: (taskType: Omit<TaskType, 'id'>) => Promise<void>;
  updateTaskType: (id: string, updates: Partial<TaskType>) => Promise<void>;
  deleteTaskType: (id: string) => Promise<void>;

  addTag: (tag: Omit<Tag, 'id'>) => Promise<void>;
  updateTag: (id: string, updates: Partial<Tag>) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;

  setViewMode: (mode: ViewMode) => void;
  setGroupMode: (mode: GroupMode) => void;
  setCurrentDate: (date: string) => void;
  requestScrollToDate: (date: string) => void;
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

const mapTaskRow = (row: TaskRow): Task => ({
  id: row.id,
  title: row.title,
  projectId: row.project_id,
  assigneeId: row.assignee_id,
  startDate: row.start_date,
  endDate: row.end_date,
  statusId: row.status_id,
  typeId: row.type_id,
  tagIds: row.tag_ids ?? [],
  description: row.description,
});

const mapProjectRow = (row: ProjectRow): Project => ({
  id: row.id,
  name: row.name,
  color: row.color,
});

const mapAssigneeRow = (row: AssigneeRow): Assignee => ({
  id: row.id,
  name: row.name,
});

const mapStatusRow = (row: StatusRow): Status => ({
  id: row.id,
  name: row.name,
  color: row.color,
  isFinal: row.is_final,
});

const mapTaskTypeRow = (row: TaskTypeRow): TaskType => ({
  id: row.id,
  name: row.name,
  icon: row.icon,
});

const mapTagRow = (row: TagRow): Tag => ({
  id: row.id,
  name: row.name,
  color: row.color,
});

const mapTaskUpdates = (updates: Partial<Task>) => {
  const payload: Record<string, unknown> = {};
  if ('title' in updates) payload.title = updates.title;
  if ('projectId' in updates) payload.project_id = updates.projectId;
  if ('assigneeId' in updates) payload.assignee_id = updates.assigneeId;
  if ('startDate' in updates) payload.start_date = updates.startDate;
  if ('endDate' in updates) payload.end_date = updates.endDate;
  if ('statusId' in updates) payload.status_id = updates.statusId;
  if ('typeId' in updates) payload.type_id = updates.typeId;
  if ('tagIds' in updates) payload.tag_ids = updates.tagIds;
  if ('description' in updates) payload.description = updates.description;
  return payload;
};

export const usePlannerStore = create<PlannerStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      projects: [],
      assignees: [],
      statuses: [],
      taskTypes: [],
      tags: [],
      viewMode: 'week',
      groupMode: 'assignee',
      currentDate: format(new Date(), 'yyyy-MM-dd'),
      filters: initialFilters,
      selectedTaskId: null,
      workspaceId: null,
      loading: false,
      error: null,
      scrollRequestId: 0,
      scrollTargetDate: null,

      setWorkspaceId: (id) => set({ workspaceId: id }),
      reset: () => set({
        tasks: [],
        projects: [],
        assignees: [],
        statuses: [],
        taskTypes: [],
        tags: [],
        selectedTaskId: null,
        workspaceId: null,
        loading: false,
        error: null,
        scrollRequestId: 0,
        scrollTargetDate: null,
      }),

      loadWorkspaceData: async (workspaceId) => {
        set({ loading: true, error: null, workspaceId, selectedTaskId: null });

        const [tasksRes, projectsRes, assigneesRes, statusesRes, taskTypesRes, tagsRes] = await Promise.all([
          supabase.from('tasks').select('*').eq('workspace_id', workspaceId),
          supabase.from('projects').select('*').eq('workspace_id', workspaceId),
          supabase.from('assignees').select('*').eq('workspace_id', workspaceId),
          supabase.from('statuses').select('*').eq('workspace_id', workspaceId),
          supabase.from('task_types').select('*').eq('workspace_id', workspaceId),
          supabase.from('tags').select('*').eq('workspace_id', workspaceId),
        ]);

        if (tasksRes.error || projectsRes.error || assigneesRes.error || statusesRes.error || taskTypesRes.error || tagsRes.error) {
          set({
            error: tasksRes.error?.message
              || projectsRes.error?.message
              || assigneesRes.error?.message
              || statusesRes.error?.message
              || taskTypesRes.error?.message
              || tagsRes.error?.message
              || 'Failed to load workspace data.',
            loading: false,
          });
          return;
        }

        const taskRows = (tasksRes.data ?? []) as TaskRow[];
        const assigneeRows = (assigneesRes.data ?? []) as AssigneeRow[];
        const taskAssigneeIds = new Set(
          taskRows.map((row) => row.assignee_id).filter((id): id is string => Boolean(id)),
        );

        const assignees = assigneeRows
          .filter((row) => row.user_id !== null || taskAssigneeIds.has(row.id))
          .sort((left, right) => left.name.localeCompare(right.name))
          .map(mapAssigneeRow);

        set({
          tasks: taskRows.map(mapTaskRow),
          projects: (projectsRes.data ?? []).map(mapProjectRow),
          assignees,
          statuses: (statusesRes.data ?? []).map(mapStatusRow),
          taskTypes: (taskTypesRes.data ?? []).map(mapTaskTypeRow),
          tags: (tagsRes.data ?? []).map(mapTagRow),
          loading: false,
        });
      },
      refreshAssignees: async () => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;

        const { data, error } = await supabase
          .from('assignees')
          .select('*')
          .eq('workspace_id', workspaceId);

        if (error) {
          console.error(error);
          return;
        }

        const taskAssigneeIds = new Set(
          get().tasks.map((task) => task.assigneeId).filter((id): id is string => Boolean(id)),
        );

        const assignees = (data ?? [])
          .filter((row) => row.user_id !== null || taskAssigneeIds.has(row.id))
          .sort((left, right) => left.name.localeCompare(right.name))
          .map(mapAssigneeRow);

        set({ assignees });
      },

      addTask: async (task) => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;

        const { data, error } = await supabase
          .from('tasks')
          .insert({
            workspace_id: workspaceId,
            title: task.title,
            project_id: task.projectId,
            assignee_id: task.assigneeId,
            start_date: task.startDate,
            end_date: task.endDate,
            status_id: task.statusId,
            type_id: task.typeId,
            tag_ids: task.tagIds,
            description: task.description,
          })
          .select('*')
          .single();

        if (error || !data) {
          console.error(error);
          return;
        }

        set((state) => ({ tasks: [...state.tasks, mapTaskRow(data as TaskRow)] }));
      },

      updateTask: async (id, updates) => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;

        const payload = mapTaskUpdates(updates);
        if (Object.keys(payload).length === 0) return;

        const { data, error } = await supabase
          .from('tasks')
          .update(payload)
          .eq('id', id)
          .eq('workspace_id', workspaceId)
          .select('*')
          .single();

        if (error || !data) {
          console.error(error);
          return;
        }

        const updated = mapTaskRow(data as TaskRow);
        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === id ? updated : task)),
        }));
      },

      deleteTask: async (id) => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;

        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('id', id)
          .eq('workspace_id', workspaceId);

        if (error) {
          console.error(error);
          return;
        }

        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
          selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
        }));
      },

      duplicateTask: async (id) => {
        const task = get().tasks.find((item) => item.id === id);
        if (!task) return;

        const start = parseISO(task.startDate);
        const end = parseISO(task.endDate);
        const duration = differenceInDays(end, start) + 1;
        const newStart = addDays(end, 1);
        const newEnd = addDays(newStart, Math.max(0, duration - 1));

        await get().addTask({
          title: task.title,
          projectId: task.projectId,
          assigneeId: task.assigneeId,
          startDate: format(newStart, 'yyyy-MM-dd'),
          endDate: format(newEnd, 'yyyy-MM-dd'),
          statusId: task.statusId,
          typeId: task.typeId,
          tagIds: [...task.tagIds],
          description: task.description,
        });
      },

      createRepeats: async (id, options) => {
        const task = get().tasks.find((item) => item.id === id);
        const workspaceId = get().workspaceId;
        if (!task) return { error: 'Task not found.' };
        if (!workspaceId) return { error: 'Workspace not selected.' };

        const baseStart = parseISO(task.startDate);
        const baseEnd = parseISO(task.endDate);
        const duration = differenceInDays(baseEnd, baseStart) + 1;
        const endsMode = options.ends;
        const targetCount = options.count && options.count > 0 ? options.count : 0;
        const untilDate = options.untilDate ? parseISO(options.untilDate) : null;
        const neverHorizon = addYears(baseStart, 1);

        const addInterval = (date: Date, step: number) => {
          switch (options.frequency) {
            case 'daily':
              return addDays(date, step);
            case 'weekly':
              return addWeeks(date, step);
            case 'monthly':
              return addMonths(date, step);
            case 'yearly':
              return addYears(date, step);
            default:
              return addWeeks(date, step);
          }
        };

        const newTasks: Array<{
          workspace_id: string;
          title: string;
          project_id: string | null;
          assignee_id: string | null;
          start_date: string;
          end_date: string;
          status_id: string;
          type_id: string;
          tag_ids: string[];
          description: string | null;
        }> = [];

        for (let index = 1; index <= 500; index += 1) {
          if (endsMode === 'after' && index > targetCount) break;
          const nextStart = addInterval(baseStart, index);
          if (endsMode === 'on' && untilDate && nextStart > untilDate) break;
          if (endsMode === 'never' && nextStart > neverHorizon) break;

          const nextEnd = addDays(nextStart, Math.max(0, duration - 1));
          newTasks.push({
            workspace_id: workspaceId,
            title: task.title,
            project_id: task.projectId,
            assignee_id: task.assigneeId,
            start_date: format(nextStart, 'yyyy-MM-dd'),
            end_date: format(nextEnd, 'yyyy-MM-dd'),
            status_id: task.statusId,
            type_id: task.typeId,
            tag_ids: [...task.tagIds],
            description: task.description,
          });
        }

        if (newTasks.length === 0) {
          return { error: 'No repeats created for the selected range.' };
        }

        const { data, error } = await supabase
          .from('tasks')
          .insert(newTasks)
          .select('*');

        if (error) {
          return { error: error.message };
        }

        set((state) => ({
          tasks: [...state.tasks, ...((data ?? []) as TaskRow[]).map(mapTaskRow)],
        }));

        return { created: newTasks.length };
      },

      moveTask: async (id, startDate, endDate) => {
        await get().updateTask(id, { startDate, endDate });
      },

      reassignTask: async (id, assigneeId, projectId) => {
        await get().updateTask(id, {
          assigneeId,
          ...(projectId !== undefined ? { projectId } : {}),
        });
      },

      addProject: async (project) => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;

        const { data, error } = await supabase
          .from('projects')
          .insert({
            workspace_id: workspaceId,
            name: project.name,
            color: project.color,
          })
          .select('*')
          .single();

        if (error || !data) {
          console.error(error);
          return;
        }

        set((state) => ({ projects: [...state.projects, mapProjectRow(data as ProjectRow)] }));
      },

      updateProject: async (id, updates) => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;

        const payload: Record<string, unknown> = {};
        if ('name' in updates) payload.name = updates.name;
        if ('color' in updates) payload.color = updates.color;
        if (Object.keys(payload).length === 0) return;

        const { data, error } = await supabase
          .from('projects')
          .update(payload)
          .eq('id', id)
          .eq('workspace_id', workspaceId)
          .select('*')
          .single();

        if (error || !data) {
          console.error(error);
          return;
        }

        const updated = mapProjectRow(data as ProjectRow);
        set((state) => ({
          projects: state.projects.map((project) => (project.id === id ? updated : project)),
        }));
      },

      deleteProject: async (id) => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;

        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', id)
          .eq('workspace_id', workspaceId);

        if (error) {
          console.error(error);
          return;
        }

        set((state) => ({
          projects: state.projects.filter((project) => project.id !== id),
          tasks: state.tasks.map((task) => task.projectId === id ? { ...task, projectId: null } : task),
        }));
      },

      addAssignee: async (assignee) => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;

        const { data, error } = await supabase
          .from('assignees')
          .insert({
            workspace_id: workspaceId,
            name: assignee.name,
          })
          .select('*')
          .single();

        if (error || !data) {
          console.error(error);
          return;
        }

        set((state) => ({ assignees: [...state.assignees, mapAssigneeRow(data as AssigneeRow)] }));
      },

      updateAssignee: async (id, updates) => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;

        const payload: Record<string, unknown> = {};
        if ('name' in updates) payload.name = updates.name;
        if (Object.keys(payload).length === 0) return;

        const { data, error } = await supabase
          .from('assignees')
          .update(payload)
          .eq('id', id)
          .eq('workspace_id', workspaceId)
          .select('*')
          .single();

        if (error || !data) {
          console.error(error);
          return;
        }

        const updated = mapAssigneeRow(data as AssigneeRow);
        set((state) => ({
          assignees: state.assignees.map((assignee) => (assignee.id === id ? updated : assignee)),
        }));
      },

      deleteAssignee: async (id) => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;

        const { error } = await supabase
          .from('assignees')
          .delete()
          .eq('id', id)
          .eq('workspace_id', workspaceId);

        if (error) {
          console.error(error);
          return;
        }

        set((state) => ({
          assignees: state.assignees.filter((assignee) => assignee.id !== id),
          tasks: state.tasks.map((task) => task.assigneeId === id ? { ...task, assigneeId: null } : task),
        }));
      },

      addStatus: async (status) => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;

        const { data, error } = await supabase
          .from('statuses')
          .insert({
            workspace_id: workspaceId,
            name: status.name,
            color: status.color,
            is_final: status.isFinal,
          })
          .select('*')
          .single();

        if (error || !data) {
          console.error(error);
          return;
        }

        set((state) => ({ statuses: [...state.statuses, mapStatusRow(data as StatusRow)] }));
      },

      updateStatus: async (id, updates) => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;

        const payload: Record<string, unknown> = {};
        if ('name' in updates) payload.name = updates.name;
        if ('color' in updates) payload.color = updates.color;
        if ('isFinal' in updates) payload.is_final = updates.isFinal;
        if (Object.keys(payload).length === 0) return;

        const { data, error } = await supabase
          .from('statuses')
          .update(payload)
          .eq('id', id)
          .eq('workspace_id', workspaceId)
          .select('*')
          .single();

        if (error || !data) {
          console.error(error);
          return;
        }

        const updated = mapStatusRow(data as StatusRow);
        set((state) => ({
          statuses: state.statuses.map((status) => (status.id === id ? updated : status)),
        }));
      },

      deleteStatus: async (id) => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;

        const { error } = await supabase
          .from('statuses')
          .delete()
          .eq('id', id)
          .eq('workspace_id', workspaceId);

        if (error) {
          console.error(error);
          return;
        }

        set((state) => ({
          statuses: state.statuses.filter((status) => status.id !== id),
        }));
      },

      addTaskType: async (taskType) => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;

        const { data, error } = await supabase
          .from('task_types')
          .insert({
            workspace_id: workspaceId,
            name: taskType.name,
            icon: taskType.icon,
          })
          .select('*')
          .single();

        if (error || !data) {
          console.error(error);
          return;
        }

        set((state) => ({ taskTypes: [...state.taskTypes, mapTaskTypeRow(data as TaskTypeRow)] }));
      },

      updateTaskType: async (id, updates) => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;

        const payload: Record<string, unknown> = {};
        if ('name' in updates) payload.name = updates.name;
        if ('icon' in updates) payload.icon = updates.icon;
        if (Object.keys(payload).length === 0) return;

        const { data, error } = await supabase
          .from('task_types')
          .update(payload)
          .eq('id', id)
          .eq('workspace_id', workspaceId)
          .select('*')
          .single();

        if (error || !data) {
          console.error(error);
          return;
        }

        const updated = mapTaskTypeRow(data as TaskTypeRow);
        set((state) => ({
          taskTypes: state.taskTypes.map((taskType) => (taskType.id === id ? updated : taskType)),
        }));
      },

      deleteTaskType: async (id) => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;

        const { error } = await supabase
          .from('task_types')
          .delete()
          .eq('id', id)
          .eq('workspace_id', workspaceId);

        if (error) {
          console.error(error);
          return;
        }

        set((state) => ({
          taskTypes: state.taskTypes.filter((taskType) => taskType.id !== id),
        }));
      },

      addTag: async (tag) => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;

        const { data, error } = await supabase
          .from('tags')
          .insert({
            workspace_id: workspaceId,
            name: tag.name,
            color: tag.color,
          })
          .select('*')
          .single();

        if (error || !data) {
          console.error(error);
          return;
        }

        set((state) => ({ tags: [...state.tags, mapTagRow(data as TagRow)] }));
      },

      updateTag: async (id, updates) => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;

        const payload: Record<string, unknown> = {};
        if ('name' in updates) payload.name = updates.name;
        if ('color' in updates) payload.color = updates.color;
        if (Object.keys(payload).length === 0) return;

        const { data, error } = await supabase
          .from('tags')
          .update(payload)
          .eq('id', id)
          .eq('workspace_id', workspaceId)
          .select('*')
          .single();

        if (error || !data) {
          console.error(error);
          return;
        }

        const updated = mapTagRow(data as TagRow);
        set((state) => ({
          tags: state.tags.map((tag) => (tag.id === id ? updated : tag)),
        }));
      },

      deleteTag: async (id) => {
        const workspaceId = get().workspaceId;
        if (!workspaceId) return;

        const { error } = await supabase
          .from('tags')
          .delete()
          .eq('id', id)
          .eq('workspace_id', workspaceId);

        if (error) {
          console.error(error);
          return;
        }

        set((state) => ({
          tags: state.tags.filter((tag) => tag.id !== id),
          tasks: state.tasks.map((task) => ({
            ...task,
            tagIds: task.tagIds.filter((tagId) => tagId !== id),
          })),
        }));
      },

      setViewMode: (mode) => set({ viewMode: mode }),
      setGroupMode: (mode) => set({ groupMode: mode }),
      setCurrentDate: (date) => set({ currentDate: date }),
      requestScrollToDate: (date) => set((state) => ({
        scrollTargetDate: date,
        scrollRequestId: state.scrollRequestId + 1,
      })),
      setFilters: (filters) => set((state) => ({
        filters: { ...state.filters, ...filters },
      })),
      clearFilters: () => set({ filters: initialFilters }),
      setSelectedTaskId: (id) => set({ selectedTaskId: id }),
    }),
    {
      name: 'planner-storage',
      partialize: (state) => ({
        viewMode: state.viewMode,
        groupMode: state.groupMode,
        currentDate: state.currentDate,
        filters: state.filters,
      }),
    }
  )
);
