-- MODELZON — Phase 19: real measurements on production requests.
-- The "request real-life production" button previously only captured a
-- free-text note — this adds the actual structured fields a print/sewing
-- partner needs to quote and cut a real garment.
-- Run in Supabase → SQL Editor, AFTER 001-018.

alter table public.production_requests add column if not exists height_cm integer;
alter table public.production_requests add column if not exists chest_cm integer;
alter table public.production_requests add column if not exists garment_size text; -- S/M/L/XL/custom
alter table public.production_requests add column if not exists fabric_preference text;
alter table public.production_requests add column if not exists phone text;
alter table public.production_requests add column if not exists first_name text;
alter table public.production_requests add column if not exists last_name text;
alter table public.production_requests add column if not exists country text;
