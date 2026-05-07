-- Migration 0001 — Extensions, companies, machine_types, helpers
-- Run order: first
-- Idempotent: yes

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists vector;

-- ============================================================
-- companies (tenants)
-- ============================================================
create table if not exists companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  country     text not null,
  language    text not null default 'ru',
  timezone    text not null default 'UTC',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists companies_set_updated_at on companies;
create trigger companies_set_updated_at
  before update on companies
  for each row execute function set_updated_at();

-- ============================================================
-- machine_types (reference data)
-- ============================================================
create table if not exists machine_types (
  id              text primary key,
  name_ru         text not null,
  name_en         text not null,
  description     text,
  recipe_modes    text[] not null,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- Helper functions for RLS — defined in 0002_users.sql after
-- the profiles table exists. We don't create placeholders here
-- because Supabase restricts CREATE in the `auth` schema; helpers
-- live in `public` schema instead (public.user_company_id, etc).
-- ============================================================
