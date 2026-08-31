-- MODELZON — Phase 4a: marketplace listings (payment wiring comes next, in
-- phase 4b, once Stripe is connected — this part works fully on its own).
-- Run in Supabase → SQL Editor, AFTER 001 and 002.

-- A design becomes sellable by flipping for_sale + setting a price.
alter table public.designs add column if not exists for_sale boolean not null default false;
alter table public.designs add column if not exists price_cents integer;
alter table public.designs add constraint designs_price_positive
  check (price_cents is null or price_cents > 0);

-- Everyone can browse designs that are actually listed for sale, in addition
-- to the existing "owner can see their own" policy from 002 (RLS policies
-- for the same action are OR'd together, so this only *adds* visibility).
drop policy if exists "Anyone can view designs listed for sale" on public.designs;
create policy "Anyone can view designs listed for sale"
  on public.designs for select
  to authenticated
  using (for_sale = true);

-- Sellers must be level 50+ to list — enforced here, not just in the UI,
-- so the rule can't be bypassed by calling the API directly.
create or replace function public.check_seller_level()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  seller_level integer;
begin
  if new.for_sale = true then
    select level into seller_level from public.profiles where id = new.user_id;
    if seller_level is null or seller_level < 50 then
      raise exception 'Level 50 is required to list a design for sale';
    end if;
    if new.price_cents is null or new.price_cents <= 0 then
      raise exception 'A positive price is required to list a design for sale';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists designs_check_seller_level on public.designs;
create trigger designs_check_seller_level
  before insert or update on public.designs
  for each row execute procedure public.check_seller_level();

-- 2) Orders — one row per purchase attempt. Starts "pending" the moment a
-- buyer clicks Buy; a later phase flips it to "paid" once Stripe checkout
-- is wired in (payment_intent/session id will be added then).
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.designs (id) on delete restrict,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  seller_id uuid not null references auth.users (id) on delete cascade,
  price_cents integer not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

drop policy if exists "Buyers and sellers can view their own orders" on public.orders;
create policy "Buyers and sellers can view their own orders"
  on public.orders for select
  to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Buyers can create orders for themselves" on public.orders;
create policy "Buyers can create orders for themselves"
  on public.orders for insert
  to authenticated
  with check (auth.uid() = buyer_id);
