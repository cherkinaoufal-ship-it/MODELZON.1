-- MODELZON — Phase 17: default new accounts to English, allow the newly
-- added languages, and add public profile fields (avatar, friends).
-- Run in Supabase → SQL Editor, AFTER 001-016.

alter table public.profiles alter column lang set default 'en';
alter table public.profiles drop constraint if exists profiles_lang_check;
alter table public.profiles add constraint profiles_lang_check check (lang in ('ar', 'en', 'fr', 'es', 'ru', 'ja'));

-- Existing rows keep whatever they had — this only changes the default
-- for BRAND NEW signups going forward, exactly as requested ("يسجل
-- بلغة إنجليزية والمستخدم هو اللي يغيّرها").

alter table public.profiles add column if not exists avatar_url text;

-- Friends / "clan" — a simple mutual-follow-style list, capped per tier in
-- application code (see FRIEND_LIMIT in friends.functions.ts) rather than
-- in the database, so the limit can change without a migration.
create table if not exists public.friendships (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

alter table public.friendships enable row level security;

drop policy if exists "Users manage their own friend list" on public.friendships;
create policy "Users manage their own friend list"
  on public.friendships for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can see who added them" on public.friendships;
create policy "Users can see who added them"
  on public.friendships for select to authenticated
  using (auth.uid() = friend_id);

-- Real-life production requests — a marketplace design the owner wants
-- MODELZON (or its print partner) to actually manufacture for them, not a
-- listing for other people to buy.
create table if not exists public.production_requests (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.designs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'in_review', 'quoted', 'declined')),
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.production_requests enable row level security;

drop policy if exists "Users can request production of their own designs" on public.production_requests;
create policy "Users can request production of their own designs"
  on public.production_requests for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can view their own production requests" on public.production_requests;
create policy "Users can view their own production requests"
  on public.production_requests for select to authenticated
  using (auth.uid() = user_id);

-- Storage for user avatars.
insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', true, 5242880) -- 5MB is plenty for a profile photo
on conflict (id) do update set file_size_limit = 5242880, public = true;

drop policy if exists "Public can view avatars" on storage.objects;
create policy "Public can view avatars"
  on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can replace their own avatar" on storage.objects;
create policy "Users can replace their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
