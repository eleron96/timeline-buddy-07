create table if not exists public.super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.super_admins enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'super_admins'
      and policyname = 'super admins can read own row'
  ) then
    create policy "super admins can read own row" on public.super_admins
      for select using (user_id = auth.uid());
  end if;
end $$;
