create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  email_normalized text not null,
  role public.workspace_role not null default 'viewer',
  group_id uuid references public.member_groups(id) on delete set null,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  constraint workspace_invites_token_unique unique (token),
  constraint workspace_invites_email_normalized_check check (email_normalized = lower(trim(email)))
);

create index if not exists workspace_invites_workspace_idx
  on public.workspace_invites (workspace_id);

create index if not exists workspace_invites_email_normalized_idx
  on public.workspace_invites (email_normalized);

create unique index if not exists workspace_invites_active_unique
  on public.workspace_invites (workspace_id, email_normalized)
  where accepted_at is null and revoked_at is null;

drop trigger if exists workspace_invites_set_updated_at on public.workspace_invites;
create trigger workspace_invites_set_updated_at
  before update on public.workspace_invites
  for each row execute function public.set_updated_at();

alter table public.workspace_invites enable row level security;

drop policy if exists "members can read workspace invites" on public.workspace_invites;
create policy "members can read workspace invites" on public.workspace_invites
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists "admins can manage workspace invites" on public.workspace_invites;
create policy "admins can manage workspace invites" on public.workspace_invites
  for all using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));
