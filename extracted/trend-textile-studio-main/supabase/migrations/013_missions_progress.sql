-- MODELZON — Phase 13: close a real, exploitable gap in level/XP/coins.
--
-- Found while implementing the mission system: profiles.level/xp/coins/
-- score/missions have existed since 001_profiles.sql, but the RLS policy
-- there ("Users can update own profile") only checks `auth.uid() = id` —
-- it does NOT restrict which columns a user can change on their own row.
-- That means any signed-in user could already call the Supabase client
-- directly (e.g. from the browser console) and set their own level/xp/coins
-- to anything, which also matters beyond bragging rights: 003_marketplace.sql's
-- `check_seller_level` trigger gates marketplace listing on `level >= 50`,
-- reading the very same unprotected column. This closes that gap and adds
-- `completed_missions`, used by the new mission-based XP system (see
-- src/lib/progress.functions.ts) so XP is only ever granted by the server
-- after independently verifying the underlying achievement actually
-- happened (designs saved, battles judged, sales made — real counts from
-- their own tables), never by a client-supplied amount.
-- Run in Supabase → SQL Editor, AFTER 001-012.

alter table public.profiles add column if not exists completed_missions text[] not null default '{}';

create or replace function public.protect_progress_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if new.level is distinct from old.level
      or new.xp is distinct from old.xp
      or new.coins is distinct from old.coins
      or new.score is distinct from old.score
      or new.missions is distinct from old.missions
      or new.completed_missions is distinct from old.completed_missions then
      raise exception 'level/xp/coins/score/missions can only be changed by the server';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_progress on public.profiles;
create trigger profiles_protect_progress
  before update on public.profiles
  for each row execute procedure public.protect_progress_columns();
