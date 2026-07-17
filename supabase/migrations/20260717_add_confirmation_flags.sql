alter table public.meal_logs
  add column if not exists is_confirmed boolean default true;

alter table public.health_logs
  add column if not exists is_confirmed boolean default true;
