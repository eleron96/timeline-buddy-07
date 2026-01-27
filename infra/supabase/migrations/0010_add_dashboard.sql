create table if not exists public.workspace_dashboards (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  layouts jsonb not null default '{}'::jsonb,
  widgets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspace_dashboards
  add column if not exists layouts jsonb not null default '{}'::jsonb,
  add column if not exists widgets jsonb not null default '[]'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'workspace_dashboards_set_updated_at'
  ) then
    create trigger workspace_dashboards_set_updated_at
      before update on public.workspace_dashboards
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.workspace_dashboards enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workspace_dashboards'
      and policyname = 'workspace members can read dashboards'
  ) then
    create policy "workspace members can read dashboards" on public.workspace_dashboards
      for select using (public.is_workspace_member(workspace_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workspace_dashboards'
      and policyname = 'workspace editors can insert dashboards'
  ) then
    create policy "workspace editors can insert dashboards" on public.workspace_dashboards
      for insert with check (public.is_workspace_editor(workspace_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workspace_dashboards'
      and policyname = 'workspace editors can update dashboards'
  ) then
    create policy "workspace editors can update dashboards" on public.workspace_dashboards
      for update using (public.is_workspace_editor(workspace_id))
      with check (public.is_workspace_editor(workspace_id));
  end if;
end $$;

create or replace function public.dashboard_task_counts(
  p_workspace_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  assignee_id uuid,
  assignee_name text,
  project_id uuid,
  project_name text,
  status_id uuid,
  status_name text,
  status_is_final boolean,
  total bigint
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'not allowed';
  end if;

  return query
  select
    assignee_link.assignee_id as assignee_id,
    a.name as assignee_name,
    p.id as project_id,
    p.name as project_name,
    s.id as status_id,
    s.name as status_name,
    s.is_final as status_is_final,
    count(t.id)::bigint as total
  from public.tasks t
  join public.statuses s on s.id = t.status_id
  left join public.projects p on p.id = t.project_id
  left join lateral (
    select unnest(
      case
        when t.assignee_ids is not null and array_length(t.assignee_ids, 1) > 0 then t.assignee_ids
        when t.assignee_id is not null then array[t.assignee_id]
        else array[null::uuid]
      end
    ) as assignee_id
  ) assignee_link on true
  left join public.assignees a on a.id = assignee_link.assignee_id
  where t.workspace_id = p_workspace_id
    and t.start_date <= p_end_date
    and t.end_date >= p_start_date
  group by assignee_link.assignee_id, a.name, p.id, p.name, s.id, s.name, s.is_final;
end;
$$;

grant execute on function public.dashboard_task_counts(uuid, date, date) to authenticated;
