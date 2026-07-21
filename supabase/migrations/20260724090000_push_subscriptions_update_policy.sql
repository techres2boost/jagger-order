-- push_subscriptions : le client enregistre son abonnement via
-- upsert(onConflict: endpoint), c.-à-d. INSERT ... ON CONFLICT DO UPDATE.
-- La table n'avait que des policies INSERT et SELECT : le chemin UPDATE de
-- l'upsert (ré-abonnement, changement de clé VAPID, renouvellement navigateur)
-- était donc refusé par la RLS et échouait silencieusement.
--
-- On ajoute la policy UPDATE manquante (l'utilisateur ne gère que ses propres
-- abonnements). L'Edge Function lit via la service_role (bypass RLS) : inchangé.

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can update their own subscription" on public.push_subscriptions;
create policy "Users can update their own subscription"
  on public.push_subscriptions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
