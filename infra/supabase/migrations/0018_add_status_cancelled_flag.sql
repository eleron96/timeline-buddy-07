alter table public.statuses
  add column if not exists is_cancelled boolean not null default false;

update public.statuses
set is_cancelled = true,
    is_final = false
where lower(name) in ('отмена', 'отменена', 'отменён', 'отменен', 'cancelled', 'canceled')
   or emoji = '🚫';

update public.user_workspace_templates
set statuses = coalesce((
  select jsonb_agg(
    jsonb_set(
      jsonb_set(
        item,
        '{is_cancelled}',
        to_jsonb(cancelled),
        true
      ),
      '{is_final}',
      to_jsonb(coalesce((item->>'is_final')::boolean, false) and not cancelled),
      true
    )
  )
  from (
    select
      item,
      case
        when item ? 'is_cancelled' then coalesce((item->>'is_cancelled')::boolean, false)
        when lower(item->>'name') in ('отмена', 'отменена', 'отменён', 'отменен', 'cancelled', 'canceled') then true
        when item->>'emoji' = '🚫' then true
        else false
      end as cancelled
    from jsonb_array_elements(statuses) as item
  ) s
), '[]'::jsonb)
where statuses is not null;

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
    insert into public.statuses (workspace_id, name, emoji, color, is_final, is_cancelled)
    select workspace_id,
      trim(name),
      nullif(emoji, ''),
      coalesce(color, '#94a3b8'),
      coalesce(is_final, false) and not coalesce(is_cancelled, false),
      coalesce(is_cancelled, false)
    from jsonb_to_recordset(template_statuses)
      as status_item(name text, emoji text, color text, is_final boolean, is_cancelled boolean)
    where name is not null and length(trim(name)) > 0;
  else
    insert into public.statuses (workspace_id, name, emoji, color, is_final, is_cancelled)
    values
      (workspace_id, 'To Do', '📝', '#94a3b8', false, false),
      (workspace_id, 'In Progress', '🚧', '#3b82f6', false, false),
      (workspace_id, 'Done', '✅', '#22c55e', true, false),
      (workspace_id, 'Отменена', '🚫', '#ef4444', false, true);
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
