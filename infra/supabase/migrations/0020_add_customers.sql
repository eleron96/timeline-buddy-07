create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists customers_workspace_name_ci_unique
  on public.customers (workspace_id, lower(name));

create index if not exists customers_workspace_id_idx
  on public.customers (workspace_id);

alter table public.customers enable row level security;

drop policy if exists "workspace members can read customers" on public.customers;
drop policy if exists "workspace editors can write customers" on public.customers;
drop policy if exists "workspace editors can update customers" on public.customers;
drop policy if exists "workspace editors can delete customers" on public.customers;

create policy "workspace members can read customers" on public.customers
  for select using (public.is_workspace_member(workspace_id));

create policy "workspace editors can write customers" on public.customers
  for insert with check (public.is_workspace_editor(workspace_id));

create policy "workspace editors can update customers" on public.customers
  for update using (public.is_workspace_editor(workspace_id));

create policy "workspace editors can delete customers" on public.customers
  for delete using (public.is_workspace_editor(workspace_id));

alter table public.projects
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

create index if not exists projects_workspace_customer_id_idx
  on public.projects (workspace_id, customer_id);
