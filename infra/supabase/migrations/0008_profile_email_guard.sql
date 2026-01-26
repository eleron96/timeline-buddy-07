create or replace function public.handle_user_email_update()
returns trigger as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id;
  return new;
end;
$$ language plpgsql security definer set search_path = public, auth set row_security = off;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_update();

create or replace function public.prevent_profile_email_update()
returns trigger as $$
begin
  if new.email is distinct from old.email then
    if auth.role() is distinct from 'service_role'
      and current_user not in ('postgres', 'supabase_admin') then
      raise exception 'profile email cannot be changed';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, auth;

drop trigger if exists profiles_prevent_email_update on public.profiles;
create trigger profiles_prevent_email_update
  before update on public.profiles
  for each row execute function public.prevent_profile_email_update();
