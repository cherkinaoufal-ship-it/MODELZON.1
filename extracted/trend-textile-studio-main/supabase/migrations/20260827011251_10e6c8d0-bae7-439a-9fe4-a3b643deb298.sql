ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT true;

CREATE POLICY "Designs of public profiles are viewable"
ON public.designs FOR SELECT TO authenticated
USING (
  is_hidden = false
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = designs.user_id AND p.is_private = false)
);