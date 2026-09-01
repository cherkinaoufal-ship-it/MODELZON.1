-- §9b — Friend REQUESTS (with 30-day auto-expiry) on top of the existing
-- direct friendships table. Pending invitations live here; accepting one
-- writes the mutual friendship rows (both directions) into public.friendships.
--
-- Expiry strategy: a scheduled pg_cron job deletes pending requests older
-- than 30 days (idempotent DO-block so re-running the migration never
-- creates a duplicate cron entry). If pg_cron isn't enabled on the project,
-- the function still exists and the server handlers below ALSO filter by
-- created_at, so expiry is enforced regardless.

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  receiver_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (sender_id, receiver_id),
  check (sender_id <> receiver_id)
);

-- Fast lookup of "my incoming pending requests" (the badge/list path).
create index if not exists friend_requests_receiver_pending_idx
  on public.friend_requests (receiver_id)
  where status = 'pending';

-- Fast lookup of "did I already send one to this player?" (the hourglass
-- state on the sender's profile-inspection card).
create index if not exists friend_requests_sender_idx
  on public.friend_requests (sender_id, created_at desc);

alter table public.friend_requests enable row level security;

-- Parties can see their own requests (sender & receiver). All writes go
-- through the service-role server functions (friendRequests.functions.ts),
-- which enforce tier limits + duplicate checks server-side.
create policy "friend requests visible to parties"
  on public.friend_requests for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

grant select on public.friend_requests to authenticated;

-- 30-day expiry sweeper (called nightly by cron below).
create or replace function public.cleanup_expired_friend_requests()
returns void
language sql
as $$
  delete from public.friend_requests
  where status = 'pending'
    and created_at < now() - interval '30 days';
$$;

-- Schedule the sweeper nightly at 03:00 UTC; tolerate re-runs and missing
-- pg_cron extension gracefully. (Matched by command text rather than job
-- name — pg_cron's jobname column only exists on newer versions.)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (
      select 1 from cron.job
      where command like '%cleanup_expired_friend_requests%'
    ) then
      -- NOTE: plain single-quoted command string (NOT nested dollar-quoting,
      -- which would terminate this very DO block's body).
      perform cron.schedule(
        'cleanup-friend-requests',
        '0 3 * * *',
        'select public.cleanup_expired_friend_requests();'
      );
    end if;
  end if;
exception when others then
  raise notice 'friend-request cron scheduling skipped: %', sqlerrm;
end $$;
