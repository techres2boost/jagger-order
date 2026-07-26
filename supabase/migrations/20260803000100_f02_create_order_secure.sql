-- ============================================================================
-- F-02 (🟠) : le total de commande était fixé par le client (orders.total),
-- la policy INSERT ne validant que user_id. Un client pouvait donc insérer une
-- commande avec un total arbitraire (ex. 0) via un appel PostgREST direct.
--
-- Correctif : RPC SECURITY DEFINER `create_order_secure` qui RECALCULE tout
-- côté serveur à partir des tables menu (jamais un prix envoyé par le client) :
--   * prix de base   = menu_item_sizes.price (par format, ou la taille unique)
--   * suppléments    = option_items.price, UNIQUEMENT si le groupe est de type
--                      'supplement' ET si l'option est réellement rattachée à
--                      l'article (menu_item_option_groups) → pas d'option pirate
--   * adresse/coords = dérivées de la table addresses via address_id (et non
--                      des coordonnées envoyées par le client → ferme un 2e
--                      vecteur d'usurpation de zone de livraison)
--   * promo WELCOME10 = -10% validé serveur (réservé à la 1re commande réelle)
--   * total          = round(sous-total - remise, 3), jamais négatif
-- Insertion order + items + options ATOMIQUE (une seule transaction → règle
-- aussi le problème d'atomicité du checkout en 3 requêtes séparées).
--
-- Aucun paramètre `total`/`unit_price`/`option_price` n'est accepté : toute
-- valeur client est ignorée par construction (elle n'existe pas dans la
-- signature). Le trigger enforce_delivery_zone continue de valider lat/lng.
--
-- Enfin : REVOKE INSERT direct sur orders/order_items/order_item_options pour
-- forcer le passage par la RPC.
-- ============================================================================

-- Lien historique article commandé -> article menu (permet le « Recommander »
-- fiable et sert de référence de prix). Nullable : les commandes antérieures
-- restent valides (menu_item_id NULL).
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.create_order_secure(
  p_address_id uuid,
  p_special_instructions text,
  p_promo_code text,
  p_items jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_uid   uuid := auth.uid();
  v_name  text;
  v_phone text;
  v_addr  record;
  v_line  jsonb;
  v_item_id uuid;
  v_size    text;
  v_qty     int;
  v_note    text;
  v_opts    jsonb;
  v_available boolean;
  v_base    numeric;
  v_size_count int;
  v_opt_id    uuid;
  v_opt_name  text;
  v_opt_price numeric;
  v_opt_type  text;
  v_unit      numeric;
  v_subtotal  numeric := 0;
  v_order_id  uuid;
  v_order_item_id uuid;
  v_discount  numeric := 0;
  v_total     numeric;
  v_has_prior boolean;
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Panier vide';
  end if;

  -- Profil (nom/téléphone dérivés serveur, jamais du corps de requête).
  select full_name, phone into v_name, v_phone from public.profiles where id = v_uid;
  if v_name is null or btrim(v_name) = '' then
    raise exception 'Profil incomplet : nom requis';
  end if;

  -- Adresse : doit appartenir à l'utilisateur. On dérive coords/adresse/ville
  -- de la base (SECURITY DEFINER contourne la RLS → on filtre explicitement).
  select id, full_address, latitude, longitude, city
    into v_addr
  from public.addresses
  where id = p_address_id and user_id = v_uid;
  if v_addr.id is null then
    raise exception 'Adresse de livraison introuvable';
  end if;

  -- Création de la commande (total provisoire 0, figé après recalcul).
  -- BEFORE INSERT trigger enforce_delivery_zone valide lat/lng + fixe distance_km.
  insert into public.orders (
    user_id, customer_name, phone, total, expires_at,
    address, address_id, city, lat, lng, special_instructions, status
  ) values (
    v_uid, v_name, coalesce(v_phone, ''), 0, now() + interval '2 minutes',
    v_addr.full_address, v_addr.id, v_addr.city, v_addr.latitude, v_addr.longitude,
    nullif(btrim(coalesce(p_special_instructions, '')), ''), 'pending'
  ) returning id into v_order_id;

  -- Lignes du panier.
  for v_line in select value from jsonb_array_elements(p_items) as value
  loop
    v_item_id := (v_line->>'item_id')::uuid;
    v_size    := nullif(v_line->>'size', '');
    v_qty     := coalesce((v_line->>'qty')::int, 0);
    v_note    := nullif(v_line->>'note', '');
    v_opts    := coalesce(v_line->'options', '[]'::jsonb);

    if v_qty <= 0 then
      raise exception 'Quantité invalide pour l''article %', v_item_id;
    end if;

    select is_available into v_available from public.menu_items where id = v_item_id;
    if v_available is null then
      raise exception 'Article inconnu: %', v_item_id;
    end if;
    if v_available = false then
      raise exception 'Article indisponible: %', v_item_id;
    end if;

    -- Prix de base : par format si fourni, sinon la taille unique de l'article.
    if v_size is not null then
      select price into v_base
      from public.menu_item_sizes
      where menu_item_id = v_item_id and size_label = v_size;
      if v_base is null then
        raise exception 'Format « % » invalide pour l''article %', v_size, v_item_id;
      end if;
    else
      select count(*) into v_size_count
      from public.menu_item_sizes where menu_item_id = v_item_id;
      if v_size_count = 1 then
        select price into v_base
        from public.menu_item_sizes where menu_item_id = v_item_id;
      elsif v_size_count = 0 then
        raise exception 'Aucun tarif défini pour l''article %', v_item_id;
      else
        raise exception 'Format requis pour l''article %', v_item_id;
      end if;
    end if;

    v_unit := v_base;

    insert into public.order_items (order_id, menu_item_id, name, size, qty, unit_price, note)
    select v_order_id, v_item_id, mi.name, v_size, v_qty, 0, v_note
    from public.menu_items mi where mi.id = v_item_id
    returning id into v_order_item_id;

    -- Options : uniquement celles réellement rattachées à l'article ; prix
    -- comptabilisé seulement pour les groupes de type 'supplement'.
    for v_opt_id in
      select (jsonb_array_elements_text(v_opts))::uuid
    loop
      select oi.name, oi.price, og.type
        into v_opt_name, v_opt_price, v_opt_type
      from public.option_items oi
      join public.option_groups og on og.id = oi.group_id
      join public.menu_item_option_groups mog
        on mog.option_group_id = og.id and mog.menu_item_id = v_item_id
      where oi.id = v_opt_id;

      if v_opt_name is null then
        raise exception 'Option % non autorisée pour l''article %', v_opt_id, v_item_id;
      end if;

      if v_opt_type = 'supplement' then
        v_unit := v_unit + v_opt_price;
      else
        v_opt_price := 0;
      end if;

      insert into public.order_item_options (order_item_id, option_item_id, option_name, option_price)
      values (v_order_item_id, v_opt_id, v_opt_name, v_opt_price);
    end loop;

    update public.order_items set unit_price = v_unit where id = v_order_item_id;
    v_subtotal := v_subtotal + v_unit * v_qty;
  end loop;

  -- Promo WELCOME10 : -10% réservé à la première commande réelle de l'utilisateur.
  if upper(btrim(coalesce(p_promo_code, ''))) = 'WELCOME10' then
    select exists (
      select 1 from public.orders
      where user_id = v_uid
        and id <> v_order_id
        and status in ('pending','accepted','ready','delivering','delivered')
    ) into v_has_prior;
    if not v_has_prior then
      v_discount := round(v_subtotal * 0.10, 3);
    end if;
  end if;

  v_total := round(v_subtotal - v_discount, 3);
  if v_total < 0 then v_total := 0; end if;

  update public.orders set total = v_total where id = v_order_id;

  return v_order_id;
end;
$$;

-- Seuls les utilisateurs authentifiés peuvent créer une commande.
REVOKE EXECUTE ON FUNCTION public.create_order_secure(uuid, text, text, jsonb) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.create_order_secure(uuid, text, text, jsonb) TO authenticated;

-- Fermer l'insertion directe : la RPC (SECURITY DEFINER) devient le seul chemin
-- de création de commande. Les policies owner_insert deviennent inertes mais
-- restent en place (défense en profondeur si un GRANT était rétabli).
REVOKE INSERT ON public.orders             FROM anon, authenticated;
REVOKE INSERT ON public.order_items        FROM anon, authenticated;
REVOKE INSERT ON public.order_item_options FROM anon, authenticated;
