DROP POLICY IF EXISTS "Users can manage their own addresses" ON public.addresses;
CREATE POLICY "Users can manage their own addresses" ON public.addresses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Livreur read own profile" ON public.livreurs;
CREATE POLICY "Livreur read own profile" ON public.livreurs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "orders_livreur_select" ON public.orders;
CREATE POLICY "orders_livreur_select" ON public.orders
  FOR SELECT TO authenticated
  USING (assigned_livreur_id IN (
    SELECT l.id FROM public.livreurs l WHERE l.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.push_subscriptions;
CREATE POLICY "Users can insert their own subscription" ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own subscription" ON public.push_subscriptions;
CREATE POLICY "Users can view their own subscription" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);