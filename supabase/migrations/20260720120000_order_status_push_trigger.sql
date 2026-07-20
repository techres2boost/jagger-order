-- Notifications push automatiques à chaque changement de orders.status.
-- Réutilise l'Edge Function send-order-notification (déployée séparément) et
-- l'extension pg_net déjà standard sur les projets Supabase pour l'appeler
-- de façon asynchrone depuis un trigger, sans bloquer l'UPDATE.
-- N'étend PAS order_status ni n'ajoute de colonnes sur orders : déjà fait (cf. prompt).

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform net.http_post(
      url := 'https://ssmmstetcmgsjnjbjkat.supabase.co/functions/v1/send-order-notification',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('order_id', new.id, 'status', new.status)
    );
  end if;
  return new;
end;
$$;

revoke all on function public.notify_order_status_change() from public, anon, authenticated;

drop trigger if exists trg_order_status_notify on public.orders;
create trigger trg_order_status_notify
  after update of status on public.orders
  for each row
  execute function public.notify_order_status_change();
