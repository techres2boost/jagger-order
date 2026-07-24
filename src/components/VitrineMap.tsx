"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import { RESTAURANT_LOCATION } from "@/lib/geo";

// Carte de localisation du site vitrine.
// - Réutilise Leaflet + tuiles OpenStreetMap, exactement comme le reste du
//   projet (AddAddress, DeliveryTrackingMap). Un <iframe> Google Maps serait
//   bloqué par la CSP de l'app, alors que ces tuiles sont autorisées.
// - Centrée sur les coordonnées réelles du restaurant (src/lib/geo.ts).
// - La carte entière est cliquable et ouvre l'itinéraire Google Maps.

const restaurantIcon = L.divIcon({
  className: "box-vitrine-marker",
  iconSize: [44, 44],
  iconAnchor: [22, 44],
  html: `
    <div style="position:relative;width:44px;height:44px;">
      <div style="position:absolute;left:50%;top:0;transform:translateX(-50%);width:36px;height:36px;border-radius:9999px 9999px 9999px 2px;transform-origin:center;rotate:45deg;background:#D40000;border:3px solid #ffffff;box-shadow:0 6px 14px rgba(0,0,0,0.4);"></div>
      <div style="position:absolute;left:50%;top:11px;transform:translateX(-50%);width:14px;height:14px;border-radius:9999px;background:#ffffff;"></div>
    </div>`,
});

const DIRECTIONS_URL = "https://maps.app.goo.gl/Csqubno1QwEvnAbw7";

export function VitrineMap() {
  // Leaflet dépend de `window` : on ne monte la carte qu'après hydratation.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <a
      href={DIRECTIONS_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block h-64 w-full overflow-hidden rounded-3xl border border-white/10 sm:h-80"
      aria-label="Ouvrir l'itinéraire vers Box dans Google Maps"
    >
      {mounted ? (
        <MapContainer
          center={[RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng]}
          zoom={16}
          className="h-full w-full"
          zoomControl={false}
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          attributionControl={false}
          style={{ pointerEvents: "none", filter: "saturate(1.05)" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker
            position={[RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng]}
            icon={restaurantIcon}
          />
        </MapContainer>
      ) : (
        <div className="h-full w-full bg-[#141414]" aria-hidden="true" />
      )}

      {/* Voile + libellé « itinéraire » au survol */}
      <div className="pointer-events-none absolute inset-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/55 via-transparent to-transparent p-4">
        <span className="rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white backdrop-blur">
          Voir l'itinéraire
        </span>
      </div>
    </a>
  );
}

export default VitrineMap;
