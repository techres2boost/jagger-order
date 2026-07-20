-- Order ratings empower clients to noter leurs commandes et laisser un commentaire.
CREATE TABLE public.order_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.order_ratings TO authenticated;
GRANT ALL ON public.order_ratings TO service_role;
ALTER TABLE public.order_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_ratings_owner_select" ON public.order_ratings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "order_ratings_owner_insert" ON public.order_ratings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND auth.uid() = (SELECT user_id FROM public.orders WHERE id = order_id));
CREATE POLICY "order_ratings_owner_update" ON public.order_ratings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND auth.uid() = (SELECT user_id FROM public.orders WHERE id = order_id));

CREATE UNIQUE INDEX order_ratings_order_user_unique ON public.order_ratings (order_id, user_id);
