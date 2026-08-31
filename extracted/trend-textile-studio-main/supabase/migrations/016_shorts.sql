-- MODELZON — Phase 16: real video uploads for the Shorts/Reels tab.
-- Previously ShortsFeed.tsx was 100% hardcoded mock data (spinning 3D
-- placeholder shapes, fake authors/likes) — there was no upload feature at
-- all. This adds a real Storage bucket + a `shorts` table so people can
-- actually upload a video of their design/process and have it show up for
-- everyone.
-- Run in Supabase → SQL Editor, AFTER 001-015.

insert into storage.buckets (id, name, public, file_size_limit)
values ('shorts-videos', 'shorts-videos', true, 524288000) -- 500MB per file
on conflict (id) do update set file_size_limit = 524288000, public = true;

-- ⚠️ 500MB is the bucket's OWN allowed max — your actual Supabase plan may
-- cap request/file size lower than this (check Project Settings → Storage
-- on your plan). This bucket setting removes MODELZON's own artificial
-- limit; it can't override Supabase's platform-level ceiling for your plan.

drop policy if exists "Public can view short videos" on storage.objects;
create policy "Public can view short videos"
  on storage.objects for select
  using (bucket_id = 'shorts-videos');

drop policy if exists "Users can upload their own short videos" on storage.objects;
create policy "Users can upload their own short videos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'shorts-videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own short videos" on storage.objects;
create policy "Users can delete their own short videos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'shorts-videos' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.shorts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  username text not null,
  video_url text not null,
  caption text not null default '',
  garment text,
  likes_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.shorts enable row level security;

drop policy if exists "Anyone can view shorts" on public.shorts;
create policy "Anyone can view shorts"
  on public.shorts for select to authenticated using (true);

drop policy if exists "Users can post their own shorts" on public.shorts;
create policy "Users can post their own shorts"
  on public.shorts for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own shorts" on public.shorts;
create policy "Users can delete their own shorts"
  on public.shorts for delete to authenticated
  using (auth.uid() = user_id);

create table if not exists public.short_likes (
  short_id uuid not null references public.shorts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (short_id, user_id)
);

alter table public.short_likes enable row level security;

drop policy if exists "Users manage their own likes" on public.short_likes;
create policy "Users manage their own likes"
  on public.short_likes for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep shorts.likes_count in sync automatically instead of trusting the
-- client to increment/decrement it.
create or replace function public.sync_short_likes_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.shorts set likes_count = likes_count + 1 where id = new.short_id;
  elsif TG_OP = 'DELETE' then
    update public.shorts set likes_count = greatest(0, likes_count - 1) where id = old.short_id;
  end if;
  return null;
end;
$$;

drop trigger if exists short_likes_sync on public.short_likes;
create trigger short_likes_sync
  after insert or delete on public.short_likes
  for each row execute procedure public.sync_short_likes_count();

create index if not exists shorts_created_idx on public.shorts (created_at desc);
alter publication supabase_realtime add table public.shorts;
