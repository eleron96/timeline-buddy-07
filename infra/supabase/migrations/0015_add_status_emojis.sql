do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'statuses_workspace_name_ci_unique'
  ) then
    update public.statuses
    set name = case
      when lower(name) in ('to do', 'todo') then '📝 ' || name
      when lower(name) in ('in progress', 'inprogress') then '🚧 ' || name
      when lower(name) = 'done' then '✅ ' || name
      when lower(name) in ('отменена', 'отменён', 'отменен', 'cancelled', 'canceled') then '🚫 ' || name
      else name
    end
    where
      lower(name) in ('to do', 'todo', 'in progress', 'inprogress', 'done', 'отменена', 'отменён', 'отменен', 'cancelled', 'canceled')
      and name not like '📝 %'
      and name not like '🚧 %'
      and name not like '✅ %'
      and name not like '🚫 %';

    update public.user_workspace_templates
    set statuses = coalesce((
      select jsonb_agg(
        jsonb_set(
          item,
          '{name}',
          to_jsonb(case
            when lower(item->>'name') in ('to do', 'todo') then '📝 ' || (item->>'name')
            when lower(item->>'name') in ('in progress', 'inprogress') then '🚧 ' || (item->>'name')
            when lower(item->>'name') = 'done' then '✅ ' || (item->>'name')
            when lower(item->>'name') in ('отменена', 'отменён', 'отменен', 'cancelled', 'canceled') then '🚫 ' || (item->>'name')
            else (item->>'name')
          end),
          true
        )
      )
      from jsonb_array_elements(statuses) as item
    ), '[]'::jsonb)
    where exists (
      select 1
      from jsonb_array_elements(statuses) as item
      where lower(item->>'name') in ('to do', 'todo', 'in progress', 'inprogress', 'done', 'отменена', 'отменён', 'отменен', 'cancelled', 'canceled')
    );
  end if;
end $$;
