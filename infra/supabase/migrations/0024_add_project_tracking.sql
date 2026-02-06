create table if not exists public.project_tracking (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, project_id, user_id)
);

create index if not exists project_tracking_workspace_user_idx
  on public.project_tracking (workspace_id, user_id);

create index if not exists project_tracking_project_idx
  on public.project_tracking (project_id);

alter table public.project_tracking enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_tracking'
      and policyname = 'users can read tracked projects'
  ) then
    create policy "users can read tracked projects" on public.project_tracking
      for select using (public.is_workspace_member(workspace_id) and user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_tracking'
      and policyname = 'users can track projects'
  ) then
    create policy "users can track projects" on public.project_tracking
      for insert with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_tracking'
      and policyname = 'users can untrack projects'
  ) then
    create policy "users can untrack projects" on public.project_tracking
      for delete using (public.is_workspace_member(workspace_id) and user_id = auth.uid());
  end if;
end $$;
