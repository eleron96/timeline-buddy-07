import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { usePlannerStore } from '@/features/planner/store/plannerStore';
import { useAuthStore } from '@/features/auth/store/authStore';
import { WorkspaceSwitcher } from '@/features/workspace/components/WorkspaceSwitcher';
import { WorkspaceNav } from '@/features/workspace/components/WorkspaceNav';
import { SettingsPanel } from '@/features/workspace/components/SettingsPanel';
import { AccountSettingsDialog } from '@/features/auth/components/AccountSettingsDialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Badge } from '@/shared/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Checkbox } from '@/shared/ui/checkbox';
import { ScrollArea } from '@/shared/ui/scroll-area';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { ColorPicker } from '@/shared/ui/color-picker';
import { supabase } from '@/shared/lib/supabaseClient';
import { formatStatusLabel } from '@/shared/lib/statusLabels';
import { formatProjectLabel } from '@/shared/lib/projectLabels';
import { format, parseISO } from 'date-fns';
import {
  ArrowDownAZ,
  ArrowDownZA,
  ChevronDown,
  Filter,
  Layers,
  Settings,
  User,
  Plus,
  RefreshCcw,
} from 'lucide-react';
import { Customer, Project, Task } from '@/features/planner/types/planner';
import DOMPurify from 'dompurify';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/shared/ui/context-menu';

type TaskRow = {
  id: string;
  title: string;
  project_id: string | null;
  assignee_id: string | null;
  assignee_ids: string[] | null;
  start_date: string;
  end_date: string;
  status_id: string;
  type_id: string;
  priority: string | null;
  tag_ids: string[] | null;
  description: string | null;
  repeat_id: string | null;
};

const normalizeAssigneeIds = (assigneeIds: string[] | null | undefined, legacyId: string | null | undefined) => {
  const combined = [
    ...(assigneeIds ?? []),
    ...(legacyId ? [legacyId] : []),
  ];
  return Array.from(new Set(combined.filter(Boolean)));
};

const mapTaskRow = (row: TaskRow): Task => ({
  id: row.id,
  title: row.title,
  projectId: row.project_id,
  assigneeIds: normalizeAssigneeIds(row.assignee_ids, row.assignee_id),
  startDate: row.start_date,
  endDate: row.end_date,
  statusId: row.status_id,
  typeId: row.type_id,
  priority: row.priority as Task['priority'],
  tagIds: row.tag_ids ?? [],
  description: row.description,
  repeatId: row.repeat_id ?? null,
});

const hasRichTags = (value: string) => (
  /<\/?(b|strong|i|em|u|s|strike|ul|ol|li|blockquote|br|div|p|span|img)\b/i.test(value)
);

const sanitizeDescription = (value: string) => (
  DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [
      'b',
      'strong',
      'i',
      'em',
      'u',
      's',
      'strike',
      'ul',
      'ol',
      'li',
      'blockquote',
      'br',
      'div',
      'p',
      'span',
      'img',
    ],
    ALLOWED_ATTR: ['src', 'alt', 'style', 'width', 'height'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|data:image\/)|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  })
);

const CustomerCombobox: React.FC<{
  value: string | null;
  customers: Customer[];
  onChange: (value: string | null) => void;
  onCreateCustomer: (name: string) => Promise<Customer | null>;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}> = ({
  value,
  customers,
  onChange,
  onCreateCustomer,
  disabled,
  placeholder = 'No customer',
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim();
  const normalizedLower = normalizedQuery.toLowerCase();
  const filteredCustomers = useMemo(() => {
    if (!normalizedLower) return customers;
    return customers.filter((customer) => customer.name.toLowerCase().includes(normalizedLower));
  }, [customers, normalizedLower]);
  const exactMatch = useMemo(() => (
    normalizedLower
      ? customers.find((customer) => customer.name.trim().toLowerCase() === normalizedLower)
      : null
  ), [customers, normalizedLower]);
  const selectedLabel = value
    ? customers.find((customer) => customer.id === value)?.name ?? placeholder
    : placeholder;

  const handleSelect = (nextValue: string | null) => {
    onChange(nextValue);
    setOpen(false);
    setQuery('');
  };

  const handleCreate = async () => {
    if (!normalizedQuery) return;
    if (exactMatch) {
      handleSelect(exactMatch.id);
      return;
    }
    const created = await onCreateCustomer(normalizedQuery);
    if (created) {
      handleSelect(created.id);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery('');
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-full justify-between ${className ?? ''}`}
          disabled={disabled}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Find or add customer..."
            value={query}
            onValueChange={setQuery}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (normalizedQuery) {
                  void handleCreate();
                }
              }
            }}
          />
          <CommandList>
            <CommandEmpty>No customers found.</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={() => handleSelect(null)}>
                No customer
              </CommandItem>
              {normalizedQuery && !exactMatch && (
                <CommandItem onSelect={() => void handleCreate()}>
                  Create "{normalizedQuery}"
                </CommandItem>
              )}
              {filteredCustomers.map((customer) => (
                <CommandItem key={customer.id} onSelect={() => handleSelect(customer.id)}>
                  {customer.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const ProjectsPage = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilterIds, setStatusFilterIds] = useState<string[]>([]);
  const [assigneeFilterIds, setAssigneeFilterIds] = useState<string[]>([]);
  const [customerFilterIds, setCustomerFilterIds] = useState<string[]>([]);
  const [customerSort, setCustomerSort] = useState<'asc' | 'desc'>('asc');
  const [groupByCustomer, setGroupByCustomer] = useState(false);
  const [mode, setMode] = useState<'projects' | 'customers'>('projects');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [projectSettingsTarget, setProjectSettingsTarget] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCode, setNewProjectCode] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#3b82f6');
  const [newProjectCustomerId, setNewProjectCustomerId] = useState<string | null>(null);
  const [projectSettingsName, setProjectSettingsName] = useState('');
  const [projectSettingsCode, setProjectSettingsCode] = useState('');
  const [projectSettingsColor, setProjectSettingsColor] = useState('#3b82f6');
  const [projectSettingsCustomerId, setProjectSettingsCustomerId] = useState<string | null>(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingCustomerName, setEditingCustomerName] = useState('');
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<Project | null>(null);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [deleteCustomerTarget, setDeleteCustomerTarget] = useState<Customer | null>(null);
  const [deleteCustomerOpen, setDeleteCustomerOpen] = useState(false);
  const editCustomerInputRef = useRef<HTMLInputElement | null>(null);

  const {
    projects,
    customers,
    statuses,
    assignees,
    taskTypes,
    tags,
    loadWorkspaceData,
    addProject,
    addCustomer,
    updateProject,
    updateCustomer,
    deleteCustomer,
    deleteProject,
    setHighlightedTaskId,
    setViewMode,
    setCurrentDate,
    requestScrollToDate,
    clearFilters,
  } = usePlannerStore();

  const {
    user,
    profileDisplayName,
    currentWorkspaceId,
    currentWorkspaceRole,
    isSuperAdmin,
  } = useAuthStore();

  const canEdit = currentWorkspaceRole === 'editor' || currentWorkspaceRole === 'admin';
  const userLabel = profileDisplayName || user?.email || user?.id || '';

  useEffect(() => {
    if (currentWorkspaceId) {
      loadWorkspaceData(currentWorkspaceId);
    }
  }, [currentWorkspaceId, loadWorkspaceData]);

  const activeProjects = useMemo(
    () => [...projects].filter((project) => !project.archived).sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );
  const archivedProjects = useMemo(
    () => [...projects].filter((project) => project.archived).sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );
  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );
  const sortedCustomers = useMemo(() => {
    const list = [...customers].sort((a, b) => (
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    ));
    return customerSort === 'asc' ? list : list.reverse();
  }, [customers, customerSort]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const statusById = useMemo(
    () => new Map(statuses.map((status) => [status.id, status])),
    [statuses],
  );
  const assigneeById = useMemo(
    () => new Map(assignees.map((assignee) => [assignee.id, assignee])),
    [assignees],
  );
  const taskTypeById = useMemo(
    () => new Map(taskTypes.map((type) => [type.id, type])),
    [taskTypes],
  );
  const tagById = useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag])),
    [tags],
  );

  const projectAssigneeIds = useMemo(() => {
    const ids = new Set<string>();
    projectTasks.forEach((task) => {
      task.assigneeIds.forEach((id) => ids.add(id));
    });
    return ids;
  }, [projectTasks]);

  const assigneeOptions = useMemo(
    () => assignees.filter((assignee) => projectAssigneeIds.has(assignee.id)),
    [assignees, projectAssigneeIds],
  );

  const customerProjectCounts = useMemo(() => {
    const counts = new Map<string, number>();
    projects.forEach((project) => {
      const key = project.customerId ?? 'none';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [projects]);

  const matchesCustomerFilter = useCallback((project: Project) => {
    if (customerFilterIds.length === 0) return true;
    const targetId = project.customerId ?? 'none';
    return customerFilterIds.includes(targetId);
  }, [customerFilterIds]);

  const filteredActiveProjects = useMemo(
    () => activeProjects.filter(matchesCustomerFilter),
    [activeProjects, matchesCustomerFilter],
  );

  const filteredArchivedProjects = useMemo(
    () => archivedProjects.filter(matchesCustomerFilter),
    [archivedProjects, matchesCustomerFilter],
  );

  useEffect(() => {
    const list = tab === 'active' ? filteredActiveProjects : filteredArchivedProjects;
    if (list.length === 0) {
      setSelectedProjectId(null);
      return;
    }
    if (!selectedProjectId || !list.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(list[0].id);
    }
  }, [filteredActiveProjects, filteredArchivedProjects, selectedProjectId, tab]);

  const fetchProjectTasks = useCallback(async (projectId: string) => {
    if (!currentWorkspaceId) return;
    setTasksLoading(true);
    setTasksError('');
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('workspace_id', currentWorkspaceId)
      .eq('project_id', projectId)
      .order('start_date', { ascending: true });
    if (error) {
      setTasksError(error.message);
      setTasksLoading(false);
      return;
    }
    setProjectTasks((data ?? []).map((row) => mapTaskRow(row as TaskRow)));
    setTasksLoading(false);
  }, [currentWorkspaceId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setProjectTasks([]);
      setSelectedTaskId(null);
      return;
    }
    fetchProjectTasks(selectedProjectId);
  }, [fetchProjectTasks, selectedProjectId]);

  useEffect(() => {
    if (!selectedTaskId) return;
    if (!projectTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }, [projectTasks, selectedTaskId]);

  const selectedTask = useMemo(
    () => projectTasks.find((task) => task.id === selectedTaskId) ?? null,
    [projectTasks, selectedTaskId],
  );

  const selectedTaskProject = useMemo(
    () => projects.find((project) => project.id === selectedTask?.projectId) ?? null,
    [projects, selectedTask?.projectId],
  );
  const selectedCustomer = useMemo(
    () => (selectedCustomerId ? customerById.get(selectedCustomerId) ?? null : null),
    [customerById, selectedCustomerId],
  );
  const selectedCustomerProjects = useMemo(() => {
    if (!selectedCustomerId) return [];
    return projects
      .filter((project) => project.customerId === selectedCustomerId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, selectedCustomerId]);
  const selectedTaskCustomer = useMemo(() => (
    selectedTaskProject?.customerId ? customerById.get(selectedTaskProject.customerId) ?? null : null
  ), [customerById, selectedTaskProject?.customerId]);

  const selectedTaskTags = useMemo(() => (
    selectedTask?.tagIds.map((tagId) => tagById.get(tagId)).filter(Boolean) ?? []
  ), [selectedTask?.tagIds, tagById]);

  const selectedTaskDescription = useMemo(() => {
    if (!selectedTask?.description) return '';
    if (!hasRichTags(selectedTask.description)) return selectedTask.description;
    return sanitizeDescription(selectedTask.description);
  }, [selectedTask?.description]);

  const navigate = useNavigate();

  const handleOpenTaskInTimeline = useCallback(() => {
    if (!selectedTask) return;
    setHighlightedTaskId(selectedTask.id);
    clearFilters();
    if (user?.id && typeof window !== 'undefined') {
      window.localStorage.removeItem(`planner-filters-${user.id}`);
    }
    setViewMode('week');
    setCurrentDate(selectedTask.startDate);
    requestScrollToDate(selectedTask.startDate);
    setSelectedTaskId(null);
    navigate('/');
  }, [
    clearFilters,
    navigate,
    requestScrollToDate,
    selectedTask,
    setHighlightedTaskId,
    setCurrentDate,
    setSelectedTaskId,
    setViewMode,
    user?.id,
  ]);

  const filteredTasks = useMemo(() => (
    projectTasks.filter((task) => {
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        if (!task.title.toLowerCase().includes(query)) return false;
      }
      if (statusFilterIds.length > 0 && !statusFilterIds.includes(task.statusId)) {
        return false;
      }
      if (assigneeFilterIds.length > 0) {
        if (!task.assigneeIds.some((id) => assigneeFilterIds.includes(id))) return false;
      }
      return true;
    })
  ), [assigneeFilterIds, projectTasks, search, statusFilterIds]);

  const statusFilterLabel = statusFilterIds.length === 0
    ? 'All statuses'
    : `${statusFilterIds.length} selected`;

  const assigneeFilterLabel = assigneeFilterIds.length === 0
    ? 'All assignees'
    : `${assigneeFilterIds.length} selected`;

  const customerFilterLabel = customerFilterIds.length === 0
    ? 'All'
    : `${customerFilterIds.length} selected`;

  const customerSortLabel = customerSort === 'asc' ? 'A-Z' : 'Я-А';

  const modeToggle = (
    <div className="inline-flex items-center gap-2 rounded-lg bg-muted/60 p-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setMode('projects')}
        className={`h-7 px-3 text-xs rounded-md ${mode === 'projects' ? 'bg-foreground text-background shadow-sm' : ''}`}
      >
        Projects
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setMode('customers')}
        className={`h-7 px-3 text-xs rounded-md ${mode === 'customers' ? 'bg-foreground text-background shadow-sm' : ''}`}
      >
        Customers
      </Button>
    </div>
  );

  const handleToggleStatus = (statusId: string) => {
    setStatusFilterIds((current) => (
      current.includes(statusId)
        ? current.filter((id) => id !== statusId)
        : [...current, statusId]
    ));
  };

  const handleToggleAssignee = (assigneeId: string) => {
    setAssigneeFilterIds((current) => (
      current.includes(assigneeId)
        ? current.filter((id) => id !== assigneeId)
        : [...current, assigneeId]
    ));
  };

  const handleToggleCustomer = (customerId: string) => {
    setCustomerFilterIds((current) => (
      current.includes(customerId)
        ? current.filter((id) => id !== customerId)
        : [...current, customerId]
    ));
  };

  const setStatusPreset = (mode: 'all' | 'open' | 'done') => {
    if (mode === 'all') {
      setStatusFilterIds([]);
      return;
    }
    const targetIds = statuses
      .filter((status) => (mode === 'done'
        ? (status.isFinal || status.isCancelled)
        : (!status.isFinal && !status.isCancelled)))
      .map((status) => status.id);
    setStatusFilterIds(targetIds);
  };

  const resetCreateProjectForm = useCallback(() => {
    setNewProjectName('');
    setNewProjectCode('');
    setNewProjectColor('#3b82f6');
    setNewProjectCustomerId(null);
    setEditingCustomerId(null);
    setEditingCustomerName('');
  }, []);

  const handleCreateProject = useCallback(async () => {
    if (!canEdit || !newProjectName.trim()) return;
    await addProject({
      name: newProjectName.trim(),
      code: newProjectCode.trim() ? newProjectCode.trim() : null,
      color: newProjectColor,
      archived: false,
      customerId: newProjectCustomerId,
    });
    setCreateProjectOpen(false);
    resetCreateProjectForm();
  }, [
    addProject,
    canEdit,
    newProjectCode,
    newProjectColor,
    newProjectCustomerId,
    newProjectName,
    resetCreateProjectForm,
  ]);

  const createCustomerByName = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!canEdit || !trimmed) return null;
    const normalized = trimmed.toLowerCase();
    const existing = customers.find((customer) => customer.name.trim().toLowerCase() === normalized);
    if (existing) return existing;
    return addCustomer({ name: trimmed });
  }, [addCustomer, canEdit, customers]);

  const handleAddCustomerFromTab = useCallback(async () => {
    if (!newCustomerName.trim()) return;
    const created = await createCustomerByName(newCustomerName);
    if (created) {
      setSelectedCustomerId(created.id);
    }
    setNewCustomerName('');
  }, [createCustomerByName, newCustomerName]);

  const startCustomerEdit = useCallback((customerId: string, customerName: string) => {
    if (!canEdit) return;
    setEditingCustomerId(customerId);
    setEditingCustomerName(customerName);
  }, [canEdit]);

  const commitCustomerEdit = useCallback(async (customerId: string) => {
    if (!canEdit) return;
    const nextName = editingCustomerName.trim();
    if (!nextName) {
      setEditingCustomerId(null);
      setEditingCustomerName('');
      return;
    }
    await updateCustomer(customerId, { name: nextName });
    setEditingCustomerId(null);
    setEditingCustomerName('');
  }, [canEdit, editingCustomerName, updateCustomer]);

  const cancelCustomerEdit = useCallback(() => {
    setEditingCustomerId(null);
    setEditingCustomerName('');
  }, []);

  const openProjectSettings = useCallback((project: Project) => {
    if (!canEdit) return;
    setProjectSettingsTarget(project);
    setProjectSettingsName(project.name);
    setProjectSettingsCode(project.code ?? '');
    setProjectSettingsColor(project.color);
    setProjectSettingsCustomerId(project.customerId ?? null);
    setProjectSettingsOpen(true);
  }, [canEdit]);

  const handleSaveProjectSettings = useCallback(async () => {
    if (!canEdit || !projectSettingsTarget) return;
    const nextName = projectSettingsName.trim();
    if (!nextName) return;
    const nextCode = projectSettingsCode.trim();
    const normalizedCode = nextCode ? nextCode : null;
    const updates: Partial<Project> = {};
    if (nextName !== projectSettingsTarget.name) updates.name = nextName;
    if ((projectSettingsTarget.code ?? null) !== normalizedCode) updates.code = normalizedCode;
    if (projectSettingsColor !== projectSettingsTarget.color) updates.color = projectSettingsColor;
    if (projectSettingsCustomerId !== projectSettingsTarget.customerId) {
      updates.customerId = projectSettingsCustomerId;
    }
    if (Object.keys(updates).length > 0) {
      await updateProject(projectSettingsTarget.id, updates);
    }
    setProjectSettingsOpen(false);
  }, [
    canEdit,
    projectSettingsCode,
    projectSettingsColor,
    projectSettingsCustomerId,
    projectSettingsName,
    projectSettingsTarget,
    updateProject,
  ]);

  const requestDeleteProject = useCallback((project: Project) => {
    if (!canEdit) return;
    setDeleteProjectTarget(project);
    setDeleteProjectOpen(true);
  }, [canEdit]);

  const handleConfirmDeleteProject = useCallback(() => {
    if (!deleteProjectTarget) return;
    deleteProject(deleteProjectTarget.id);
    setDeleteProjectOpen(false);
    setDeleteProjectTarget(null);
  }, [deleteProject, deleteProjectTarget]);

  const requestDeleteCustomer = useCallback((customer: Customer) => {
    if (!canEdit) return;
    setDeleteCustomerTarget(customer);
    setDeleteCustomerOpen(true);
  }, [canEdit]);

  const handleConfirmDeleteCustomer = useCallback(() => {
    if (!deleteCustomerTarget) return;
    deleteCustomer(deleteCustomerTarget.id);
    if (selectedCustomerId === deleteCustomerTarget.id) {
      setSelectedCustomerId(null);
    }
    setDeleteCustomerOpen(false);
    setDeleteCustomerTarget(null);
  }, [deleteCustomer, deleteCustomerTarget, selectedCustomerId]);

  useEffect(() => {
    if (editingCustomerId && editCustomerInputRef.current) {
      editCustomerInputRef.current.focus();
      editCustomerInputRef.current.select();
    }
  }, [editingCustomerId]);

  useEffect(() => {
    if (!createProjectOpen) {
      resetCreateProjectForm();
    }
  }, [createProjectOpen, resetCreateProjectForm]);

  useEffect(() => {
    if (!projectSettingsOpen) {
      setProjectSettingsTarget(null);
    }
  }, [projectSettingsOpen]);

  useEffect(() => {
    if (mode !== 'customers') return;
    if (sortedCustomers.length === 0) {
      setSelectedCustomerId(null);
      return;
    }
    if (!selectedCustomerId || !sortedCustomers.some((customer) => customer.id === selectedCustomerId)) {
      setSelectedCustomerId(sortedCustomers[0].id);
    }
  }, [mode, selectedCustomerId, sortedCustomers]);

  const groupedProjects = useCallback((list: Project[]) => {
    if (!groupByCustomer) {
      return [
        { id: 'all', name: 'All projects', projects: list },
      ];
    }

    const grouped = new Map<string, Project[]>();
    list.forEach((project) => {
      const key = project.customerId ?? 'none';
      const bucket = grouped.get(key) ?? [];
      bucket.push(project);
      grouped.set(key, bucket);
    });

    const result: Array<{ id: string; name: string; projects: Project[] }> = [];
    sortedCustomers.forEach((customer) => {
      const bucket = grouped.get(customer.id);
      if (bucket && bucket.length > 0) {
        result.push({ id: customer.id, name: customer.name, projects: bucket });
      }
    });

    const noCustomer = grouped.get('none');
    if (noCustomer && noCustomer.length > 0) {
      result.push({ id: 'none', name: 'No customer', projects: noCustomer });
    }

    return result;
  }, [groupByCustomer, sortedCustomers]);

  const handleOpenProjectFromCustomer = useCallback((project: Project) => {
    setMode('projects');
    setTab(project.archived ? 'archived' : 'active');
    setSelectedProjectId(project.id);
  }, []);

  if (isSuperAdmin) {
    return <Navigate to="/admin/users" replace />;
  }

  const renderProjectItem = (project: Project, showArchivedBadge: boolean) => {
    const customerName = project.customerId ? customerById.get(project.customerId)?.name : null;
    return (
      <ContextMenu key={project.id}>
        <ContextMenuTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setSelectedProjectId(project.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedProjectId(project.id);
              }
            }}
            className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
              selectedProjectId === project.id ? 'border-foreground/60 bg-muted/60' : 'border-border hover:bg-muted/40'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {formatProjectLabel(project.name, project.code)}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {customerName ?? 'No customer'}
                </div>
              </div>
              {showArchivedBadge && (
                <Badge variant="secondary" className="text-[10px]">Archived</Badge>
              )}
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem disabled={!canEdit} onSelect={() => openProjectSettings(project)}>
            Edit
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!canEdit}
            onSelect={() => updateProject(project.id, { archived: !project.archived })}
          >
            {project.archived ? 'Restore' : 'Archive'}
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!canEdit}
            onSelect={() => requestDeleteProject(project)}
            className="text-destructive focus:text-destructive"
          >
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const renderProjectGroups = (list: Project[], showArchivedBadge: boolean) => {
    if (list.length === 0) {
      return (
        <div className="text-sm text-muted-foreground">
          No projects match the current filters.
        </div>
      );
    }

    if (!groupByCustomer) {
      return (
        <div className="space-y-2">
          {list.map((project) => renderProjectItem(project, showArchivedBadge))}
        </div>
      );
    }

    const groups = groupedProjects(list);
    return (
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.id} className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {group.name}
            </div>
            <div className="space-y-2">
              {group.projects.map((project) => renderProjectItem(project, showArchivedBadge))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <WorkspaceSwitcher />
          <WorkspaceNav />
        </div>
        <div className="flex items-center gap-2">
          {userLabel && (
            <span className="max-w-[220px] truncate text-xs text-muted-foreground" title={userLabel}>
              {userLabel}
            </span>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSettings(true)}
            className="h-9 w-9"
            disabled={!canEdit}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowAccountSettings(true)}
            className="h-9 w-9"
          >
            <User className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 border-r border-border bg-card flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            {modeToggle}
          </div>
          {mode === 'projects' && (
            <>
              <div className="p-4 space-y-3 border-b border-border">
                <Button
                  className="w-full justify-center"
                  onClick={() => setCreateProjectOpen(true)}
                  disabled={!canEdit}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New project
                </Button>
              </div>
            </>
          )}

          {mode === 'customers' && (
            <>
              <div className="p-4 space-y-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Input
                    className="h-9 flex-1"
                    placeholder="New customer name..."
                    value={newCustomerName}
                    onChange={(event) => setNewCustomerName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleAddCustomerFromTab();
                      }
                    }}
                    disabled={!canEdit}
                  />
                  <Button
                    size="sm"
                    onClick={handleAddCustomerFromTab}
                    disabled={!canEdit || !newCustomerName.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
              <div className="mx-4 mt-3 flex items-center justify-end">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-2 px-2"
                    onClick={() => setCustomerSort((current) => (current === 'asc' ? 'desc' : 'asc'))}
                  >
                    {customerSort === 'asc' ? (
                      <ArrowDownAZ className="h-4 w-4" />
                    ) : (
                      <ArrowDownZA className="h-4 w-4" />
                    )}
                    <span className="text-xs text-muted-foreground">{customerSortLabel}</span>
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full px-4 py-3">
                  {sortedCustomers.length === 0 && (
                    <div className="text-sm text-muted-foreground">No customers yet.</div>
                  )}
                  {sortedCustomers.length > 0 && (
                    <div className="space-y-2">
                      {sortedCustomers.map((customer) => {
                        const isEditing = editingCustomerId === customer.id;
                        const projectCount = customerProjectCounts.get(customer.id) ?? 0;
                        const isSelected = selectedCustomerId === customer.id;
                        return (
                          <ContextMenu key={customer.id}>
                            <ContextMenuTrigger asChild>
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedCustomerId(customer.id)}
                                onContextMenu={() => setSelectedCustomerId(customer.id)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    setSelectedCustomerId(customer.id);
                                  }
                                }}
                                className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                                  isSelected ? 'border-foreground/60 bg-muted/60' : 'border-border hover:bg-muted/40'
                                }`}
                              >
                                {isEditing ? (
                                  <Input
                                    ref={editCustomerInputRef}
                                    value={editingCustomerName}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) => setEditingCustomerName(event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        event.preventDefault();
                                        commitCustomerEdit(customer.id);
                                      }
                                      if (event.key === 'Escape') {
                                        event.preventDefault();
                                        cancelCustomerEdit();
                                      }
                                    }}
                                    onBlur={() => commitCustomerEdit(customer.id)}
                                    className="h-8 flex-1"
                                    disabled={!canEdit}
                                  />
                                ) : (
                                  <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium truncate">{customer.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {projectCount} projects
                                    </div>
                                  </div>
                                )}
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem
                                disabled={!canEdit}
                                onSelect={() => startCustomerEdit(customer.id, customer.name)}
                              >
                                Edit
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={!canEdit}
                                onSelect={() => requestDeleteCustomer(customer)}
                                className="text-destructive focus:text-destructive"
                              >
                                Delete
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </>
          )}

          {mode === 'projects' && (
            <Tabs value={tab} onValueChange={(value) => setTab(value as 'active' | 'archived')} className="flex-1 flex flex-col">
              <div className="mx-4 mt-3 flex items-center justify-end">
                <div className="flex items-center gap-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 gap-2 px-2">
                        <Filter className="h-4 w-4" />
                        <span className="text-xs text-muted-foreground">{customerFilterLabel}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-60 p-3" align="start">
                      <div className="flex items-center justify-between pb-2">
                        <span className="text-xs text-muted-foreground">Filter customers</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setCustomerFilterIds([])}
                        >
                          Clear
                        </Button>
                      </div>
                      <ScrollArea className="max-h-56 pr-2">
                        <div className="space-y-1">
                          <label className="flex items-center gap-2 py-1 cursor-pointer">
                            <Checkbox
                              checked={customerFilterIds.includes('none')}
                              onCheckedChange={() => handleToggleCustomer('none')}
                            />
                            <span className="text-sm">No customer</span>
                          </label>
                          {sortedCustomers.length === 0 && (
                            <div className="text-xs text-muted-foreground">No customers yet.</div>
                          )}
                          {sortedCustomers.map((customer) => (
                            <label key={customer.id} className="flex items-center gap-2 py-1 cursor-pointer">
                              <Checkbox
                                checked={customerFilterIds.includes(customer.id)}
                                onCheckedChange={() => handleToggleCustomer(customer.id)}
                              />
                              <span className="text-sm truncate">{customer.name}</span>
                            </label>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-2 px-2"
                    onClick={() => setCustomerSort((current) => (current === 'asc' ? 'desc' : 'asc'))}
                  >
                    {customerSort === 'asc' ? (
                      <ArrowDownAZ className="h-4 w-4" />
                    ) : (
                      <ArrowDownZA className="h-4 w-4" />
                    )}
                    <span className="text-xs text-muted-foreground">{customerSortLabel}</span>
                  </Button>
                  <Button
                    variant={groupByCustomer ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => setGroupByCustomer((current) => !current)}
                    aria-pressed={groupByCustomer}
                    title="Group by customer"
                  >
                    <Layers className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <TabsList className="mx-4 mt-2 grid grid-cols-2">
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="archived">Archived</TabsTrigger>
              </TabsList>
              <TabsContent value="active" className="flex-1 overflow-hidden">
                <ScrollArea className="h-full px-4 py-3">
                  {activeProjects.length === 0 && (
                    <div className="text-sm text-muted-foreground">No active projects.</div>
                  )}
                  {activeProjects.length > 0 && renderProjectGroups(filteredActiveProjects, false)}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="archived" className="flex-1 overflow-hidden">
                <ScrollArea className="h-full px-4 py-3">
                  {archivedProjects.length === 0 && (
                    <div className="text-sm text-muted-foreground">No archived projects.</div>
                  )}
                  {archivedProjects.length > 0 && renderProjectGroups(filteredArchivedProjects, true)}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </aside>

        <section className="flex-1 overflow-hidden flex flex-col">
          {mode === 'projects' ? (
            <>
              {!selectedProject && (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  Select a project to view details.
                </div>
              )}

              {selectedProject && (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="border-b border-border px-6 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="text-lg font-semibold">
                            {formatProjectLabel(selectedProject.name, selectedProject.code)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {customerById.get(selectedProject.customerId ?? '')?.name ?? 'No customer'}
                          </div>
                        </div>
                        {selectedProject.archived && (
                          <Badge variant="secondary">Archived</Badge>
                        )}
                      </div>
                      
                    </div>
                  </div>

                  <div className="px-6 py-4 border-b border-border">
                    <div className="flex flex-wrap items-center gap-3">
                      <Input
                        className="w-[220px]"
                        placeholder="Search tasks..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline">{statusFilterLabel}</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="start">
                          <div className="flex gap-2 pb-2">
                            <Button size="sm" variant="ghost" onClick={() => setStatusPreset('all')}>All</Button>
                            <Button size="sm" variant="ghost" onClick={() => setStatusPreset('open')}>Open</Button>
                            <Button size="sm" variant="ghost" onClick={() => setStatusPreset('done')}>Done</Button>
                          </div>
                          <ScrollArea className="max-h-48 pr-2">
                            <div className="space-y-1">
                              {statuses.map((status) => (
                                <label key={status.id} className="flex items-center gap-2 py-1 cursor-pointer">
                                  <Checkbox
                                    checked={statusFilterIds.includes(status.id)}
                                    onCheckedChange={() => handleToggleStatus(status.id)}
                                  />
                                  <span className="inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
                                  <span className="text-sm truncate">{formatStatusLabel(status.name, status.emoji)}</span>
                                </label>
                              ))}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline">{assigneeFilterLabel}</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="start">
                          <ScrollArea className="max-h-48 pr-2">
                            <div className="space-y-1">
                              {assigneeOptions.length === 0 && (
                                <div className="text-xs text-muted-foreground">No assignees on this project.</div>
                              )}
                              {assigneeOptions.map((assignee) => (
                                <label key={assignee.id} className="flex items-center gap-2 py-1 cursor-pointer">
                                  <Checkbox
                                    checked={assigneeFilterIds.includes(assignee.id)}
                                    onCheckedChange={() => handleToggleAssignee(assignee.id)}
                                  />
                                  <span className="text-sm truncate">
                                    {assignee.name}
                                    {!assignee.isActive && (
                                      <span className="ml-1 text-[10px] text-muted-foreground">(disabled)</span>
                                    )}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>

                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSearch('');
                          setStatusFilterIds([]);
                          setAssigneeFilterIds([]);
                        }}
                      >
                        Clear filters
                      </Button>

                      <Button
                        variant="ghost"
                        className="ml-auto"
                        onClick={() => selectedProjectId && fetchProjectTasks(selectedProjectId)}
                        disabled={!selectedProjectId || tasksLoading}
                      >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto px-6 py-4">
                    {tasksLoading && (
                      <div className="text-sm text-muted-foreground">Loading tasks...</div>
                    )}
                    {!tasksLoading && tasksError && (
                      <div className="text-sm text-destructive">{tasksError}</div>
                    )}
                    {!tasksLoading && !tasksError && (
                      <>
                        {filteredTasks.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No tasks match the current filters.</div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Task</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Assignees</TableHead>
                                <TableHead>Dates</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredTasks.map((task) => {
                                const status = statusById.get(task.statusId);
                                const assigneesList = task.assigneeIds
                                  .map((id) => assigneeById.get(id))
                                  .filter((assignee): assignee is NonNullable<typeof assignee> => Boolean(assignee));
                                return (
                                  <TableRow
                                    key={task.id}
                                    role="button"
                                    tabIndex={0}
                                    className="cursor-pointer hover:bg-muted/40"
                                    onClick={() => setSelectedTaskId(task.id)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        setSelectedTaskId(task.id);
                                      }
                                    }}
                                  >
                                    <TableCell className="font-medium">{task.title}</TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2 text-sm">
                                        <span
                                          className="inline-flex h-2 w-2 rounded-full"
                                          style={{ backgroundColor: status?.color ?? '#94a3b8' }}
                                        />
                                        <span>{status ? formatStatusLabel(status.name, status.emoji) : 'Unknown'}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {assigneesList.length === 0 ? (
                                        <span className="text-xs text-muted-foreground">Unassigned</span>
                                      ) : (
                                        <div className="flex flex-wrap gap-1">
                                          {assigneesList.map((assignee) => (
                                            <Badge
                                              key={assignee.id}
                                              variant="secondary"
                                              className="text-[10px]"
                                            >
                                              {assignee.name}
                                              {!assignee.isActive && ' (disabled)'}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {format(parseISO(task.startDate), 'dd MMM yyyy')} – {format(parseISO(task.endDate), 'dd MMM yyyy')}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="border-b border-border px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">
                      {selectedCustomer?.name ?? 'Select a customer'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selectedCustomer
                        ? `${selectedCustomerProjects.length} projects`
                        : `${customers.length} customers`}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-auto px-6 py-4">
                {!selectedCustomer && (
                  <div className="text-sm text-muted-foreground">Choose a customer to see their projects.</div>
                )}
                {selectedCustomer && selectedCustomerProjects.length === 0 && (
                  <div className="text-sm text-muted-foreground">No projects assigned to this customer.</div>
                )}
                {selectedCustomer && selectedCustomerProjects.length > 0 && (
                  <div className="space-y-2">
                    {selectedCustomerProjects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => handleOpenProjectFromCustomer(project)}
                        className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-muted/40"
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {formatProjectLabel(project.name, project.code)}
                          </div>
                          {project.archived && (
                            <div className="text-[10px] text-muted-foreground">Archived</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      <SettingsPanel open={showSettings} onOpenChange={setShowSettings} />
      <AccountSettingsDialog open={showAccountSettings} onOpenChange={setShowAccountSettings} />
      <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
        <DialogContent className="w-[95vw] max-w-xl">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
              <div className="space-y-1">
                <Label>Project name</Label>
                <Input
                  placeholder="Enter project name..."
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleCreateProject()}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1">
                <Label>Code</Label>
                <Input
                  placeholder="Code"
                  value={newProjectCode}
                  onChange={(event) => setNewProjectCode(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleCreateProject()}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1">
                <Label>Color</Label>
                <div className="flex items-center">
                  <ColorPicker value={newProjectColor} onChange={setNewProjectColor} disabled={!canEdit} />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Customer</Label>
              <CustomerCombobox
                value={newProjectCustomerId}
                customers={customers}
                onChange={setNewProjectCustomerId}
                onCreateCustomer={createCustomerByName}
                disabled={!canEdit}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateProjectOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateProject} disabled={!canEdit || !newProjectName.trim()}>
                Create project
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={projectSettingsOpen} onOpenChange={setProjectSettingsOpen}>
        <DialogContent className="w-[95vw] max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
          </DialogHeader>
          {!projectSettingsTarget && (
            <div className="text-sm text-muted-foreground">Project not found.</div>
          )}
          {projectSettingsTarget && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
                <div className="space-y-1">
                  <Label>Project name</Label>
                  <Input
                    placeholder="Enter project name..."
                    value={projectSettingsName}
                    onChange={(event) => setProjectSettingsName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleSaveProjectSettings();
                      }
                    }}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Code</Label>
                  <Input
                    placeholder="Code"
                    value={projectSettingsCode}
                    onChange={(event) => setProjectSettingsCode(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleSaveProjectSettings();
                      }
                    }}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Color</Label>
                  <div className="flex items-center">
                    <ColorPicker value={projectSettingsColor} onChange={setProjectSettingsColor} disabled={!canEdit} />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Customer</Label>
                <CustomerCombobox
                  value={projectSettingsCustomerId}
                  customers={customers}
                  onChange={setProjectSettingsCustomerId}
                  onCreateCustomer={createCustomerByName}
                  disabled={!canEdit}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setProjectSettingsOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveProjectSettings}
                  disabled={!canEdit || !projectSettingsName.trim()}
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(selectedTaskId)} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
        <DialogContent className="w-[95vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title ?? 'Task details'}</DialogTitle>
          </DialogHeader>
          {!selectedTask && (
            <div className="text-sm text-muted-foreground">Task not found.</div>
          )}
          {selectedTask && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">Project</div>
                  <div className="text-sm">
                    {selectedTaskProject
                      ? formatProjectLabel(selectedTaskProject.name, selectedTaskProject.code)
                      : 'No project'}
                  </div>
                  {selectedTaskProject && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Customer: {selectedTaskCustomer?.name ?? 'No customer'}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className="inline-flex h-2 w-2 rounded-full"
                      style={{ backgroundColor: statusById.get(selectedTask.statusId)?.color ?? '#94a3b8' }}
                    />
                    <span>{statusById.get(selectedTask.statusId)
                      ? formatStatusLabel(
                        statusById.get(selectedTask.statusId)!.name,
                        statusById.get(selectedTask.statusId)!.emoji,
                      )
                      : 'Unknown'}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Assignees</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedTask.assigneeIds.length === 0 && (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                    {selectedTask.assigneeIds.map((id) => {
                      const assignee = assigneeById.get(id);
                      if (!assignee) return null;
                      return (
                        <Badge key={assignee.id} variant="secondary" className="text-[10px]">
                          {assignee.name}
                          {!assignee.isActive && ' (disabled)'}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Dates</div>
                  <div className="text-sm text-muted-foreground">
                    {format(parseISO(selectedTask.startDate), 'dd MMM yyyy')} – {format(parseISO(selectedTask.endDate), 'dd MMM yyyy')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Type</div>
                  <div className="text-sm">
                    {taskTypeById.get(selectedTask.typeId)?.name ?? 'Unknown'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Priority</div>
                  <div className="text-sm">{selectedTask.priority ?? 'None'}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs text-muted-foreground">Tags</div>
                  {selectedTaskTags.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No tags</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTaskTags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          className="text-[10px]"
                          style={{ borderColor: tag.color, color: tag.color }}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Description</div>
                {!selectedTask.description && (
                  <div className="text-sm text-muted-foreground">No description.</div>
                )}
                {selectedTask.description && hasRichTags(selectedTask.description) && (
                  <div
                    className="text-sm leading-6"
                    dangerouslySetInnerHTML={{ __html: selectedTaskDescription }}
                  />
                )}
                {selectedTask.description && !hasRichTags(selectedTask.description) && (
                  <div className="text-sm whitespace-pre-wrap">{selectedTaskDescription}</div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={handleOpenTaskInTimeline}>
                  Перейти к задаче
                </Button>
                <Button variant="outline" onClick={() => setSelectedTaskId(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={deleteProjectOpen}
        onOpenChange={(open) => {
          setDeleteProjectOpen(open);
          if (!open) {
            setDeleteProjectTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
          <AlertDialogDescription>
              This will remove "{deleteProjectTarget
                ? formatProjectLabel(deleteProjectTarget.name, deleteProjectTarget.code)
                : 'this project'}". Tasks will remain, but the project
              will be cleared from them.
          </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteProjectTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteProject}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={deleteCustomerOpen}
        onOpenChange={(open) => {
          setDeleteCustomerOpen(open);
          if (!open) {
            setDeleteCustomerTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{deleteCustomerTarget?.name ?? 'this customer'}". Projects will remain, but the
              customer will be cleared from them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteCustomerTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteCustomer}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectsPage;
