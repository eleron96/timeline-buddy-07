drop index if exists public.statuses_workspace_name_ci_unique;

with normalized as (
  select
    id,
    workspace_id,
    created_at,
    btrim(case
      when name ~ '^📝' then regexp_replace(name, '^📝️?\\s*', '')
      when name ~ '^🚧' then regexp_replace(name, '^🚧️?\\s*', '')
      when name ~ '^✅' then regexp_replace(name, '^✅️?\\s*', '')
      when name ~ '^🚫' then regexp_replace(name, '^🚫️?\\s*', '')
      else name
    end) as base_name,
    case
      when name ~ '^📝' then '📝'
      when name ~ '^🚧' then '🚧'
      when name ~ '^✅' then '✅'
      when name ~ '^🚫' then '🚫'
      else null
    end as emoji_from_name
  from public.statuses
),
ranked as (
  select
    *,
    row_number() over (partition by workspace_id, lower(base_name) order by created_at asc, id asc) as rn,
    first_value(id) over (partition by workspace_id, lower(base_name) order by created_at asc, id asc) as canonical_id
  from normalized
)
update public.tasks t
set status_id = r.canonical_id
from ranked r
where t.status_id = r.id
  and r.rn > 1;

with normalized as (
  select
    id,
    workspace_id,
    created_at,
    btrim(case
      when name ~ '^📝' then regexp_replace(name, '^📝️?\\s*', '')
      when name ~ '^🚧' then regexp_replace(name, '^🚧️?\\s*', '')
      when name ~ '^✅' then regexp_replace(name, '^✅️?\\s*', '')
      when name ~ '^🚫' then regexp_replace(name, '^🚫️?\\s*', '')
      else name
    end) as base_name
  from public.statuses
),
ranked as (
  select
    *,
    row_number() over (partition by workspace_id, lower(base_name) order by created_at asc, id asc) as rn,
    first_value(id) over (partition by workspace_id, lower(base_name) order by created_at asc, id asc) as canonical_id
  from normalized
),
dupes as (
  select id, workspace_id, canonical_id
  from ranked
  where rn > 1
)
update public.workspace_dashboards wd
set widgets = (
  select jsonb_agg(
    case
      when jsonb_exists(widget, 'statusIds') then
        jsonb_set(
          widget,
          '{statusIds}',
          (
            select jsonb_agg(distinct new_id)
            from (
              select coalesce(d.canonical_id::text, status_id_text) as new_id
              from jsonb_array_elements_text(widget->'statusIds') as status_id_text
              left join dupes d on d.id::text = status_id_text
            ) mapped
          ),
          true
        )
      else widget
    end
  )
  from jsonb_array_elements(wd.widgets) as widget
)
where exists (select 1 from dupes d where d.workspace_id = wd.workspace_id);

with normalized as (
  select
    id,
    workspace_id,
    created_at,
    case
      when name ~ '^📝' then regexp_replace(name, '^📝️?\\s*', '')
      when name ~ '^🚧' then regexp_replace(name, '^🚧️?\\s*', '')
      when name ~ '^✅' then regexp_replace(name, '^✅️?\\s*', '')
      when name ~ '^🚫' then regexp_replace(name, '^🚫️?\\s*', '')
      else name
    end as base_name
  from public.statuses
),
ranked as (
  select
    *,
    row_number() over (partition by workspace_id, lower(base_name) order by created_at asc, id asc) as rn
  from normalized
)
delete from public.statuses s
using ranked r
where s.id = r.id
  and r.rn > 1;

with normalized as (
  select
    id,
    btrim(case
      when name ~ '^📝' then regexp_replace(name, '^📝️?\\s*', '')
      when name ~ '^🚧' then regexp_replace(name, '^🚧️?\\s*', '')
      when name ~ '^✅' then regexp_replace(name, '^✅️?\\s*', '')
      when name ~ '^🚫' then regexp_replace(name, '^🚫️?\\s*', '')
      else name
    end) as base_name,
    case
      when name ~ '^📝' then '📝'
      when name ~ '^🚧' then '🚧'
      when name ~ '^✅' then '✅'
      when name ~ '^🚫' then '🚫'
      else null
    end as emoji_from_name
  from public.statuses
)
update public.statuses s
set
  name = n.base_name,
  emoji = coalesce(nullif(s.emoji, ''), n.emoji_from_name)
from normalized n
where s.id = n.id;

update public.user_workspace_templates u
set statuses = coalesce((
  select jsonb_agg(item order by ordinality)
  from (
    select distinct on (lower(stripped_name))
      jsonb_set(
        jsonb_set(item, '{name}', to_jsonb(stripped_name), true),
        '{emoji}',
        to_jsonb(coalesce(nullif(item->>'emoji', ''), emoji_from_name)),
        true
      ) as item,
      ordinality
    from (
      select item,
        ordinality,
        btrim(case
          when (item->>'name') ~ '^📝' then regexp_replace(item->>'name', '^📝️?\\s*', '')
          when (item->>'name') ~ '^🚧' then regexp_replace(item->>'name', '^🚧️?\\s*', '')
          when (item->>'name') ~ '^✅' then regexp_replace(item->>'name', '^✅️?\\s*', '')
          when (item->>'name') ~ '^🚫' then regexp_replace(item->>'name', '^🚫️?\\s*', '')
          else item->>'name'
        end) as stripped_name,
        case
          when (item->>'name') ~ '^📝' then '📝'
          when (item->>'name') ~ '^🚧' then '🚧'
          when (item->>'name') ~ '^✅' then '✅'
          when (item->>'name') ~ '^🚫' then '🚫'
          else null
        end as emoji_from_name
      from jsonb_array_elements(u.statuses) with ordinality as t(item, ordinality)
    ) s
    where stripped_name is not null and length(trim(stripped_name)) > 0
    order by lower(stripped_name), ordinality
  ) d
), '[]'::jsonb)
where statuses is not null;

create unique index if not exists statuses_workspace_name_ci_unique
  on public.statuses (workspace_id, lower(btrim(name)));
