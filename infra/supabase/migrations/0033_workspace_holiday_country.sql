alter table public.workspaces
  add column if not exists holiday_country text;

update public.workspaces
set holiday_country = case
  when upper(btrim(coalesce(holiday_country, ''))) ~ '^[A-Z]{2}$'
    then upper(btrim(holiday_country))
  else 'RU'
end;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspaces_holiday_country_format_check'
      and conrelid = 'public.workspaces'::regclass
  ) then
    alter table public.workspaces
      add constraint workspaces_holiday_country_format_check
      check (holiday_country ~ '^[A-Z]{2}$');
  end if;
end;
$$;

alter table public.workspaces
  alter column holiday_country set default 'RU';

alter table public.workspaces
  alter column holiday_country set not null;
