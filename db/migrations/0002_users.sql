-- Migration 0002 — User profiles and roles
-- Depends on: 0001_init
-- Idempotent: yes

-- ============================================================
-- user_role enum
-- ============================================================
do $$ begin
  create type user_role as enum (
    'operator',
    'service_engineer',
    'project_manager',
    'company_admin',
    'tier2_engineer',
    'platform_admin'
  );
exception
  when duplicate_object then null;
end $$;

-- ============================================================
-- profiles
-- ============================================================
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  company_id  uuid references companies(id) on delete restrict,
  full_name   text not null,
  role        user_role not null,
  language    text not null default 'ru',
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create index if not exists profiles_company_idx on profiles (company_id);

-- ============================================================
-- Trigger: create empty profile on auth.users insert
-- (filled during onboarding flow)
-- ============================================================
create or replace function handle_new_user() returns trigger as $$
begin
  insert into profiles (id, full_name, role, language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'operator',                                    -- default role; updated during onboarding
    coalesce(new.raw_user_meta_data->>'language', 'ru')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- Replace placeholder helper functions with real logic
-- ============================================================
create or replace function auth.user_company_id() returns uuid as $$
  select company_id from profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function auth.user_role() returns text as $$
  select role::text from profiles where id = auth.uid();
$$ language sql security definer stable;
