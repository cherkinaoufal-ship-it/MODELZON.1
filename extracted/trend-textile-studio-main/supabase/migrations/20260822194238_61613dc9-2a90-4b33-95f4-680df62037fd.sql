create table if not exists public.arena_topics (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  author_id uuid not null references auth.users (id) on delete cascade,
  votes_count integer not null default 1,
  created_at timestamptz not null default now()
);

grant select, insert on public.arena_topics to authenticated;
grant all on public.arena_topics to service_role;

alter table public.arena_topics enable row level security;

drop policy if exists "Topics are viewable by authenticated users" on public.arena_topics;
create policy "Topics are viewable by authenticated users"
  on public.arena_topics for select to authenticated using (true);

drop policy if exists "Users can suggest topics" on public.arena_topics;
create policy "Users can suggest topics"
  on public.arena_topics for insert to authenticated
  with check (auth.uid() = author_id);

create table if not exists public.arena_topic_votes (
  topic_id uuid not null references public.arena_topics (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (topic_id, user_id)
);

grant select, insert on public.arena_topic_votes to authenticated;
grant all on public.arena_topic_votes to service_role;

alter table public.arena_topic_votes enable row level security;

drop policy if exists "Votes are viewable by authenticated users" on public.arena_topic_votes;
create policy "Votes are viewable by authenticated users"
  on public.arena_topic_votes for select to authenticated using (true);

drop policy if exists "Users can vote as themselves" on public.arena_topic_votes;
create policy "Users can vote as themselves"
  on public.arena_topic_votes for insert to authenticated
  with check (auth.uid() = user_id);

create or replace function public.bump_topic_votes()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.arena_topics set votes_count = votes_count + 1 where id = new.topic_id;
  return new;
end;
$$;

revoke all on function public.bump_topic_votes() from public, anon, authenticated;

drop trigger if exists on_topic_vote on public.arena_topic_votes;
create trigger on_topic_vote
  after insert on public.arena_topic_votes
  for each row execute procedure public.bump_topic_votes();

create table if not exists public.arena_entries (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.arena_topics (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  garment text not null,
  color text not null,
  description text not null,
  score numeric(3,1) not null,
  creativity numeric(3,1) not null,
  craft numeric(3,1) not null,
  topic_fit numeric(3,1) not null,
  verdict text not null default '',
  created_at timestamptz not null default now()
);

grant select, insert on public.arena_entries to authenticated;
grant all on public.arena_entries to service_role;

alter table public.arena_entries enable row level security;

drop policy if exists "Entries are viewable by authenticated users" on public.arena_entries;
create policy "Entries are viewable by authenticated users"
  on public.arena_entries for select to authenticated using (true);

drop policy if exists "Users can submit their own entries" on public.arena_entries;
create policy "Users can submit their own entries"
  on public.arena_entries for insert to authenticated
  with check (auth.uid() = user_id);

create index if not exists arena_entries_topic_idx on public.arena_entries (topic_id, score desc);

alter table public.profiles add column if not exists subscription_tier text not null default 'free';
alter table public.profiles drop constraint if exists profiles_subscription_tier_check;
alter table public.profiles add constraint profiles_subscription_tier_check
  check (subscription_tier in ('free', 'basic', 'pro', 'elite'));
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;
alter table public.profiles add column if not exists subscription_renews_at timestamptz;

create or replace function public.protect_subscription_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    if new.subscription_tier is distinct from old.subscription_tier
      or new.stripe_customer_id is distinct from old.stripe_customer_id
      or new.stripe_subscription_id is distinct from old.stripe_subscription_id
      or new.subscription_renews_at is distinct from old.subscription_renews_at then
      raise exception 'subscription fields can only be changed by the server';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_subscription_columns() from public, anon, authenticated;

drop trigger if exists profiles_protect_subscription on public.profiles;
create trigger profiles_protect_subscription
  before update on public.profiles
  for each row execute procedure public.protect_subscription_columns();

create or replace function public.check_seller_level()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  seller_level integer;
  seller_tier text;
begin
  if new.for_sale = true then
    select level, subscription_tier into seller_level, seller_tier from public.profiles where id = new.user_id;
    if (seller_level is null or seller_level < 50) and coalesce(seller_tier, 'free') <> 'elite' then
      raise exception 'Level 50 (or an Elite subscription) is required to list a design for sale';
    end if;
    if new.price_cents is null or new.price_cents <= 0 then
      raise exception 'A positive price is required to list a design for sale';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.check_seller_level() from public, anon, authenticated;