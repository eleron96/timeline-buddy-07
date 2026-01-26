do $$
begin
  insert into public.statuses (workspace_id, name, color, is_final)
  select w.id, 'Отменена', '#ef4444', true
  from public.workspaces w
  where not exists (
    select 1
    from public.statuses s
    where s.workspace_id = w.id
      and lower(s.name) in ('отменена', 'cancelled', 'canceled')
  );
end $$;

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
      (workspace_id, 'Done', '#22c55e', true),
      (workspace_id, 'Отменена', '#ef4444', true);
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
