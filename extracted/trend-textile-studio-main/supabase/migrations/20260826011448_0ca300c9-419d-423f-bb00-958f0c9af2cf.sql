create table if not exists public.battle_rooms (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'waiting' check (status in ('waiting', 'countdown', 'designing', 'judging', 'finished')),
  topic text not null,
  garment text not null default 'tee',
  max_players integer not null default 4,
  countdown_ends_at timestamptz,
  designing_ends_at timestamptz,
  created_at timestamptz not null default now()
);

grant select on public.battle_rooms to authenticated;
grant all on public.battle_rooms to service_role;

alter table public.battle_rooms enable row level security;

drop policy if exists "Anyone can view battle rooms" on public.battle_rooms;
create policy "Anyone can view battle rooms"
  on public.battle_rooms for select to authenticated using (true);

create table if not exists public.battle_room_members (
  room_id uuid not null references public.battle_rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  username text not null,
  level integer not null default 1,
  joined_at timestamptz not null default now(),
  submitted boolean not null default false,
  garment text,
  color text,
  decal_url text,
  decal_transform jsonb,
  score numeric,
  placement integer,
  rank_points_delta integer,
  primary key (room_id, user_id)
);

grant select, insert, update on public.battle_room_members to authenticated;
grant all on public.battle_room_members to service_role;

alter table public.battle_room_members enable row level security;

create or replace function public.is_room_member(_room_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.battle_room_members m
    where m.room_id = _room_id and m.user_id = _user_id
  )
$$;
revoke all on function public.is_room_member(uuid, uuid) from public, anon;

drop policy if exists "Members can view their room's roster" on public.battle_room_members;
create policy "Members can view their room's roster"
  on public.battle_room_members for select to authenticated
  using (public.is_room_member(room_id, auth.uid()));

drop policy if exists "Users can join a room as themselves" on public.battle_room_members;
create policy "Users can join a room as themselves"
  on public.battle_room_members for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can submit their own entry" on public.battle_room_members;
create policy "Users can submit their own entry"
  on public.battle_room_members for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.protect_battle_judging_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    if new.score is distinct from old.score
      or new.placement is distinct from old.placement
      or new.rank_points_delta is distinct from old.rank_points_delta then
      raise exception 'score/placement/rank_points_delta can only be set by the server';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_battle_judging_columns() from public, anon, authenticated;

drop trigger if exists battle_members_protect_judging on public.battle_room_members;
create trigger battle_members_protect_judging
  before update on public.battle_room_members
  for each row execute procedure public.protect_battle_judging_columns();

create index if not exists battle_room_members_room_idx on public.battle_room_members (room_id);

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

grant select, insert, delete on public.shorts to authenticated;
grant all on public.shorts to service_role;

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

grant select, insert, update, delete on public.short_likes to authenticated;
grant all on public.short_likes to service_role;

alter table public.short_likes enable row level security;

drop policy if exists "Users manage their own likes" on public.short_likes;
create policy "Users manage their own likes"
  on public.short_likes for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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
revoke all on function public.sync_short_likes_count() from public, anon, authenticated;

drop trigger if exists short_likes_sync on public.short_likes;
create trigger short_likes_sync
  after insert or delete on public.short_likes
  for each row execute procedure public.sync_short_likes_count();

create index if not exists shorts_created_idx on public.shorts (created_at desc);

drop policy if exists "Signed-in users can view short videos" on storage.objects;
create policy "Signed-in users can view short videos"
  on storage.objects for select to authenticated
  using (bucket_id = 'shorts-videos');

drop policy if exists "Users can upload their own short videos" on storage.objects;
create policy "Users can upload their own short videos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'shorts-videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own short videos" on storage.objects;
create policy "Users can delete their own short videos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'shorts-videos' and (storage.foldername(name))[1] = auth.uid()::text);

do $$
begin
  begin
    alter publication supabase_realtime add table public.battle_rooms;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.battle_room_members;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.shorts;
  exception when duplicate_object then null;
  end;
end $$;

alter table public.profiles alter column lang set default 'en';
alter table public.profiles drop constraint if exists profiles_lang_check;
alter table public.profiles add constraint profiles_lang_check check (lang in ('ar', 'en', 'fr', 'es', 'ru', 'ja'));

alter table public.profiles add column if not exists avatar_url text;

create table if not exists public.friendships (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

grant select, insert, update, delete on public.friendships to authenticated;
grant all on public.friendships to service_role;

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

create table if not exists public.production_requests (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.designs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'in_review', 'quoted', 'declined')),
  note text not null default '',
  created_at timestamptz not null default now()
);

grant select, insert on public.production_requests to authenticated;
grant all on public.production_requests to service_role;

alter table public.production_requests enable row level security;

drop policy if exists "Users can request production of their own designs" on public.production_requests;
create policy "Users can request production of their own designs"
  on public.production_requests for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can view their own production requests" on public.production_requests;
create policy "Users can view their own production requests"
  on public.production_requests for select to authenticated
  using (auth.uid() = user_id);

alter table public.production_requests add column if not exists height_cm integer;
alter table public.production_requests add column if not exists chest_cm integer;
alter table public.production_requests add column if not exists garment_size text;
alter table public.production_requests add column if not exists fabric_preference text;
alter table public.production_requests add column if not exists phone text;
alter table public.production_requests add column if not exists first_name text;
alter table public.production_requests add column if not exists last_name text;
alter table public.production_requests add column if not exists country text;
alter table public.production_requests add column if not exists city text;
alter table public.production_requests add column if not exists district text;
alter table public.production_requests add column if not exists street_address text;
alter table public.production_requests add column if not exists landmark text;
alter table public.production_requests add column if not exists postal_code text;

create table if not exists public.shops (
  user_id uuid primary key references auth.users (id) on delete cascade,
  shop_name text not null,
  tagline text not null default '',
  banner_from text not null default '#22d3ee',
  banner_to text not null default '#d946ef',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.shops to authenticated;
grant all on public.shops to service_role;

alter table public.shops enable row level security;

drop policy if exists "Anyone can view shops" on public.shops;
create policy "Anyone can view shops"
  on public.shops for select to authenticated using (true);

drop policy if exists "Level 50+ or Elite can create their shop" on public.shops;
create policy "Level 50+ or Elite can create their shop"
  on public.shops for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and (p.level >= 50 or p.subscription_tier = 'elite'))
  );

drop policy if exists "Owners can update their own shop" on public.shops;
create policy "Owners can update their own shop"
  on public.shops for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists shops_set_updated_at on public.shops;
create trigger shops_set_updated_at
  before update on public.shops
  for each row execute procedure public.set_updated_at();

drop policy if exists "Signed-in users can view avatars" on storage.objects;
create policy "Signed-in users can view avatars"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can replace their own avatar" on storage.objects;
create policy "Users can replace their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);