-- Feature 3: allow admin and the assigned livreur to READ the address linked to
-- an order (to view the home photo + details). Owner policy is unchanged.
DROP POLICY IF EXISTS "addresses_admin_read" ON public.addresses;
CREATE POLICY "addresses_admin_read" ON public.addresses
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "addresses_assigned_livreur_read" ON public.addresses;
CREATE POLICY "addresses_assigned_livreur_read" ON public.addresses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.livreurs l ON l.id = o.assigned_livreur_id
      WHERE o.address_id = addresses.id AND l.user_id = auth.uid()
    )
  );
