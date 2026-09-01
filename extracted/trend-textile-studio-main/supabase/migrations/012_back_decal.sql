-- MODELZON — Phase 12: real independent back-of-garment artwork.
-- Previously "front/back" just repositioned the SAME uploaded image to the
-- opposite side of the garment. This adds a genuinely separate second
-- decal slot (own image + own placement), composited together with the
-- front decal and any hand-painted strokes — see the rewritten compose()
-- pipeline in src/components/Studio3D.tsx.
-- Run in Supabase → SQL Editor, AFTER 001-011.

alter table public.designs add column if not exists decal_url_back text;
alter table public.designs add column if not exists decal_transform_back jsonb;
