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

alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists is_banned boolean not null default false;
alter table public.profiles add column if not exists banned_reason text;

create or replace function public.protect_moderation_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
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

revoke all on function public.protect_moderation_columns() from public, anon, authenticated;

drop trigger if exists profiles_protect_moderation on public.profiles;
create trigger profiles_protect_moderation
  before update on public.profiles
  for each row execute procedure public.protect_moderation_columns();

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

create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = _user_id and p.is_admin)
$$;

drop policy if exists "Admins can view all designs" on public.designs;
create policy "Admins can view all designs"
  on public.designs for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "Admins can view all topics" on public.arena_topics;
create policy "Admins can view all topics"
  on public.arena_topics for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "Admins can view all entries" on public.arena_entries;
create policy "Admins can view all entries"
  on public.arena_entries for select to authenticated
  using (public.is_admin(auth.uid()));

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

grant select, insert on public.reports to authenticated;
grant all on public.reports to service_role;

alter table public.reports enable row level security;

drop policy if exists "Users can file reports" on public.reports;
create policy "Users can file reports"
  on public.reports for insert to authenticated
  with check (auth.uid() = reporter_id);

drop policy if exists "Users can view their own reports" on public.reports;
create policy "Users can view their own reports"
  on public.reports for select to authenticated
  using (auth.uid() = reporter_id or public.is_admin(auth.uid()));

create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_target_idx on public.reports (target_type, target_id);

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

grant select, insert, update, delete on public.user_blocks to authenticated;
grant all on public.user_blocks to service_role;

alter table public.user_blocks enable row level security;

drop policy if exists "Users manage their own blocks" on public.user_blocks;
create policy "Users manage their own blocks"
  on public.user_blocks for all to authenticated
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

create table if not exists public.ai_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('chat', 'judge', 'challenge')),
  created_at timestamptz not null default now()
);

grant all on public.ai_requests to service_role;

alter table public.ai_requests enable row level security;

create index if not exists ai_requests_user_time_idx on public.ai_requests (user_id, kind, created_at desc);

create or replace function public.check_and_log_ai_request(
  p_user_id uuid,
  p_kind text,
  p_max_per_window integer,
  p_window_minutes integer
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
  from public.ai_requests
  where user_id = p_user_id
    and kind = p_kind
    and created_at > now() - make_interval(mins => p_window_minutes);

  if recent_count >= p_max_per_window then
    return false;
  end if;

  insert into public.ai_requests (user_id, kind) values (p_user_id, p_kind);
  return true;
end;
$$;

revoke all on function public.check_and_log_ai_request(uuid, text, integer, integer) from public, anon, authenticated;

create or replace function public.prune_old_ai_requests()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.ai_requests where created_at < now() - interval '7 days';
$$;

revoke all on function public.prune_old_ai_requests() from public, anon, authenticated;
revoke all on function public.is_admin(uuid) from public, anon;