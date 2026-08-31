alter table public.profiles add column if not exists stripe_connect_account_id text;
alter table public.profiles add column if not exists stripe_connect_charges_enabled boolean not null default false;
alter table public.profiles add column if not exists stripe_connect_payouts_enabled boolean not null default false;

create or replace function public.protect_connect_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
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
revoke all on function public.protect_connect_columns() from public, anon, authenticated;

drop trigger if exists profiles_protect_connect on public.profiles;
create trigger profiles_protect_connect
  before update on public.profiles
  for each row execute procedure public.protect_connect_columns();

alter table public.orders add column if not exists application_fee_cents integer not null default 0;
alter table public.orders add column if not exists seller_stripe_account_id text;

alter table public.orders add column if not exists shipping_full_name text;
alter table public.orders add column if not exists shipping_phone text;
alter table public.orders add column if not exists shipping_country text;
alter table public.orders add column if not exists shipping_city text;
alter table public.orders add column if not exists shipping_address_line text;
alter table public.orders add column if not exists shipping_postal_code text;

create or replace function public.check_shipping_present()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status in ('paid', 'shipped', 'delivered') then
    if new.shipping_full_name is null or new.shipping_address_line is null or new.shipping_city is null or new.shipping_country is null then
      raise exception 'A shipping address is required before an order can be marked paid';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.check_shipping_present() from public, anon, authenticated;

drop trigger if exists orders_check_shipping on public.orders;
create trigger orders_check_shipping
  before insert or update on public.orders
  for each row execute procedure public.check_shipping_present();

alter table public.profiles add column if not exists subscription_source text;
alter table public.profiles drop constraint if exists profiles_subscription_source_check;
alter table public.profiles add constraint profiles_subscription_source_check
  check (subscription_source in ('stripe', 'revenuecat_android', 'revenuecat_ios'));

create or replace function public.protect_subscription_source()
returns trigger
language plpgsql
security invoker
set search_path = public
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
revoke all on function public.protect_subscription_source() from public, anon, authenticated;

drop trigger if exists profiles_protect_subscription_source on public.profiles;
create trigger profiles_protect_subscription_source
  before update on public.profiles
  for each row execute procedure public.protect_subscription_source();

alter table public.designs add column if not exists decal_url_back text;
alter table public.designs add column if not exists decal_transform_back jsonb;

alter table public.profiles add column if not exists completed_missions text[] not null default '{}';

create or replace function public.protect_progress_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
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
revoke all on function public.protect_progress_columns() from public, anon, authenticated;

drop trigger if exists profiles_protect_progress on public.profiles;
create trigger profiles_protect_progress
  before update on public.profiles
  for each row execute procedure public.protect_progress_columns();

alter table public.ai_requests drop constraint if exists ai_requests_kind_check;
alter table public.ai_requests add constraint ai_requests_kind_check
  check (kind in ('chat', 'judge', 'challenge', 'graphic'));