-- Feature 4 rework: allow order_ratings to also record a durable "review dismissed"
-- marker. A dismissed row has rating IS NULL AND dismissed = true; a rated row keeps
-- rating 1..5 AND dismissed = false. One row per order (existing unique index on
-- order_id), so "handled" = a row exists, whether rated or dismissed.
ALTER TABLE public.order_ratings ADD COLUMN IF NOT EXISTS dismissed boolean NOT NULL DEFAULT false;
ALTER TABLE public.order_ratings ALTER COLUMN rating DROP NOT NULL;
ALTER TABLE public.order_ratings DROP CONSTRAINT IF EXISTS order_ratings_rating_check;
ALTER TABLE public.order_ratings ADD CONSTRAINT order_ratings_rating_check
  CHECK ((rating IS NULL AND dismissed = true) OR (rating >= 1 AND rating <= 5));
