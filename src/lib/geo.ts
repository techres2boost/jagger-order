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
