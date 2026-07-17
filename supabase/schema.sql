create extension if not exists pgcrypto;

create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(), date date not null, meal_type text not null,
  raw_text text, food_items text, portion_text text, calories_kcal numeric, protein_g numeric,
  carbs_g numeric, fat_g numeric, sodium_mg numeric, score numeric, score_reason text,
  estimate_basis text, risk_tags text[], positive_tags text[], ai_advice text, uncertain_info text,
  note text, source text default 'manual', is_confirmed boolean default true,
  access_code text not null, created_at timestamptz default now(), updated_at timestamptz default now(),
  sync_status text
);

create table if not exists public.health_logs (
  id uuid primary key default gen_random_uuid(), date date not null, raw_text text, weight_kg numeric,
  sleep_total_minutes integer, sleep_awake_minutes integer, sleep_rem_minutes integer,
  sleep_core_minutes integer, sleep_deep_minutes integer, recovery_rating text, exercise text,
  exercise_minutes integer, avg_heart_rate integer, active_calories_kcal numeric, symptoms text,
  mood text, ai_advice text, uncertain_info text, note text, source text default 'manual',
  is_confirmed boolean default true, access_code text not null, created_at timestamptz default now(), updated_at timestamptz default now(),
  sync_status text
);

create table if not exists public.profile_settings (
  id uuid primary key default gen_random_uuid(), access_code text not null unique,
  target_weight_kg numeric, long_term_target_weight_kg numeric, calorie_target_min numeric,
  calorie_target_max numeric, protein_target_min numeric, protein_target_max numeric,
  preference_brief text, safety_brief text, updated_at timestamptz default now()
);

alter table public.meal_logs enable row level security;
alter table public.health_logs enable row level security;
alter table public.profile_settings enable row level security;

-- Supabase's browser publishable key uses the anon role. Table privileges are
-- required in addition to the RLS policies below; the policies still isolate
-- every request by its x-health-access-code header.
grant usage on schema public to anon;
grant select, insert, update, delete on public.meal_logs to anon;
grant select, insert, update, delete on public.health_logs to anon;
grant select, insert, update, delete on public.profile_settings to anon;

-- 试水版通过每个请求的 x-health-access-code 请求头与行内 access_code 比对。
-- 在 Supabase Dashboard 的 SQL Editor 中执行本文件；客户端请求必须同时按 access_code 过滤。
create policy "meal_access_code_select" on public.meal_logs for select to anon
  using (access_code = coalesce(current_setting('request.headers', true)::json->>'x-health-access-code', ''));
create policy "meal_access_code_insert" on public.meal_logs for insert to anon
  with check (access_code = coalesce(current_setting('request.headers', true)::json->>'x-health-access-code', ''));
create policy "meal_access_code_update" on public.meal_logs for update to anon
  using (access_code = coalesce(current_setting('request.headers', true)::json->>'x-health-access-code', ''))
  with check (access_code = coalesce(current_setting('request.headers', true)::json->>'x-health-access-code', ''));
create policy "meal_access_code_delete" on public.meal_logs for delete to anon
  using (access_code = coalesce(current_setting('request.headers', true)::json->>'x-health-access-code', ''));

create policy "health_access_code_select" on public.health_logs for select to anon
  using (access_code = coalesce(current_setting('request.headers', true)::json->>'x-health-access-code', ''));
create policy "health_access_code_insert" on public.health_logs for insert to anon
  with check (access_code = coalesce(current_setting('request.headers', true)::json->>'x-health-access-code', ''));
create policy "health_access_code_update" on public.health_logs for update to anon
  using (access_code = coalesce(current_setting('request.headers', true)::json->>'x-health-access-code', ''))
  with check (access_code = coalesce(current_setting('request.headers', true)::json->>'x-health-access-code', ''));
create policy "health_access_code_delete" on public.health_logs for delete to anon
  using (access_code = coalesce(current_setting('request.headers', true)::json->>'x-health-access-code', ''));

create policy "profile_access_code_all" on public.profile_settings for all to anon
  using (access_code = coalesce(current_setting('request.headers', true)::json->>'x-health-access-code', ''))
  with check (access_code = coalesce(current_setting('request.headers', true)::json->>'x-health-access-code', ''));

create index if not exists meal_logs_access_date_idx on public.meal_logs(access_code, date desc);
create index if not exists health_logs_access_date_idx on public.health_logs(access_code, date desc);
