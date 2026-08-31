-- MODELZON — Phase 20: real delivery address on production requests.
-- Previously the "request real-life production" form collected height/
-- chest/size/phone/country — enough to CUT the garment, but nothing that
-- lets an actual courier or supplier find the person to deliver it (no
-- city, no street, no landmark). Adds the fields a real shipping label
-- needs, matching the same shape orders.shipping_* already uses in
-- 010_shipping.sql, for consistency across the two request types.
-- Run in Supabase → SQL Editor, AFTER 001-019.

alter table public.production_requests add column if not exists city text;
alter table public.production_requests add column if not exists district text; -- neighborhood/area
alter table public.production_requests add column if not exists street_address text;
alter table public.production_requests add column if not exists landmark text; -- "أقرب معلم" — nearest landmark, common in addresses without formal street numbering
alter table public.production_requests add column if not exists postal_code text;
