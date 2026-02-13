drop policy if exists "admins can delete workspace members" on public.workspace_members;
drop policy if exists "workspace owners can delete workspace members" on public.workspace_members;

create policy "workspace owners can delete workspace members" on public.workspace_members
  for delete using (
    user_id <> auth.uid()
    and exists (
      select 1
      from public.workspaces
      where id = workspace_members.workspace_id
        and owner_id = auth.uid()
    )
  );
