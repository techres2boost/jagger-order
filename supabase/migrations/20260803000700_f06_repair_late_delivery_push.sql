-- ============================================================================
-- F-06 (🟡) — RÉPARATION de trigger_late_delivery_push (choix : réparer).
--
-- État avant : fonction branchée au trigger on_late_delivery_notification
-- (AFTER INSERT ON admin_notifications WHEN type='commande_en_retard'), mais
-- cassée — URL placeholder « NOM_DE_TA_FONCTION » + en-tête
-- Authorization: Bearer current_setting('app.settings.service_role_key') (setting
-- NON défini en base, vérifié). Elle POSTait donc vers une URL inexistante.
--
-- Réparation :
--   * URL → vraie Edge Function `notify-admin-late-delivery`
--     (supabase/functions/notify-admin-late-delivery/, verify_jwt=false).
--   * Suppression de l'en-tête Authorization/service_role : on adopte le MÊME
--     pattern que les autres triggers pg_net du projet (notify_order_message,
--     process_delivery_assignments) qui postent avec seulement Content-Type.
--     Aucun secret n'est manipulé en SQL.
--   * search_path = public, pg_temp conservé (durcissement F-01).
--
-- Prérequis de déploiement (côté vous) : déployer la fonction
-- `notify-admin-late-delivery` et s'assurer que les secrets VAPID_PUBLIC_KEY /
-- VAPID_PRIVATE_KEY / SUPABASE_SERVICE_ROLE_KEY sont configurés (déjà utilisés
-- par les autres fonctions push).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_late_delivery_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
begin
  perform net.http_post(
    url := 'https://ssmmstetcmgsjnjbjkat.supabase.co/functions/v1/notify-admin-late-delivery',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'order_id', new.order_id,
      'message', new.message
    )
  );
  return new;
end;
$$;

-- Le durcissement des droits (REVOKE EXECUTE anon/authenticated) reste celui
-- posé par la migration F-01 ; CREATE OR REPLACE ne réattribue pas les droits.
-- On les repose ici par idempotence/sécurité.
REVOKE EXECUTE ON FUNCTION public.trigger_late_delivery_push() FROM public, anon, authenticated;
