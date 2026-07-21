-- Cause du "new row violates row-level security policy (USING expression)" :
-- le client enregistrait l'abonnement via upsert(onConflict: "endpoint").
-- Un endpoint push identifie un NAVIGATEUR/APPAREIL, pas un utilisateur. Quand
-- le même appareil est réutilisé par un autre compte, l'endpoint existe déjà
-- mais appartient à un autre user_id. L'upsert bascule alors en UPDATE, et
-- PostgreSQL exige que la ligne en conflit soit VISIBLE via la policy SELECT
-- (auth.uid() = user_id) — or elle appartient à l'ancien compte → invisible →
-- refus "(USING expression)". Assouplir la policy SELECT exposerait les
-- abonnements (endpoints + clés) de tous les utilisateurs : à éviter.
--
-- Correctif : passer par une RPC SECURITY DEFINER qui fait l'upsert en
-- contournant la RLS de façon contrôlée, en réattribuant toujours la ligne à
-- l'utilisateur authentifié courant (user_id = auth.uid()). Aucune lecture
-- croisée, les policies de table restent strictes. On ne touche qu'à cette table.

-- Policy UPDATE stricte (moindre privilège) : l'upsert direct n'est plus utilisé
-- côté client. (Idempotent : rétablit l'état strict au cas où une variante plus
-- permissive aurait été appliquée à la base en cours de diagnostic.)
drop policy if exists "Users can update their own subscription" on public.push_subscriptions;
create policy "Users can update their own subscription"
  on public.push_subscriptions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_role text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if p_role not in ('client', 'admin') then
    raise exception 'Rôle invalide: %', p_role using errcode = '22023';
  end if;

  insert into public.push_subscriptions (endpoint, p256dh, auth, role, user_id)
    values (p_endpoint, p_p256dh, p_auth, p_role, uid)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        role = excluded.role,
        user_id = excluded.user_id;
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
