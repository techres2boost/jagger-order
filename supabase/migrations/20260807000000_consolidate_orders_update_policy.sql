-- ============================================================================
-- [Audit perf — Option A] Consolide les DEUX policies permissives UPDATE de
-- `orders` (rôle authenticated) en UNE SEULE policy OR.
--
-- Élimine l'unique warning Advisor `multiple_permissive_policies` restant :
--   orders / UPDATE / authenticated : {orders_admin_update, orders_owner_cancel}
--
-- ── Équivalence stricte des autorisations ───────────────────────────────────
-- PostgreSQL, avec plusieurs policies permissives sur une même action, combine
-- les USING par OR et les WITH CHECK par OR (la ligne doit satisfaire
-- (USING_a OR USING_b) ET (CHECK_a OR CHECK_b)). Fusionner les deux policies en
-- une seule dont USING = (USING_admin OR USING_owner) et CHECK = (CHECK_admin OR
-- CHECK_owner) produit donc EXACTEMENT la même sémantique — aucune autorisation
-- effective ne change.
--
-- Policies d'origine (conservées à l'identique dans les expressions ci-dessous) :
--   orders_admin_update : USING has_role(admin) / CHECK has_role(admin)
--   orders_owner_cancel : USING (user_id = auth.uid() AND status='pending')
--                         CHECK (user_id = auth.uid() AND status='cancelled')
--
-- Les appels auth.uid()/has_role() restent wrappés en (SELECT …) pour préserver
-- l'optimisation initplan (aucun warning auth_rls_initplan réintroduit).
-- Idempotent : DROP IF EXISTS avant CREATE. Exécuté dans une transaction.
-- ============================================================================

DROP POLICY IF EXISTS "orders_admin_update" ON public.orders;
DROP POLICY IF EXISTS "orders_owner_cancel" ON public.orders;
DROP POLICY IF EXISTS "orders_update" ON public.orders;

CREATE POLICY "orders_update" ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))
    OR (user_id = (SELECT auth.uid()) AND status = 'pending'::order_status)
  )
  WITH CHECK (
    (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))
    OR (user_id = (SELECT auth.uid()) AND status = 'cancelled'::order_status)
  );
