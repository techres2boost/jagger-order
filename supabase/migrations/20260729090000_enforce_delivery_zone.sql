-- Sécurité serveur : blocage des commandes hors zone de livraison.
--
-- Contexte : la validation Haversine côté client (src/lib/geo.ts) peut être
-- contournée (devtools, appel direct PostgREST). Ce trigger applique la MÊME
-- règle au niveau de la base, sur la table `orders`, et devient la source de
-- vérité de `distance_km`.
--
-- Règle : distance à vol d'oiseau (Haversine) entre les coordonnées de la
-- commande (orders.lat/lng) et le restaurant. Au-delà du rayon => rejet.
-- Fail-closed : coordonnées manquantes => rejet (on ne laisse jamais passer
-- une commande sans localisation vérifiable).
--
-- Constantes alignées sur src/lib/geo.ts :
--   restaurant = (36.84130243040511, 10.156443054054316)
--   rayon      = 7 km   |   rayon terrestre = 6371 km

CREATE OR REPLACE FUNCTION public.enforce_delivery_zone()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  rest_lat  CONSTANT double precision := 36.84130243040511;
  rest_lng  CONSTANT double precision := 10.156443054054316;
  radius_km CONSTANT double precision := 7;
  earth_km  CONSTANT double precision := 6371;
  d_lat double precision;
  d_lng double precision;
  h     double precision;
  dist_km double precision;
BEGIN
  -- Fail-closed : pas de coordonnées => impossible de vérifier la zone.
  IF NEW.lat IS NULL OR NEW.lng IS NULL THEN
    RAISE EXCEPTION 'Adresse de livraison sans coordonnées : commande impossible à valider.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Coordonnées 0,0 (point nul) : rejet également.
  IF NEW.lat = 0 AND NEW.lng = 0 THEN
    RAISE EXCEPTION 'Adresse de livraison invalide (coordonnées nulles).'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Formule de Haversine (identique au client).
  d_lat := radians(NEW.lat - rest_lat);
  d_lng := radians(NEW.lng - rest_lng);
  h := sin(d_lat / 2) ^ 2
       + cos(radians(rest_lat)) * cos(radians(NEW.lat)) * sin(d_lng / 2) ^ 2;
  dist_km := earth_km * 2 * asin(sqrt(h));

  IF dist_km > radius_km THEN
    RAISE EXCEPTION
      'Adresse hors de la zone de livraison (% km > rayon % km).',
      round(dist_km::numeric, 2), radius_km
      USING ERRCODE = 'check_violation';
  END IF;

  -- `distance_km` recalculée côté serveur = valeur autoritaire (le client ne
  -- peut pas la falsifier).
  NEW.distance_km := dist_km;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_enforce_delivery_zone ON public.orders;
CREATE TRIGGER trg_orders_enforce_delivery_zone
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_delivery_zone();
