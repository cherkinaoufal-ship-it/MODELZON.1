-- MODELZON — Phase 4b: track the Stripe checkout session on each order.
-- Run in Supabase → SQL Editor, AFTER 001, 002, 003.

alter table public.orders add column if not exists stripe_session_id text;

-- Note: there is deliberately NO update policy here for buyers/sellers.
-- Only the server (using the service-role key, which bypasses RLS
-- entirely) is allowed to flip an order from 'pending' to 'paid' — and it
-- only does that after verifying the payment directly with Stripe. This is
-- what stops someone from marking their own order "paid" from the browser
-- without actually paying.
