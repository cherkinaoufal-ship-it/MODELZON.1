-- MODELZON — Phase 10: real shipping address on marketplace orders.
-- 🟠 the "Buy" button previously created an order with no delivery address
-- at all, and no link to a fulfillment/print partner. This adds the address
-- capture; the actual courier/print-partner integration is a separate,
-- business-side integration (see project notes) and stays out of scope here.
-- Run in Supabase → SQL Editor, AFTER 001-009.

alter table public.orders add column if not exists shipping_full_name text;
alter table public.orders add column if not exists shipping_phone text;
alter table public.orders add column if not exists shipping_country text;
alter table public.orders add column if not exists shipping_city text;
alter table public.orders add column if not exists shipping_address_line text;
alter table public.orders add column if not exists shipping_postal_code text;

-- A paid order must have a shipping address — enforced at the DB level so
-- a bug in the UI can never silently produce an unshippable paid order.
create or replace function public.check_shipping_present()
returns trigger
language plpgsql
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

drop trigger if exists orders_check_shipping on public.orders;
create trigger orders_check_shipping
  before insert or update on public.orders
  for each row execute procedure public.check_shipping_present();
