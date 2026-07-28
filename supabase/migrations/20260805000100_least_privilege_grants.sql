-- ============================================================================
-- [Audit #3 — MOYEN] Moindre privilège sur les GRANTs de tables pour `authenticated`.
--
-- ⚠️ VÉRIFIÉ AVANT GÉNÉRATION (comme demandé). Rappel important : dans Supabase,
-- les ADMINS opèrent via le rôle Postgres `authenticated` (les policies filtrent
-- ensuite via has_role). Révoquer un grant « FROM authenticated » le retire donc
-- AUSSI aux admins et aux flux légitimes.
--
-- Les REVOKE initialement proposés par l'audit sur menu_items / livreurs /
-- expire_stale_orders CASSERAIENT des fonctionnalités réelles et sont donc
-- VOLONTAIREMENT EXCLUS ici :
--   • menu_items          : src/routes/_authenticated/admin/menu.tsx écrit
--                           (delete / upsert menu_item_sizes) via `authenticated`.
--   • livreurs            : src/routes/_authenticated/admin/livreurs.tsx upsert
--                           via `authenticated`.
--   • expire_stale_orders : appelée par le CLIENT (commande.$id.tsx, auto-expire)
--                           ET l'admin (admin.tsx) via `authenticated`.
--
-- Ne sont révoqués ci-dessous que les grants RÉELLEMENT inutilisés côté
-- `authenticated` : aucun code n'écrit dans order_items / order_item_options via
-- ce rôle (ils sont peuplés par create_order_secure, en SECURITY DEFINER, qui
-- s'exécute avec les privilèges du propriétaire de la fonction — pas ceux de
-- l'appelant). Les lectures (SELECT) restent inchangées.
-- ============================================================================

REVOKE UPDATE, DELETE ON public.order_items        FROM authenticated;
REVOKE UPDATE, DELETE ON public.order_item_options FROM authenticated;
