-- MODELZON — Phase 9: real seller payouts via Stripe Connect.
-- Lets marketplace sellers receive money directly (minus MODELZON's
-- commission), instead of every dollar sitting in the platform's own
-- Stripe balance forever. Elite subscribers keep the "zero commission"
-- perk that already existed as a flag in TIER_PERKS.
-- Run in Supabase → SQL Editor, AFTER 001-008.

alter table public.profiles add column if not exists stripe_connect_account_id text;
alter table public.profiles add column if not exists stripe_connect_charges_enabled boolean not null default false;
alter table public.profiles add column if not exists stripe_connect_payouts_enabled boolean not null default false;

-- Same trusted-server-only pattern as subscription_tier: a seller's own
-- browser session must never be able to flip "charges_enabled" to true
-- for themselves — only the server, after Stripe itself confirms it via
-- the Connect onboarding return flow or a webhook, can do that.
create or replace function public.protect_connect_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if new.stripe_connect_account_id is distinct from old.stripe_connect_account_id
      or new.stripe_connect_charges_enabled is distinct from old.stripe_connect_charges_enabled
      or new.stripe_connect_payouts_enabled is distinct from old.stripe_connect_payouts_enabled then
      raise exception 'Stripe Connect fields can only be changed by the server';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_connect on public.profiles;
create trigger profiles_protect_connect
  before update on public.profiles
  for each row execute procedure public.protect_connect_columns();

-- Track the platform commission actually taken on each order, so the seller
-- and the platform both have an auditable record independent of Stripe's
-- own dashboard (useful for support disputes and for showing sellers a
-- "you received X, platform fee was Y" breakdown).
alter table public.orders add column if not exists application_fee_cents integer not null default 0;
alter table public.orders add column if not exists seller_stripe_account_id text;
