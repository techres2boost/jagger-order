// Coordonnées GPS fixes du restaurant, confirmées par le client.
export const RESTAURANT_LOCATION = { lat: 36.84130243040511, lng: 10.156443054054316 };

// Rayon de livraison (km) : au-delà, l'adresse est considérée hors zone.
export const DELIVERY_RADIUS_KM = 7;

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

// Distance à vol d'oiseau (km) entre deux points, formule de Haversine.
export function haversineDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(h));
}

// Coordonnées potentiellement invalides (null/undefined/NaN/0,0).
type MaybeCoords =
  { lat: number | null | undefined; lng: number | null | undefined } | null | undefined;

// Vrai uniquement si les coordonnées sont exploitables (ni nulles, ni NaN,
// ni le point 0,0 par défaut). Sert de garde partagée avant tout calcul.
export function hasValidCoords(coords: MaybeCoords): coords is { lat: number; lng: number } {
  if (!coords) return false;
  const { lat, lng } = coords;
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

// Distance (km) entre le restaurant et une adresse, ou null si les coordonnées
// ne sont pas exploitables. Factorise l'appel Haversine côté client.
export function deliveryDistanceKm(coords: MaybeCoords): number | null {
  if (!hasValidCoords(coords)) return null;
  return haversineDistanceKm(RESTAURANT_LOCATION, coords);
}

// Garde métier « adresse dans la zone de livraison ». Fail-closed : des
// coordonnées manquantes/invalides sont considérées HORS zone (on ne laisse
// jamais passer une commande faute de coordonnées).
export function isWithinDeliveryZone(coords: MaybeCoords): boolean {
  const distanceKm = deliveryDistanceKm(coords);
  return distanceKm != null && distanceKm <= DELIVERY_RADIUS_KM;
}
