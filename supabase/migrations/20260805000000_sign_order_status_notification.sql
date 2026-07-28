-- ============================================================================
-- [Audit #1 — CRITIQUE] Signer l'appel DB → Edge Function `send-order-notification`.
--
-- Contexte (vérifié) : les Edge Functions send-order-notification /
-- notify-order-message / notify-livreur VALIDENT déjà un secret partagé
-- `x-push-secret` (= internal_secret('push_trigger_secret')) et renvoient 401
-- sinon (fail-closed). Les triggers notify_order_message /
-- notify_livreur_assignment envoient déjà ce header via net.http_post.
--
-- MAIS le trigger `notify-order-ready` (qui invoque send-order-notification)
-- utilise encore l'ANCIEN Database Webhook `supabase_functions.http_request(...)`
-- avec un JWT service_role EN DUR dans l'en-tête Authorization et SANS
-- `x-push-secret`. Conséquences : (a) la fonction le rejette (401) → les push de
-- changement de statut ne partent pas, et (b) la clé service_role est exposée
-- dans la définition du trigger.
--
-- Correctif : remplacer ce webhook par une fonction plpgsql `notify_order_status()`
-- qui appelle send-order-notification via net.http_post EN SIGNANT avec
-- `x-push-secret` (même mécanisme que les autres notifications). Bonus sécurité :
-- supprime le JWT service_role en dur.
--
-- ⚠️ Côté Edge : le secret doit être présent dans les secrets des Edge Functions.
--    Voir la commande `supabase secrets set PUSH_TRIGGER_SECRET=...` dans la PR.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  -- Ne notifier que sur un vrai changement de statut (évite un appel HTTP à
  -- chaque UPDATE : updated_at, position GPS, arrival_at, etc.).
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  perform net.http_post(
    url := 'https://ssmmstetcmgsjnjbjkat.supabase.co/functions/v1/send-order-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', public.internal_secret('push_trigger_secret')
    ),
    -- Forme « Database Webhook » déjà supportée par la fonction
    -- (record / old_record), qui sait aussi lire { order_id, status } en direct.
    body := jsonb_build_object(
      'type', tg_op,
      'table', 'orders',
      'record', to_jsonb(new),
      'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
    )
  );
  return new;
end;
$$;

REVOKE ALL ON FUNCTION public.notify_order_status() FROM public, anon, authenticated;

-- Bascule le trigger vers la nouvelle fonction signée et retire l'ancien webhook
-- (celui qui portait la service_role en dur).
DROP TRIGGER IF EXISTS "notify-order-ready" ON public.orders;
DROP TRIGGER IF EXISTS trg_order_status_notify ON public.orders;
CREATE TRIGGER trg_order_status_notify
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_status();
