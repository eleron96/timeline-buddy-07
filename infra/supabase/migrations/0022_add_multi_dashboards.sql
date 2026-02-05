alter table public.workspace_dashboards
  add column if not exists id uuid,
  add column if not exists name text;

update public.workspace_dashboards
set id = gen_random_uuid()
where id is null;

update public.workspace_dashboards
set name = 'Dashboard'
where name is null or btrim(name) = '';

alter table public.workspace_dashboards
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column name set default 'Dashboard',
  alter column name set not null;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'workspace_dashboards_pkey'
  ) then
    alter table public.workspace_dashboards drop constraint workspace_dashboards_pkey;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspace_dashboards_pkey'
  ) then
    alter table public.workspace_dashboards add constraint workspace_dashboards_pkey primary key (id);
  end if;
end $$;

create index if not exists workspace_dashboards_workspace_id_idx
  on public.workspace_dashboards (workspace_id);

create unique index if not exists workspace_dashboards_workspace_name_ci_unique
  on public.workspace_dashboards (workspace_id, lower(name));

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workspace_dashboards'
      and policyname = 'workspace editors can delete dashboards'
  ) then
    create policy "workspace editors can delete dashboards" on public.workspace_dashboards
      for delete using (public.is_workspace_editor(workspace_id));
  end if;
end $$;

