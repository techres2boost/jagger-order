-- ============================================================================
-- F-07 (🟡) : admin_notifications a la RLS activée mais AUCUNE policy → table
-- inaccessible sauf service_role (deny-by-default). C'est sûr, mais opaque :
-- une future UI admin (cloche de notifications) ne pourrait rien lire.
--
-- Écriture : uniquement notify_late_deliveries (SECURITY DEFINER, bypass RLS).
-- Lecture : non utilisée dans src/ aujourd'hui. On ajoute UNIQUEMENT une policy
-- SELECT réservée aux admins (aucune policy d'écriture → insertion réservée au
-- service_role, comportement inchangé).
-- ============================================================================

DROP POLICY IF EXISTS "admin_notifications_admin_select" ON public.admin_notifications;
CREATE POLICY "admin_notifications_admin_select" ON public.admin_notifications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
