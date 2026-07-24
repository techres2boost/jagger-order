-- Livreur ratings : permet au client de noter le livreur après livraison et de
-- laisser un commentaire. Structure et policies calquées sur order_ratings pour
-- rester cohérent, y compris le marqueur durable "Plus tard" (dismissed).
--
-- Une ligne dismissed a rating IS NULL AND dismissed = true ; une ligne notée
-- garde rating 1..5 AND dismissed = false. Une seule ligne par commande (unique
-- sur order_id), donc "traité" = une ligne existe, notée ou ignorée.
CREATE TABLE public.livreur_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  livreur_id UUID REFERENCES public.livreurs(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT livreur_ratings_rating_check
    CHECK ((rating IS NULL AND dismissed = true) OR (rating >= 1 AND rating <= 5))
);

GRANT SELECT, INSERT, UPDATE ON public.livreur_ratings TO authenticated;
GRANT ALL ON public.livreur_ratings TO service_role;
ALTER TABLE public.livreur_ratings ENABLE ROW LEVEL SECURITY;

-- Un user ne peut lire/insérer/mettre à jour que ses propres évaluations, et
-- uniquement pour ses propres commandes (mêmes règles que order_ratings).
CREATE POLICY "livreur_ratings_owner_select" ON public.livreur_ratings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "livreur_ratings_owner_insert" ON public.livreur_ratings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND auth.uid() = (SELECT user_id FROM public.orders WHERE id = order_id));
CREATE POLICY "livreur_ratings_owner_update" ON public.livreur_ratings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND auth.uid() = (SELECT user_id FROM public.orders WHERE id = order_id));

-- Une seule évaluation par commande : rend l'upsert onConflict "order_id" fiable
-- et garantit qu'on ne re-propose pas une commande déjà traitée.
CREATE UNIQUE INDEX livreur_ratings_order_unique ON public.livreur_ratings (order_id);
