create extension if not exists "pgcrypto";

create type public.workspace_role as enum ('viewer', 'editor', 'admin');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer set search_path = public, auth set row_security = off;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.workspace_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create or replace function public.enforce_workspace_limit()
returns trigger as $$
begin
  if (
    (select count(*) from public.workspace_members where user_id = new.user_id) >= 5
    and not exists (
      select 1 from public.workspace_members
      where workspace_id = new.workspace_id and user_id = new.user_id
    )
  ) then
    raise exception 'workspace limit reached for user';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger workspace_members_limit
  before insert on public.workspace_members
  for each row execute function public.enforce_workspace_limit();

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create table public.assignees (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index assignees_workspace_user_id_key on public.assignees (workspace_id, user_id);

create or replace function public.sync_member_assignee()
returns trigger as $$
declare
  profile_email text;
  profile_name text;
begin
  select email, display_name
    into profile_email, profile_name
  from public.profiles
  where id = new.user_id;

  insert into public.assignees (workspace_id, user_id, name)
  values (new.workspace_id, new.user_id, coalesce(profile_name, profile_email, 'Member'))
  on conflict (workspace_id, user_id)
  do update set name = excluded.name;

  return new;
end;
$$ language plpgsql security definer set search_path = public set row_security = off;

create trigger workspace_members_sync_assignees
  after insert on public.workspace_members
  for each row execute function public.sync_member_assignee();

create or replace function public.remove_member_assignee()
returns trigger as $$
begin
  delete from public.assignees
  where workspace_id = old.workspace_id and user_id = old.user_id;

  return old;
end;
$$ language plpgsql security definer set search_path = public set row_security = off;

create trigger workspace_members_remove_assignees
  after delete on public.workspace_members
  for each row execute function public.remove_member_assignee();

create or replace function public.sync_assignee_profile()
returns trigger as $$
begin
  update public.assignees
  set name = coalesce(new.display_name, new.email, 'Member')
  where user_id = new.id;

  return new;
end;
$$ language plpgsql security definer set search_path = public set row_security = off;

create trigger profiles_sync_assignees
  after update of display_name, email on public.profiles
  for each row execute function public.sync_assignee_profile();

create table public.statuses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  color text not null,
  is_final boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.task_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  icon text,
  created_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  project_id uuid references public.projects(id) on delete set null,
  assignee_id uuid references public.assignees(id) on delete set null,
  start_date date not null,
  end_date date not null,
  status_id uuid not null references public.statuses(id),
  type_id uuid not null references public.task_types(id),
  tag_ids uuid[] not null default '{}',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create table public.user_workspace_templates (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  statuses jsonb not null default '[]'::jsonb,
  task_types jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_workspace_templates_set_updated_at
  before update on public.user_workspace_templates
  for each row execute function public.set_updated_at();

create or replace function public.is_workspace_member(workspace_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = $1 and user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public set row_security = off;

create or replace function public.is_workspace_editor(workspace_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = $1 and user_id = auth.uid()
      and role in ('editor', 'admin')
  );
$$ language sql stable security definer set search_path = public set row_security = off;

create or replace function public.is_workspace_admin(workspace_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = $1 and user_id = auth.uid()
      and role = 'admin'
  );
$$ language sql stable security definer set search_path = public set row_security = off;

alter table public.profiles enable row level security;
create policy "profiles visible to workspace members" on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.workspace_members wm_self
      join public.workspace_members wm_other
        on wm_self.workspace_id = wm_other.workspace_id
      where wm_self.user_id = auth.uid()
        and wm_other.user_id = public.profiles.id
    )
  );
create policy "profile owner can update" on public.profiles
  for update using (id = auth.uid());

alter table public.workspaces enable row level security;
create policy "workspace members can read" on public.workspaces
  for select using (public.is_workspace_member(id));
create policy "workspace admins can update" on public.workspaces
  for update using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));
create policy "workspace admins can delete" on public.workspaces
  for delete using (public.is_workspace_admin(id));

alter table public.workspace_members enable row level security;
create policy "members can read workspace members" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));
create policy "admins can manage workspace members" on public.workspace_members
  for insert with check (public.is_workspace_admin(workspace_id));
create policy "admins can update workspace members" on public.workspace_members
  for update using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
create policy "admins can delete workspace members" on public.workspace_members
  for delete using (public.is_workspace_admin(workspace_id) and user_id <> auth.uid());

alter table public.projects enable row level security;
create policy "workspace members can read projects" on public.projects
  for select using (public.is_workspace_member(workspace_id));
create policy "workspace editors can write projects" on public.projects
  for insert with check (public.is_workspace_editor(workspace_id));
create policy "workspace editors can update projects" on public.projects
  for update using (public.is_workspace_editor(workspace_id)) with check (public.is_workspace_editor(workspace_id));
create policy "workspace editors can delete projects" on public.projects
  for delete using (public.is_workspace_editor(workspace_id));

alter table public.assignees enable row level security;
create policy "workspace members can read assignees" on public.assignees
  for select using (public.is_workspace_member(workspace_id));
create policy "workspace editors can write assignees" on public.assignees
  for insert with check (public.is_workspace_editor(workspace_id));
create policy "workspace editors can update assignees" on public.assignees
  for update using (public.is_workspace_editor(workspace_id)) with check (public.is_workspace_editor(workspace_id));
create policy "workspace editors can delete assignees" on public.assignees
  for delete using (public.is_workspace_editor(workspace_id));

alter table public.statuses enable row level security;
create policy "workspace members can read statuses" on public.statuses
  for select using (public.is_workspace_member(workspace_id));
create policy "workspace editors can write statuses" on public.statuses
  for insert with check (public.is_workspace_editor(workspace_id));
create policy "workspace editors can update statuses" on public.statuses
  for update using (public.is_workspace_editor(workspace_id)) with check (public.is_workspace_editor(workspace_id));
create policy "workspace editors can delete statuses" on public.statuses
  for delete using (public.is_workspace_editor(workspace_id));

alter table public.task_types enable row level security;
create policy "workspace members can read task types" on public.task_types
  for select using (public.is_workspace_member(workspace_id));
create policy "workspace editors can write task types" on public.task_types
  for insert with check (public.is_workspace_editor(workspace_id));
create policy "workspace editors can update task types" on public.task_types
  for update using (public.is_workspace_editor(workspace_id)) with check (public.is_workspace_editor(workspace_id));
create policy "workspace editors can delete task types" on public.task_types
  for delete using (public.is_workspace_editor(workspace_id));

alter table public.tags enable row level security;
create policy "workspace members can read tags" on public.tags
  for select using (public.is_workspace_member(workspace_id));
create policy "workspace editors can write tags" on public.tags
  for insert with check (public.is_workspace_editor(workspace_id));
create policy "workspace editors can update tags" on public.tags
  for update using (public.is_workspace_editor(workspace_id)) with check (public.is_workspace_editor(workspace_id));
create policy "workspace editors can delete tags" on public.tags
  for delete using (public.is_workspace_editor(workspace_id));

alter table public.tasks enable row level security;
create policy "workspace members can read tasks" on public.tasks
  for select using (public.is_workspace_member(workspace_id));
create policy "workspace editors can write tasks" on public.tasks
  for insert with check (public.is_workspace_editor(workspace_id));
create policy "workspace editors can update tasks" on public.tasks
  for update using (public.is_workspace_editor(workspace_id)) with check (public.is_workspace_editor(workspace_id));
create policy "workspace editors can delete tasks" on public.tasks
  for delete using (public.is_workspace_editor(workspace_id));

alter table public.user_workspace_templates enable row level security;
create policy "template owner can manage workspace template" on public.user_workspace_templates
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.seed_workspace(workspace_id uuid)
returns void as $$
declare
  template_statuses jsonb;
  template_task_types jsonb;
  template_tags jsonb;
begin
  select statuses, task_types, tags
    into template_statuses, template_task_types, template_tags
  from public.user_workspace_templates
  where user_id = auth.uid();

  if coalesce(jsonb_array_length(template_statuses), 0) > 0 then
    insert into public.statuses (workspace_id, name, color, is_final)
    select workspace_id,
      trim(name),
      coalesce(color, '#94a3b8'),
      coalesce(is_final, false)
    from jsonb_to_recordset(template_statuses)
      as status_item(name text, color text, is_final boolean)
    where name is not null and length(trim(name)) > 0;
  else
    insert into public.statuses (workspace_id, name, color, is_final)
    values
      (workspace_id, 'To Do', '#94a3b8', false),
      (workspace_id, 'In Progress', '#3b82f6', false),
      (workspace_id, 'Review', '#f59e0b', false),
      (workspace_id, 'Done', '#22c55e', true);
  end if;

  if coalesce(jsonb_array_length(template_task_types), 0) > 0 then
    insert into public.task_types (workspace_id, name, icon)
    select workspace_id,
      trim(name),
      icon
    from jsonb_to_recordset(template_task_types)
      as type_item(name text, icon text)
    where name is not null and length(trim(name)) > 0;
  else
    insert into public.task_types (workspace_id, name, icon)
    values
      (workspace_id, 'Feature', 'Sparkles'),
      (workspace_id, 'Bug', 'Bug'),
      (workspace_id, 'Task', 'CheckSquare'),
      (workspace_id, 'Meeting', 'Users');
  end if;

  if coalesce(jsonb_array_length(template_tags), 0) > 0 then
    insert into public.tags (workspace_id, name, color)
    select workspace_id,
      trim(name),
      coalesce(color, '#94a3b8')
    from jsonb_to_recordset(template_tags)
      as tag_item(name text, color text)
    where name is not null and length(trim(name)) > 0;
  else
    insert into public.tags (workspace_id, name, color)
    values
      (workspace_id, 'Urgent', '#ef4444'),
      (workspace_id, 'Backend', '#8b5cf6'),
      (workspace_id, 'Frontend', '#3b82f6'),
      (workspace_id, 'Design', '#ec4899');
  end if;

  insert into public.projects (workspace_id, name, color)
  values
    (workspace_id, 'Website Redesign', '#3b82f6'),
    (workspace_id, 'Mobile App', '#22c55e'),
    (workspace_id, 'Marketing Campaign', '#f59e0b'),
    (workspace_id, 'Backend API', '#8b5cf6');

end;
$$ language plpgsql security definer set search_path = public set row_security = off;

create or replace function public.create_workspace(workspace_name text)
returns uuid as $$
declare
  new_id uuid;
begin
  if (select count(*) from public.workspace_members where user_id = auth.uid()) >= 5 then
    raise exception 'workspace limit reached for user';
  end if;

  insert into public.workspaces (name, owner_id)
  values (workspace_name, auth.uid())
  returning id into new_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_id, auth.uid(), 'admin');

  perform public.seed_workspace(new_id);

  return new_id;
end;
$$ language plpgsql security definer set search_path = public set row_security = off;

grant execute on function public.create_workspace(text) to authenticated;

create or replace function public.delete_workspace(workspace_id uuid)
returns void as $$
begin
  if not public.is_workspace_admin(workspace_id) then
    raise exception 'only admins can delete workspace';
  end if;

  delete from public.workspaces
  where id = workspace_id;
end;
$$ language plpgsql security definer set search_path = public set row_security = off;

grant execute on function public.delete_workspace(uuid) to authenticated;
