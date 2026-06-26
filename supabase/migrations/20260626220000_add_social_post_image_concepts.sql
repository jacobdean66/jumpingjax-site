ALTER TABLE public.social_posts
ADD COLUMN IF NOT EXISTS image_concepts jsonb DEFAULT '[]'::jsonb;
