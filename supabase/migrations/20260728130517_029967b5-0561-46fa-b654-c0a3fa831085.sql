CREATE POLICY "livreur_ratings_admin_select" ON public.livreur_ratings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "livreur_ratings_livreur_select" ON public.livreur_ratings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.livreurs l WHERE l.id = livreur_ratings.livreur_id AND l.user_id = auth.uid()));