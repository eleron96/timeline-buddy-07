create table if not exists public.member_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists member_groups_workspace_name_key
  on public.member_groups (workspace_id, lower(name));

create unique index if not exists member_groups_id_workspace_id_key
  on public.member_groups (id, workspace_id);

alter table public.member_groups enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_groups'
      and policyname = 'workspace members can read member groups'
  ) then
    create policy "workspace members can read member groups" on public.member_groups
      for select using (public.is_workspace_member(workspace_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_groups'
      and policyname = 'workspace admins can write member groups'
  ) then
    create policy "workspace admins can write member groups" on public.member_groups
      for insert with check (public.is_workspace_admin(workspace_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_groups'
      and policyname = 'workspace admins can update member groups'
  ) then
    create policy "workspace admins can update member groups" on public.member_groups
      for update using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_groups'
      and policyname = 'workspace admins can delete member groups'
  ) then
    create policy "workspace admins can delete member groups" on public.member_groups
      for delete using (public.is_workspace_admin(workspace_id));
  end if;
end $$;

alter table public.workspace_members
  add column if not exists group_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspace_members_group_id_fkey'
  ) then
    alter table public.workspace_members
      add constraint workspace_members_group_id_fkey
      foreign key (group_id, workspace_id)
      references public.member_groups (id, workspace_id)
      on delete set null;
  end if;
end $$;
