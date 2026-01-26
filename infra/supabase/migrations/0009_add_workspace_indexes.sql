create index if not exists projects_workspace_id_idx
  on public.projects (workspace_id);

create index if not exists assignees_workspace_id_idx
  on public.assignees (workspace_id);

create index if not exists statuses_workspace_id_idx
  on public.statuses (workspace_id);

create index if not exists task_types_workspace_id_idx
  on public.task_types (workspace_id);

create index if not exists tags_workspace_id_idx
  on public.tags (workspace_id);

create index if not exists tasks_workspace_id_idx
  on public.tasks (workspace_id);

create index if not exists milestones_workspace_id_idx
  on public.milestones (workspace_id);

create index if not exists workspace_members_user_id_idx
  on public.workspace_members (user_id);
