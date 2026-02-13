create or replace function public.assignee_unique_task_counts(
  p_workspace_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  assignee_id uuid,
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
  with scoped_tasks as (
    select
      t.id,
      t.repeat_id,
      case
        when t.assignee_ids is not null and array_length(t.assignee_ids, 1) > 0 then t.assignee_ids
        when t.assignee_id is not null then array[t.assignee_id]
        else array[]::uuid[]
      end as assignee_ids
    from public.tasks t
    where t.workspace_id = p_workspace_id
      and t.end_date >= p_start_date
      and t.start_date <= p_end_date
  ),
  task_units as (
    select
      unnest(st.assignee_ids) as assignee_id,
      coalesce(st.repeat_id::text, 't:' || st.id::text) as unit_key
    from scoped_tasks st
  )
  select
    tu.assignee_id,
    count(distinct tu.unit_key)::bigint as total
  from task_units tu
  group by tu.assignee_id;
end;
$$;

grant execute on function public.assignee_unique_task_counts(uuid, date, date) to authenticated;
