with ranked as (
  select
    id,
    workspace_id,
    name,
    lower(name) as lname,
    row_number() over (partition by workspace_id, lower(name) order by created_at asc, id asc) as rn,
    first_value(id) over (partition by workspace_id, lower(name) order by created_at asc, id asc) as canonical_id
  from public.statuses
),
dupes as (
  select id, workspace_id, canonical_id
  from ranked
  where rn > 1
)
update public.tasks t
set status_id = d.canonical_id
from dupes d
where t.status_id = d.id;

with ranked as (
  select
    id,
    workspace_id,
    name,
    lower(name) as lname,
    row_number() over (partition by workspace_id, lower(name) order by created_at asc, id asc) as rn,
    first_value(id) over (partition by workspace_id, lower(name) order by created_at asc, id asc) as canonical_id
  from public.statuses
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
      when widget ? 'statusIds' then
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

update public.user_workspace_templates u
set statuses = (
  select jsonb_agg(item order by ordinality)
  from (
    select distinct on (lower(coalesce(item->>'name', ''))) item, ordinality
    from jsonb_array_elements(u.statuses) with ordinality as t(item, ordinality)
    where coalesce(item->>'name', '') <> ''
    order by lower(coalesce(item->>'name', '')), ordinality
  ) s
)
where statuses is not null;

with ranked as (
  select
    id,
    workspace_id,
    name,
    lower(name) as lname,
    row_number() over (partition by workspace_id, lower(name) order by created_at asc, id asc) as rn
  from public.statuses
)
delete from public.statuses s
using ranked r
where s.id = r.id
  and r.rn > 1;

create unique index if not exists statuses_workspace_name_ci_unique
  on public.statuses (workspace_id, lower(name));
