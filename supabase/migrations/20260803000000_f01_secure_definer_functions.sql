-- ============================================================================
-- F-01 (🔴) : sécurisation des fonctions SECURITY DEFINER non protégées.
--
-- Fonctions concernées (créées hors migrations, via l'éditeur Lovable) :
--   * check_late_orders()          — SECURITY DEFINER, search_path NON fixé
--   * notify_late_deliveries()     — SECURITY DEFINER, search_path NON fixé
--   * trigger_late_delivery_push() — SECURITY DEFINER, search_path NON fixé
--   (bonus) set_order_arrival_at() — search_path OK mais EXECUTE ouvert à anon
--
-- Appelants réels vérifiés sur la base live :
--   * check_late_orders      → cron "check-late-orders"      (jobid 4, chaque minute)
--   * notify_late_deliveries → cron "check-late-deliveries"  (jobid 5, chaque minute)
--   * trigger_late_delivery_push → trigger on_late_delivery_notification
--                                  (AFTER INSERT ON admin_notifications)
--   * set_order_arrival_at   → trigger trg_set_arrival_at (BEFORE UPDATE ON orders)
--   AUCUNE n'est appelée depuis le frontend (src/) ni depuis une Edge Function.
--
-- Deux durcissements :
--   1) SET search_path = public, pg_temp  → empêche le search_path hijacking
--      (pg_temp placé en dernier, jamais résolu avant public).
--   2) REVOKE EXECUTE FROM anon, authenticated → ces fonctions ne doivent être
--      déclenchées que par pg_cron / triggers, jamais via /rest/v1/rpc/*.
--      - Les jobs pg_cron s'exécutent sous le rôle planificateur (postgres),
--        pas anon/authenticated : le REVOKE ne les casse pas.
--      - Une fonction trigger s'exécute dans le cadre de l'ordre déclencheur et
--        ne requiert pas le privilège EXECUTE de l'appelant : le REVOKE ne
--        casse pas le trigger non plus.
-- ============================================================================

-- 1) search_path figé (idempotent : ALTER FUNCTION ne réécrit pas le corps).
ALTER FUNCTION public.check_late_orders()          SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_late_deliveries()     SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_late_delivery_push() SET search_path = public, pg_temp;
-- Bonus cohérence : déjà en public, on ajoute pg_temp.
ALTER FUNCTION public.set_order_arrival_at()       SET search_path = public, pg_temp;

-- 2) Fermeture de la surface RPC publique.
REVOKE EXECUTE ON FUNCTION public.check_late_orders()          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_late_deliveries()     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_late_delivery_push() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_order_arrival_at()       FROM anon, authenticated;
-- On révoque aussi le rôle générique PUBLIC par prudence (héritage éventuel).
REVOKE EXECUTE ON FUNCTION public.check_late_orders()          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_late_deliveries()     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_late_delivery_push() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_order_arrival_at()       FROM PUBLIC;
