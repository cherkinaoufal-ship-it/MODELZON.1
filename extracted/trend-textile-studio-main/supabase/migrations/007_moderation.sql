-- MODELZON — Phase 7: content moderation & reporting.
-- This is a 🔴 critical launch blocker: Google Play requires a working
-- report/block/remove pipeline for any app with user-generated content
-- (designs, arena entries, arena topics all qualify here).
-- Run in Supabase → SQL Editor, AFTER 001-006.

-- 1) Admins. A tiny, explicit allowlist — nobody can set this on themselves
-- (protected the same way subscription_tier is protected in 006).
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists is_banned boolean not null default false;
alter table public.profiles add column if not exists banned_reason text;

create or replace function public.protect_moderation_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if new.is_admin is distinct from old.is_admin
      or new.is_banned is distinct from old.is_banned
      or new.banned_reason is distinct from old.banned_reason then
      raise exception 'moderation fields can only be changed by the server';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_moderation on public.profiles;
create trigger profiles_protect_moderation
  before update on public.profiles
  for each row execute procedure public.protect_moderation_columns();

-- 2) Hide flags on every table that holds user-generated content. Hidden
-- rows stay in the DB (needed for appeals/audits) but disappear from every
-- public read — enforced in RLS below, not just by filtering in the UI.
alter table public.designs add column if not exists is_hidden boolean not null default false;
alter table public.arena_topics add column if not exists is_hidden boolean not null default false;
alter table public.arena_entries add column if not exists is_hidden boolean not null default false;

drop policy if exists "Anyone can view designs listed for sale" on public.designs;
create policy "Anyone can view designs listed for sale"
  on public.designs for select
  to authenticated
  using (for_sale = true and is_hidden = false);

drop policy if exists "Topics are viewable by authenticated users" on public.arena_topics;
create policy "Topics are viewable by authenticated users"
  on public.arena_topics for select to authenticated using (is_hidden = false);

drop policy if exists "Entries are viewable by authenticated users" on public.arena_entries;
create policy "Entries are viewable by authenticated users"
  on public.arena_entries for select to authenticated using (is_hidden = false);

-- Admins can always see everything, hidden or not (needed for the review queue).
drop policy if exists "Admins can view all designs" on public.designs;
create policy "Admins can view all designs"
  on public.designs for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "Admins can view all topics" on public.arena_topics;
create policy "Admins can view all topics"
  on public.arena_topics for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "Admins can view all entries" on public.arena_entries;
create policy "Admins can view all entries"
  on public.arena_entries for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- 3) Reports — any signed-in user can report any piece of content or another
-- user. target_type discriminates what target_id points at (checked in app
-- code + server fn, since Postgres has no polymorphic FK).
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('design', 'arena_topic', 'arena_entry', 'user')),
  target_id uuid not null,
  reason text not null check (reason in ('sexual_content', 'hate_or_harassment', 'violence', 'spam', 'ip_violation', 'other')),
  details text not null default '',
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

drop policy if exists "Users can file reports" on public.reports;
create policy "Users can file reports"
  on public.reports for insert to authenticated
  with check (auth.uid() = reporter_id);

drop policy if exists "Users can view their own reports" on public.reports;
create policy "Users can view their own reports"
  on public.reports for select to authenticated
  using (auth.uid() = reporter_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Only admins (via service-role server fn) update report status — no client
-- update policy is defined on purpose, same trusted-server pattern as orders.

create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_target_idx on public.reports (target_type, target_id);

-- 4) Blocks — lets a user stop seeing another user's content client-side.
-- Simple, symmetric-enough for a v1: filtering by blocked_id happens in
-- application queries (arena feed, marketplace, shorts feed).
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

drop policy if exists "Users manage their own blocks" on public.user_blocks;
create policy "Users manage their own blocks"
  on public.user_blocks for all to authenticated
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);
