create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null default 'Player',
  bio text not null default '',
  level integer not null default 1,
  xp integer not null default 0,
  coins integer not null default 0,
  score numeric(3,1) not null default 0,
  missions integer not null default 0,
  lang text not null default 'ar' check (lang in ('ar', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'username', 'Player'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  garment text not null,
  size text not null,
  color text not null,
  decal_url text,
  decal_transform jsonb,
  title text not null default '',
  fingerprint text not null unique,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.designs to authenticated;
grant all on public.designs to service_role;

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

alter table public.designs add column if not exists for_sale boolean not null default false;
alter table public.designs add column if not exists price_cents integer;
alter table public.designs drop constraint if exists designs_price_positive;
alter table public.designs add constraint designs_price_positive
  check (price_cents is null or price_cents > 0);

drop policy if exists "Anyone can view designs listed for sale" on public.designs;
create policy "Anyone can view designs listed for sale"
  on public.designs for select
  to authenticated
  using (for_sale = true);

create or replace function public.check_seller_level()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  seller_level integer;
begin
  if new.for_sale = true then
    select level into seller_level from public.profiles where id = new.user_id;
    if seller_level is null or seller_level < 50 then
      raise exception 'Level 50 is required to list a design for sale';
    end if;
    if new.price_cents is null or new.price_cents <= 0 then
      raise exception 'A positive price is required to list a design for sale';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists designs_check_seller_level on public.designs;
create trigger designs_check_seller_level
  before insert or update on public.designs
  for each row execute procedure public.check_seller_level();

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.designs (id) on delete restrict,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  seller_id uuid not null references auth.users (id) on delete cascade,
  price_cents integer not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz not null default now()
);

grant select, insert on public.orders to authenticated;
grant all on public.orders to service_role;

alter table public.orders enable row level security;

drop policy if exists "Buyers and sellers can view their own orders" on public.orders;
create policy "Buyers and sellers can view their own orders"
  on public.orders for select
  to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Buyers can create orders for themselves" on public.orders;
create policy "Buyers can create orders for themselves"
  on public.orders for insert
  to authenticated
  with check (auth.uid() = buyer_id);

alter table public.orders add column if not exists stripe_session_id text;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.check_seller_level() from public, anon, authenticated;