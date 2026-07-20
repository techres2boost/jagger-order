-- Sécurise la nouvelle table livreurs et ouvre l'accès aux commandes assignées
-- pour le rôle 'livreur', selon le même pattern RLS que le reste du projet.

ALTER TABLE public.livreurs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.livreurs TO authenticated;
GRANT ALL ON public.livreurs TO service_role;
GRANT SELECT ON public.livreur_stats TO authenticated;

DROP POLICY IF EXISTS "livreurs_admin_all" ON public.livreurs;
CREATE POLICY "livreurs_admin_all" ON public.livreurs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "livreurs_self_select" ON public.livreurs;
CREATE POLICY "livreurs_self_select" ON public.livreurs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Tâche 3 : un livreur voit et met à jour uniquement les commandes qui lui sont assignées.
DROP POLICY IF EXISTS "orders_livreur_select_assigned" ON public.orders;
CREATE POLICY "orders_livreur_select_assigned" ON public.orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.livreurs l
      WHERE l.id = orders.assigned_livreur_id AND l.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "orders_livreur_update_assigned" ON public.orders;
CREATE POLICY "orders_livreur_update_assigned" ON public.orders FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.livreurs l
      WHERE l.id = orders.assigned_livreur_id AND l.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_items_livreur_select_assigned" ON public.order_items;
CREATE POLICY "order_items_livreur_select_assigned" ON public.order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.livreurs l ON l.id = o.assigned_livreur_id
      WHERE o.id = order_items.order_id AND l.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_item_options_livreur_select_assigned" ON public.order_item_options;
CREATE POLICY "order_item_options_livreur_select_assigned" ON public.order_item_options FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      JOIN public.livreurs l ON l.id = o.assigned_livreur_id
      WHERE oi.id = order_item_options.order_item_id AND l.user_id = auth.uid()
    )
  );
