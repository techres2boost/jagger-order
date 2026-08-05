CREATE OR REPLACE FUNCTION public.send_order_message(p_order_id uuid, p_sender_id uuid, p_content text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING errcode = '42501';
  END IF;

  IF p_sender_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Expéditeur non autorisé' USING errcode = '42501';
  END IF;

  IF NOT public.can_access_order_chat(p_order_id) THEN
    RAISE EXCEPTION 'Accès à cette conversation non autorisé' USING errcode = '42501';
  END IF;

  IF p_content IS NULL OR btrim(p_content) = '' OR length(p_content) > 2000 THEN
    RAISE EXCEPTION 'Message invalide' USING errcode = '22023';
  END IF;

  INSERT INTO public.order_messages (order_id, sender_id, content, created_at)
  VALUES (p_order_id, auth.uid(), btrim(p_content), NOW());
END;
$function$;

REVOKE ALL ON FUNCTION public.send_order_message(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_order_message(uuid, uuid, text) TO authenticated;