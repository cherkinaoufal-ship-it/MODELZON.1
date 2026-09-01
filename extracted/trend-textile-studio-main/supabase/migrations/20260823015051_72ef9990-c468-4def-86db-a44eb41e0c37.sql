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