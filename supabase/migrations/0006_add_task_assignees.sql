alter table public.tasks
  add column if not exists assignee_ids uuid[] not null default '{}';

update public.tasks
set assignee_ids = array[assignee_id]
where assignee_id is not null
  and coalesce(array_length(assignee_ids, 1), 0) = 0;
