-- MODELZON — Phase 15: real 4-player matchmaking battle rooms.
--
-- Replaces the fully mocked "Room Competitors" list (was just live presence,
-- no actual shared match) and the fake hardcoded voice/chat panel
-- (ArenaVoiceChat.tsx had hardcoded sample messages and a mic toggle that
-- never touched a real microphone) with an actual match: 4 real players
-- join a room, get a short "get ready" countdown, move into their own
-- Studio together for a synced 10-minute design window with real chat
-- (and best-effort real mic — see useRoomVoice.ts), then the AI judges
-- everyone and rank points are awarded/deducted based on placement.
-- Run in Supabase → SQL Editor, AFTER 001-014.

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

alter table public.battle_rooms enable row level security;

-- Everyone signed in can see rooms (needed to find one to join) — no
-- sensitive data lives here, just match state.
drop policy if exists "Anyone can view battle rooms" on public.battle_rooms;
create policy "Anyone can view battle rooms"
  on public.battle_rooms for select to authenticated using (true);

-- No insert/update policy for clients on purpose: room creation and every
-- status transition (waiting → countdown → designing → judging → finished)
-- happens server-side in battle.functions.ts, using the service role. This
-- is what makes the 10-minute timer and the AI judging trustworthy — a
-- player's browser can't just declare the match over or skip the timer.

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
  placement integer,          -- 1..4 after judging
  rank_points_delta integer,  -- +/- applied to the player's coins after judging
  primary key (room_id, user_id)
);

alter table public.battle_room_members enable row level security;

drop policy if exists "Members can view their room's roster" on public.battle_room_members;
create policy "Members can view their room's roster"
  on public.battle_room_members for select to authenticated
  using (exists (select 1 from public.battle_room_members m2 where m2.room_id = battle_room_members.room_id and m2.user_id = auth.uid()));

drop policy if exists "Users can join a room as themselves" on public.battle_room_members;
create policy "Users can join a room as themselves"
  on public.battle_room_members for insert to authenticated
  with check (auth.uid() = user_id);

-- A player may update ONLY their own submission fields on their own row —
-- score/placement/rank_points_delta are judged server-side and protected
-- below, same pattern as every other server-authoritative column so far.
drop policy if exists "Users can submit their own entry" on public.battle_room_members;
create policy "Users can submit their own entry"
  on public.battle_room_members for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.protect_battle_judging_columns()
returns trigger
language plpgsql
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

drop trigger if exists battle_members_protect_judging on public.battle_room_members;
create trigger battle_members_protect_judging
  before update on public.battle_room_members
  for each row execute procedure public.protect_battle_judging_columns();

create index if not exists battle_room_members_room_idx on public.battle_room_members (room_id);

-- Realtime: let clients subscribe to row changes on both tables so every
-- player's screen updates the instant the room fills up, the countdown
-- starts, someone submits, or judging finishes — no polling.
alter publication supabase_realtime add table public.battle_rooms;
alter publication supabase_realtime add table public.battle_room_members;
