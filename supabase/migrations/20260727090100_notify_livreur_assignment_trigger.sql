-- Tâche 5 : notifier le livreur dès qu'une commande lui est ASSIGNÉE.
-- Déclenchement STRICT sur la seule transition d'assignation : la nouvelle
-- valeur de assigned_livreur_id est non nulle ET différente de l'ancienne
-- (NULL -> livreur, ou livreur A -> livreur B). Aucun envoi sur les autres
-- UPDATE de la commande (statut, timestamps, etc.).
-- Appelle l'Edge Function notify-livreur de façon asynchrone via pg_net, sans
-- bloquer l'UPDATE, exactement comme trg_order_status_notify le fait déjà.

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_livreur_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_livreur_id is not null
     and new.assigned_livreur_id is distinct from old.assigned_livreur_id then
    perform net.http_post(
      url := 'https://ssmmstetcmgsjnjbjkat.supabase.co/functions/v1/notify-livreur',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'livreur_id', new.assigned_livreur_id,
        'order_id', new.id
      )
    );
  end if;
  return new;
end;
$$;

revoke all on function public.notify_livreur_assignment() from public, anon, authenticated;

drop trigger if exists trg_order_livreur_assigned on public.orders;
create trigger trg_order_livreur_assigned
  after update of assigned_livreur_id on public.orders
  for each row
  execute function public.notify_livreur_assignment();
