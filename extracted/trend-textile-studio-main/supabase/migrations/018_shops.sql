-- MODELZON — Phase 18: personal shop pages (unlocked at Level 50, same
-- gate as marketplace selling). A real, working storefront customization —
-- name, tagline, banner color/gradient, and an optional AI-generated
-- tagline for people who don't know what to write — NOT a Shopify clone
-- (no custom checkout flows, apps, or themes), it reuses the exact same
-- marketplace listing/checkout/Stripe Connect pipeline that already
-- exists; this just gives each seller a branded page other people can
-- visit instead of only seeing their designs mixed into the general market.
-- Run in Supabase → SQL Editor, AFTER 001-017.

create table if not exists public.shops (
  user_id uuid primary key references auth.users (id) on delete cascade,
  shop_name text not null,
  tagline text not null default '',
  banner_from text not null default '#22d3ee',
  banner_to text not null default '#d946ef',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shops enable row level security;

drop policy if exists "Anyone can view shops" on public.shops;
create policy "Anyone can view shops"
  on public.shops for select to authenticated using (true);

drop policy if exists "Level 50+ or Elite can create their shop" on public.shops;
create policy "Level 50+ or Elite can create their shop"
  on public.shops for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and (p.level >= 50 or p.subscription_tier = 'elite'))
  );

drop policy if exists "Owners can update their own shop" on public.shops;
create policy "Owners can update their own shop"
  on public.shops for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
