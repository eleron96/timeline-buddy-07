alter table public.workspace_invites
  add column if not exists revoked_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspace_invites_revoked_reason_check'
      and conrelid = 'public.workspace_invites'::regclass
  ) then
    alter table public.workspace_invites
      add constraint workspace_invites_revoked_reason_check
      check (revoked_reason is null or revoked_reason in ('declined', 'canceled', 'expired'));
  end if;
end;
$$;

update public.workspace_invites
set revoked_reason = 'expired'
where accepted_at is null
  and revoked_at is not null
  and revoked_reason is null
  and expires_at <= coalesce(revoked_at, now());

update public.workspace_invites
set revoked_reason = 'canceled'
where accepted_at is null
  and revoked_at is not null
  and revoked_reason is null;

create index if not exists workspace_invites_invited_by_created_idx
  on public.workspace_invites (invited_by, created_at desc);
