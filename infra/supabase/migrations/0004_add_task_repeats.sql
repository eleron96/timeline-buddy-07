alter table public.tasks
  add column if not exists repeat_id uuid;

create index if not exists tasks_repeat_id_start_date_idx
  on public.tasks (repeat_id, start_date);
