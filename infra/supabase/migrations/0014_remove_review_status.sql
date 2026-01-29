do $$
declare
  ws record;
  review_id uuid;
  target_id uuid;
begin
  for ws in select id from public.workspaces loop
    select id into review_id
      from public.statuses
      where workspace_id = ws.id and lower(name) = 'review'
      limit 1;

    if review_id is null then
      continue;
    end if;

    select id into target_id
      from public.statuses
      where workspace_id = ws.id and lower(name) = 'in progress'
      limit 1;

    if target_id is null then
      select id into target_id
        from public.statuses
        where workspace_id = ws.id and lower(name) = 'to do'
        limit 1;
    end if;

    if target_id is not null then
      update public.tasks
        set status_id = target_id
        where status_id = review_id;
    end if;

    delete from public.statuses where id = review_id;
  end loop;
end $$;

update public.user_workspace_templates
set statuses = coalesce((
  select jsonb_agg(item)
  from jsonb_array_elements(statuses) as item
  where lower(item->>'name') <> 'review'
), '[]'::jsonb);
