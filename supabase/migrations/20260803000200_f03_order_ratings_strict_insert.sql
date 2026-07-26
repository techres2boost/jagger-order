-- ============================================================================
-- F-03 (🟠) : la policy INSERT live de order_ratings avait été affaiblie
-- (« Users can insert their own ratings » : WITH CHECK (auth.uid() = user_id)
-- seulement), permettant à un utilisateur de créer une note rattachée à une
-- commande qui n'est PAS la sienne (spoof de notes / pollution des stats).
--
-- Correctif : rétablir la règle stricte d'origine (migration
-- 20260711120000_add_order_ratings.sql) — la commande notée doit appartenir à
-- l'appelant. On aligne aussi la policy UPDATE (garde forte au cas où une
-- écriture de note serait éditée).
-- ============================================================================

-- Remplace la policy INSERT permissive par la version stricte.
DROP POLICY IF EXISTS "Users can insert their own ratings" ON public.order_ratings;
DROP POLICY IF EXISTS "order_ratings_owner_insert" ON public.order_ratings;
CREATE POLICY "order_ratings_owner_insert" ON public.order_ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() = (SELECT o.user_id FROM public.orders o WHERE o.id = order_id)
  );

-- UPDATE strict (rétabli s'il avait disparu côté live) : mêmes conditions.
DROP POLICY IF EXISTS "order_ratings_owner_update" ON public.order_ratings;
CREATE POLICY "order_ratings_owner_update" ON public.order_ratings
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() = (SELECT o.user_id FROM public.orders o WHERE o.id = order_id)
  );
