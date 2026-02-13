alter table public.task_media
  add column if not exists access_token_expires_at timestamptz,
  add column if not exists access_token_revoked_at timestamptz;

update public.task_media
set access_token_expires_at = created_at + interval '30 days'
where access_token_expires_at is null;

alter table public.task_media
  alter column access_token_expires_at set not null;

create index if not exists task_media_access_token_expires_at_idx
  on public.task_media(access_token_expires_at);
