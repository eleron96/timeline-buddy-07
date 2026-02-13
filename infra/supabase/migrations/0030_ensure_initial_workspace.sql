create or replace function public.ensure_initial_workspace(default_workspace_name text default 'My Workspace')
returns uuid as $$
declare
  existing_workspace_id uuid;
  normalized_name text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  normalized_name := nullif(trim(coalesce(default_workspace_name, '')), '');
  if normalized_name is null then
    normalized_name := 'My Workspace';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));

  select wm.workspace_id
    into existing_workspace_id
  from public.workspace_members wm
  where wm.user_id = auth.uid()
  order by wm.created_at asc
  limit 1;

  if existing_workspace_id is not null then
    return existing_workspace_id;
  end if;

  return public.create_workspace(normalized_name);
end;
$$ language plpgsql security definer set search_path = public, auth set row_security = off;

grant execute on function public.ensure_initial_workspace(text) to authenticated;
