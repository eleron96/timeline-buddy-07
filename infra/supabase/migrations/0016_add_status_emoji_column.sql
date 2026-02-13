alter table public.statuses
  add column if not exists emoji text;

update public.statuses
set
  emoji = case
    when name ~ '^📝' then '📝'
    when name ~ '^🚧' then '🚧'
    when name ~ '^✅' then '✅'
    when name ~ '^🚫' then '🚫'
    else emoji
  end
where name ~ '^📝'
  or name ~ '^🚧'
  or name ~ '^✅'
  or name ~ '^🚫';

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'statuses_workspace_name_ci_unique'
  ) then
    update public.statuses
    set name = btrim(case
      when name ~ '^📝' then regexp_replace(name, '^📝️?\\s*', '')
      when name ~ '^🚧' then regexp_replace(name, '^🚧️?\\s*', '')
      when name ~ '^✅' then regexp_replace(name, '^✅️?\\s*', '')
      when name ~ '^🚫' then regexp_replace(name, '^🚫️?\\s*', '')
      else name
    end)
    where name ~ '^📝'
      or name ~ '^🚧'
      or name ~ '^✅'
      or name ~ '^🚫';
  end if;
end $$;

update public.user_workspace_templates
set statuses = coalesce((
  select jsonb_agg(
    jsonb_set(
      jsonb_set(
        item,
        '{name}',
        to_jsonb(btrim(case
          when (item->>'name') ~ '^📝' then regexp_replace(item->>'name', '^📝️?\\s*', '')
          when (item->>'name') ~ '^🚧' then regexp_replace(item->>'name', '^🚧️?\\s*', '')
          when (item->>'name') ~ '^✅' then regexp_replace(item->>'name', '^✅️?\\s*', '')
          when (item->>'name') ~ '^🚫' then regexp_replace(item->>'name', '^🚫️?\\s*', '')
          else item->>'name'
        end)),
        true
      ),
      '{emoji}',
      to_jsonb(case
        when jsonb_exists(item, 'emoji') then nullif(item->>'emoji', '')
        when (item->>'name') ~ '^📝' then '📝'
        when (item->>'name') ~ '^🚧' then '🚧'
        when (item->>'name') ~ '^✅' then '✅'
        when (item->>'name') ~ '^🚫' then '🚫'
        else null
      end),
      true
    )
  )
  from jsonb_array_elements(statuses) as item
), '[]'::jsonb)
where statuses is not null;
