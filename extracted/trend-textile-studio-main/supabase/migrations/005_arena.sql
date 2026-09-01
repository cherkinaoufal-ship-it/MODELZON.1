-- MODELZON — Phase 6: real arena — shared topics/votes across all players,
-- and every AI-judged submission saved so there's a real per-topic leaderboard.
-- Run in Supabase → SQL Editor, AFTER 001-004.

create table if not exists public.arena_topics (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  author_id uuid not null references auth.users (id) on delete cascade,
  votes_count integer not null default 1,
  created_at timestamptz not null default now()
);

alter table public.arena_topics enable row level security;

drop policy if exists "Topics are viewable by authenticated users" on public.arena_topics;
create policy "Topics are viewable by authenticated users"
  on public.arena_topics for select to authenticated using (true);

drop policy if exists "Users can suggest topics" on public.arena_topics;
create policy "Users can suggest topics"
  on public.arena_topics for insert to authenticated
  with check (auth.uid() = author_id);

-- One vote per player per topic — the unique constraint is what actually
-- stops double-voting, not just the UI disabling the button.
create table if not exists public.arena_topic_votes (
  topic_id uuid not null references public.arena_topics (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (topic_id, user_id)
);

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

drop trigger if exists on_topic_vote on public.arena_topic_votes;
create trigger on_topic_vote
  after insert on public.arena_topic_votes
  for each row execute procedure public.bump_topic_votes();

-- Every AI-judged submission, tied to the community topic it was scored
-- against — this is what makes the per-topic leaderboard (and "top 2 win")
-- real instead of a single-player score that nobody else sees.
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

alter table public.arena_entries enable row level security;

drop policy if exists "Entries are viewable by authenticated users" on public.arena_entries;
create policy "Entries are viewable by authenticated users"
  on public.arena_entries for select to authenticated using (true);

drop policy if exists "Users can submit their own entries" on public.arena_entries;
create policy "Users can submit their own entries"
  on public.arena_entries for insert to authenticated
  with check (auth.uid() = user_id);

create index if not exists arena_entries_topic_idx on public.arena_entries (topic_id, score desc);
