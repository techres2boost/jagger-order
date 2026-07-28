-- ============================================================================
-- [Scalabilité 1.1] Index sur clés étrangères + colonnes de filtrage/tri.
--
-- Constat audit : 16 FK sans index couvrant + aucun index sur orders(status),
-- orders(created_at), orders(assigned_livreur_id). Invisible à 137 lignes, mais
-- provoque des seq scans systématiques à l'échelle multi-villes (RLS
-- orders_owner_select, joins order_items, worker d'assignation, chat…).
--
-- ── À propos de CREATE INDEX CONCURRENTLY ───────────────────────────────────
-- Le driver de migration Supabase (`supabase db push` / `migration up`) exécute
-- chaque fichier DANS UNE TRANSACTION. Or `CREATE INDEX CONCURRENTLY` est
-- INTERDIT dans un bloc transactionnel (« cannot run inside a transaction
-- block »). On utilise donc ici `CREATE INDEX IF NOT EXISTS` (verrou
-- ShareLock bref) : à la volumétrie actuelle (~137 lignes) le verrou est
-- sub-milliseconde, donc sans impact.
--
-- ⚠️ POUR UNE APPLICATION SUR GROSSES TABLES (prod déjà volumineuse) : appliquer
-- plutôt les variantes CONCURRENTLY ci-dessous À LA MAIN, une par une, HORS
-- transaction (psql direct ou Studio, statements séparés), puis retirer/ignorer
-- ce fichier. Elles sont fournies en commentaire en fin de migration.
--
-- Idempotent : `IF NOT EXISTS` sur chaque index. Aucune policy/grant modifié.
-- ============================================================================

-- orders : le composite (user_id, created_at) couvre AUSSI les filtres sur
-- user_id seul (préfixe gauche) — utilisé par RLS orders_owner_select et par le
-- tri « mes commandes » (order by created_at desc). Pas d'index user_id séparé.
CREATE INDEX IF NOT EXISTS idx_orders_user_id_created_at
  ON public.orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status
  ON public.orders (status);

-- Partiel : la très grande majorité des commandes n'ont pas de livreur assigné ;
-- l'index ne cible que les lignes pertinentes (RLS livreur + worker).
CREATE INDEX IF NOT EXISTS idx_orders_assigned_livreur_id
  ON public.orders (assigned_livreur_id)
  WHERE assigned_livreur_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_order_messages_sender_id
  ON public.order_messages (sender_id);

CREATE INDEX IF NOT EXISTS idx_order_item_options_order_item_id
  ON public.order_item_options (order_item_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_menu_item_sizes_menu_item_id
  ON public.menu_item_sizes (menu_item_id);

-- Le pkey (menu_item_id, option_group_id) couvre menu_item_id mais PAS
-- option_group_id seul → index dédié pour les lookups inverses.
CREATE INDEX IF NOT EXISTS idx_menu_item_option_groups_option_group_id
  ON public.menu_item_option_groups (option_group_id);

CREATE INDEX IF NOT EXISTS idx_option_items_group_id
  ON public.option_items (group_id);

-- Rafraîchit les statistiques du planificateur (plusieurs tables avaient
-- reltuples = -1 : jamais analysées). ANALYZE est autorisé en transaction.
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.order_item_options;
ANALYZE public.order_messages;
ANALYZE public.push_subscriptions;
ANALYZE public.menu_item_sizes;
ANALYZE public.menu_item_option_groups;
ANALYZE public.option_items;

-- ── Variantes CONCURRENTLY (application manuelle sur grosses tables) ─────────
-- À exécuter une par une, HORS transaction :
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_id_created_at
--     ON public.orders (user_id, created_at DESC);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status ON public.orders (status);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_assigned_livreur_id
--     ON public.orders (assigned_livreur_id) WHERE assigned_livreur_id IS NOT NULL;
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_messages_sender_id ON public.order_messages (sender_id);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_item_options_order_item_id ON public.order_item_options (order_item_id);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions (user_id);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_item_sizes_menu_item_id ON public.menu_item_sizes (menu_item_id);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_item_option_groups_option_group_id ON public.menu_item_option_groups (option_group_id);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_option_items_group_id ON public.option_items (group_id);
