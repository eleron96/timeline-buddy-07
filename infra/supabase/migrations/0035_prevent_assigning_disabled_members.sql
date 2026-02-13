create or replace function public.validate_task_assignees()
returns trigger as $$
declare
  normalized_ids uuid[] := coalesce(new.assignee_ids, '{}'::uuid[]);
  previous_ids uuid[] := '{}'::uuid[];
  invalid_count integer := 0;
begin
  if new.assignee_id is not null and not (new.assignee_id = any(normalized_ids)) then
    normalized_ids := array_prepend(new.assignee_id, normalized_ids);
  end if;

  select coalesce(array_agg(dedup.id order by dedup.first_ord), '{}'::uuid[])
  into normalized_ids
  from (
    select item.id, min(item.ord) as first_ord
    from unnest(normalized_ids) with ordinality as item(id, ord)
    where item.id is not null
    group by item.id
  ) dedup;

  new.assignee_ids := normalized_ids;
  new.assignee_id := normalized_ids[1];

  if tg_op = 'UPDATE' and new.workspace_id = old.workspace_id then
    previous_ids := coalesce(old.assignee_ids, '{}'::uuid[]);
    if old.assignee_id is not null and not (old.assignee_id = any(previous_ids)) then
      previous_ids := array_prepend(old.assignee_id, previous_ids);
    end if;
  end if;

  select count(*)
  into invalid_count
  from unnest(normalized_ids) as current_id
  left join public.assignees assignee
    on assignee.id = current_id
   and assignee.workspace_id = new.workspace_id
  where not (current_id = any(previous_ids))
    and (assignee.id is null or assignee.is_active is not true);

  if invalid_count > 0 then
    raise exception 'Cannot assign removed or disabled member to task.'
      using errcode = '23514';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public set row_security = off;

drop trigger if exists tasks_validate_assignees on public.tasks;
create trigger tasks_validate_assignees
  before insert or update on public.tasks
  for each row execute function public.validate_task_assignees();
