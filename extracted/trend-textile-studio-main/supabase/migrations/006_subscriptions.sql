-- MODELZON — Phase 5: three-tier monthly subscription (basic → pro → elite,
-- each includes everything the tier below it has, plus one more perk).
-- Run in Supabase → SQL Editor, AFTER 001-005.

alter table public.profiles add column if not exists subscription_tier text not null default 'free'
  check (subscription_tier in ('free', 'basic', 'pro', 'elite'));
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;
alter table public.profiles add column if not exists subscription_renews_at timestamptz;

-- These columns must NEVER be settable by the person themselves from the
-- browser (that would mean anyone could grant themselves Elite for free).
-- Only the server, using the service-role key (role = 'service_role'),
-- is allowed to change them — the same trusted-server pattern as payments.
create or replace function public.protect_subscription_columns()
returns trigger
language plpgsql
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

drop trigger if exists profiles_protect_subscription on public.profiles;
create trigger profiles_protect_subscription
  before update on public.profiles
  for each row execute procedure public.protect_subscription_columns();

-- Elite subscribers can sell without the level-50 requirement — update the
-- existing check from 003_marketplace.sql to also allow that.
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
