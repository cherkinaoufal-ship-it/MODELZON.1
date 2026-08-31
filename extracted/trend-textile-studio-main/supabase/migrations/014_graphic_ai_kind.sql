-- MODELZON — Phase 14: allow the new AI Graphic Assistant's rate-limit
-- kind ('graphic') through the existing ai_requests check constraint.
-- Run in Supabase → SQL Editor, AFTER 001-013.

alter table public.ai_requests drop constraint if exists ai_requests_kind_check;
alter table public.ai_requests add constraint ai_requests_kind_check
  check (kind in ('chat', 'judge', 'challenge', 'graphic'));
