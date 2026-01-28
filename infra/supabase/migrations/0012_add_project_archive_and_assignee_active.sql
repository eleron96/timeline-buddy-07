alter table public.projects
  add column if not exists archived boolean not null default false;

alter table public.assignees
  add column if not exists is_active boolean not null default true;

create index if not exists projects_workspace_archived_idx
  on public.projects (workspace_id, archived);

create index if not exists assignees_workspace_active_idx
  on public.assignees (workspace_id, is_active);
