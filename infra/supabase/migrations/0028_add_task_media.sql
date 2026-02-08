create table if not exists public.task_media (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  file_name text,
  mime_type text not null,
  byte_size integer not null check (byte_size > 0),
  content bytea not null,
  access_token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz
);

create unique index if not exists task_media_access_token_hash_key
  on public.task_media(access_token_hash);

create index if not exists task_media_owner_id_idx
  on public.task_media(owner_id);

create index if not exists task_media_workspace_id_idx
  on public.task_media(workspace_id);

drop trigger if exists task_media_set_updated_at on public.task_media;
create trigger task_media_set_updated_at
  before update on public.task_media
  for each row execute function public.set_updated_at();
