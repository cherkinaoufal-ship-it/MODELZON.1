-- MODELZON — Phase 2: real saved designs + duplicate protection
-- Run this once in Supabase → SQL Editor → New query → paste all → Run.
-- (Run AFTER 001_profiles.sql — this table references auth.users too.)

create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  garment text not null,
  size text not null,
  color text not null,
  decal_url text,
  decal_transform jsonb,
  title text not null default '',
  -- Fingerprint = a hash of (garment + size + color + decal image + decal
  -- position/scale/rotation). Two designs with an identical fingerprint are
  -- considered "the same design" per the rule: same colors, same shape,
  -- same front placement. Enforced globally (not per-user) below, so once
  -- someone owns a design, nobody else — including the same user twice —
  -- can save an exact duplicate.
  fingerprint text not null unique,
  created_at timestamptz not null default now()
);

alter table public.designs enable row level security;

drop policy if exists "Designs are viewable by their owner" on public.designs;
create policy "Designs are viewable by their owner"
  on public.designs for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own designs" on public.designs;
create policy "Users can insert their own designs"
  on public.designs for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own designs" on public.designs;
create policy "Users can delete their own designs"
  on public.designs for delete
  to authenticated
  using (auth.uid() = user_id);

create index if not exists designs_user_id_idx on public.designs (user_id, created_at desc);
