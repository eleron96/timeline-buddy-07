create or replace function public.link_keycloak_identity(
  target_user_id uuid,
  keycloak_user_id text,
  identity_email text,
  identity_name text default null,
  identity_issuer text default null
)
returns void as $$
declare
  normalized_email text;
  existing_user_id uuid;
  normalized_display_name text;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  if keycloak_user_id is null or length(trim(keycloak_user_id)) = 0 then
    raise exception 'keycloak_user_id is required';
  end if;

  normalized_email := lower(trim(coalesce(identity_email, '')));
  if length(normalized_email) = 0 then
    raise exception 'identity_email is required';
  end if;

  normalized_display_name := nullif(trim(coalesce(identity_name, '')), '');

  select user_id
    into existing_user_id
  from auth.identities
  where provider = 'keycloak'
    and provider_id = keycloak_user_id
  limit 1;

  if existing_user_id is not null and existing_user_id <> target_user_id then
    raise exception 'keycloak identity % is already linked to user %', keycloak_user_id, existing_user_id;
  end if;

  delete from auth.identities
  where provider = 'keycloak'
    and user_id = target_user_id
    and provider_id <> keycloak_user_id;

  insert into auth.identities (
    provider,
    provider_id,
    user_id,
    identity_data,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    'keycloak',
    keycloak_user_id,
    target_user_id,
    jsonb_build_object(
      'iss', coalesce(identity_issuer, 'keycloak'),
      'sub', keycloak_user_id,
      'provider_id', keycloak_user_id,
      'email', normalized_email,
      'email_verified', true,
      'name', coalesce(normalized_display_name, normalized_email),
      'full_name', coalesce(normalized_display_name, normalized_email)
    ),
    now(),
    now(),
    now()
  )
  on conflict (provider_id, provider)
  do update
    set user_id = excluded.user_id,
        identity_data = excluded.identity_data,
        updated_at = now();

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('provider', 'keycloak')
    || jsonb_build_object('providers', '["email","keycloak"]'::jsonb)
  where id = target_user_id;

  update public.profiles
  set email = normalized_email
  where id = target_user_id;

  if normalized_display_name is not null then
    update public.profiles
    set display_name = normalized_display_name
    where id = target_user_id;
  end if;
end;
$$ language plpgsql security definer set search_path = public, auth set row_security = off;

create or replace function public.get_keycloak_identity(target_user_id uuid)
returns text as $$
  select provider_id
  from auth.identities
  where provider = 'keycloak'
    and user_id = target_user_id
  order by updated_at desc nulls last
  limit 1;
$$ language sql stable security definer set search_path = public, auth set row_security = off;

grant execute on function public.link_keycloak_identity(uuid, text, text, text, text) to service_role;
grant execute on function public.get_keycloak_identity(uuid) to service_role;
