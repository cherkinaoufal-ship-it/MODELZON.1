-- MODELZON — Phase 8: AI abuse protection.
-- 🔴 critical: without this, one user can script thousands of AI Design
-- Chat / Arena Judge calls and drain the LOVABLE_API_KEY credit balance.
-- Run in Supabase → SQL Editor, AFTER 001-007.

create table if not exists public.ai_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('chat', 'judge', 'challenge')),
  created_at timestamptz not null default now()
);

alter table public.ai_requests enable row level security;

-- No client policies at all: this table is written and read exclusively by
-- server functions using the service-role key. A user should never be able
-- to delete their own rows to dodge the limiter.
create index if not exists ai_requests_user_time_idx on public.ai_requests (user_id, kind, created_at desc);

-- Returns true and logs the call if the user is still under the limit;
-- returns false (and logs nothing) if they've hit it. Called from the
-- server function BEFORE the actual (costly) AI gateway call.
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

-- Cheap housekeeping: keep the table from growing forever. Safe to call
-- periodically (e.g. a scheduled Supabase cron / edge function) or simply
-- left to grow — Postgres handles millions of rows fine, this is optional.
create or replace function public.prune_old_ai_requests()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.ai_requests where created_at < now() - interval '7 days';
$$;
