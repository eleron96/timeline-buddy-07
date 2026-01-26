create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  date date not null,
  title text not null,
  created_at timestamptz not null default now()
);

alter table public.milestones enable row level security;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'milestones'
      and policyname = 'workspace members can read milestones'
  ) then
    create policy "workspace members can read milestones" on public.milestones
      for select using (public.is_workspace_member(workspace_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'milestones'
      and policyname = 'workspace editors can write milestones'
  ) then
    create policy "workspace editors can write milestones" on public.milestones
      for insert with check (public.is_workspace_editor(workspace_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'milestones'
      and policyname = 'workspace editors can update milestones'
  ) then
    create policy "workspace editors can update milestones" on public.milestones
      for update using (public.is_workspace_editor(workspace_id)) with check (public.is_workspace_editor(workspace_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'milestones'
      and policyname = 'workspace editors can delete milestones'
  ) then
    create policy "workspace editors can delete milestones" on public.milestones
      for delete using (public.is_workspace_editor(workspace_id));
  end if;
end $$;
