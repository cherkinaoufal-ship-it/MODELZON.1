-- MODELZON — Phase 11: Google Play Billing compliance via RevenueCat.
-- 🔴 critical launch blocker: Google Play requires Google Play Billing for
-- any subscription purchased *inside* an Android app — Stripe alone is a
-- policy violation on Android. RevenueCat wraps Google Play Billing (and
-- keeps Stripe working unmodified on the web), and this column just records
-- which rail a given subscription came from, for support/audit purposes.
-- Run in Supabase → SQL Editor, AFTER 001-010.

alter table public.profiles add column if not exists subscription_source text
  check (subscription_source in ('stripe', 'revenuecat_android', 'revenuecat_ios'));

-- Same trusted-server-only protection as the other subscription columns.
create or replace function public.protect_subscription_source()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if new.subscription_source is distinct from old.subscription_source then
      raise exception 'subscription_source can only be changed by the server';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_subscription_source on public.profiles;
create trigger profiles_protect_subscription_source
  before update on public.profiles
  for each row execute procedure public.protect_subscription_source();
