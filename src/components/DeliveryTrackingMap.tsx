"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Carte de suivi côté client (statut 'delivering' uniquement).
// - Même config Leaflet + OpenStreetMap que le reste du projet (cf. AddAddress).
// - Marker fixe = adresse de livraison ; marker mobile = position du livreur.
// - Subscribe au channel `order-tracking-${orderId}`, event "position".
// - Sans position reçue depuis 30 s → message d'attente.

// Fix icône Leaflet par défaut pour les bundlers (identique à AddAddress).
const destinationIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Icône scooter du livreur : divIcon SVG (charte rouge/blanc/noir, sans emoji).
const scooterIcon = L.divIcon({
  className: "box-scooter-marker",
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  html: `
    <div style="width:40px;height:40px;border-radius:9999px;background:#e11d2e;border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18.5" cy="17.5" r="3.5"/>
        <circle cx="5.5" cy="17.5" r="3.5"/>
        <path d="M15 6a1 1 0 0 0 0-2h-1v3l3 5h-8l4-6"/>
        <path d="M5.5 17.5 9 9"/>
        <path d="M12 6h4"/>
      </svg>
    </div>`,
});

type DriverPos = { lat: number; lng: number };

// Ajuste la vue : les deux marqueurs si le livreur est visible, sinon la destination.
function AutoView({ dest, driver }: { dest: DriverPos; driver: DriverPos | null }) {
  const map = useMap();
  useEffect(() => {
    if (driver) {
      map.fitBounds(L.latLngBounds([dest.lat, dest.lng], [driver.lat, driver.lng]).pad(0.4), {
        animate: true,
      });
    } else {
      map.setView([dest.lat, dest.lng], 16, { animate: true });
    }
  }, [map, dest, driver]);
  return null;
}

export function DeliveryTrackingMap({
  orderId,
  destLat,
  destLng,
}: {
  orderId: string;
  destLat: number;
  destLng: number;
}) {
  const [driver, setDriver] = useState<DriverPos | null>(null);
  const [lastPositionAt, setLastPositionAt] = useState<number | null>(null);
  const [stale, setStale] = useState(true);
  // Phase de connexion initiale : on affiche un état de chargement explicite les
  // premières secondes plutôt qu'une attente silencieuse.
  const [connecting, setConnecting] = useState(true);
  const dest = useRef<DriverPos>({ lat: destLat, lng: destLng }).current;
  const mountedAtRef = useRef(Date.now());

  // Abonnement immédiat au broadcast de position du livreur, dès l'arrivée sur
  // la page. À l'abonnement, on demande sa dernière position connue au livreur
  // (event "request-position") pour ne pas attendre le prochain cycle GPS.
  useEffect(() => {
    const channel = supabase.channel(`order-tracking-${orderId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "position" }, ({ payload }) => {
        const p = payload as { lat?: number; lng?: number };
        if (typeof p.lat !== "number" || typeof p.lng !== "number") return;
        setDriver({ lat: p.lat, lng: p.lng });
        setLastPositionAt(Date.now());
        setStale(false);
        setConnecting(false);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({ type: "broadcast", event: "request-position", payload: {} });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  // États dérivés : "connexion" les ~5 premières secondes sans position, puis
  // "en attente" (aucune position, ou plus rien reçu depuis 30 s).
  useEffect(() => {
    const t = setInterval(() => {
      const hasPosition = lastPositionAt != null;
      setStale(!hasPosition || Date.now() - (lastPositionAt as number) > 30000);
      setConnecting(!hasPosition && Date.now() - mountedAtRef.current < 5000);
    }, 1000);
    return () => clearInterval(t);
  }, [lastPositionAt]);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="relative h-64 w-full">
        <MapContainer
          center={[dest.lat, dest.lng]}
          zoom={16}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <Marker position={[dest.lat, dest.lng]} icon={destinationIcon} />
          {driver && <Marker position={[driver.lat, driver.lng]} icon={scooterIcon} />}
          <AutoView dest={dest} driver={driver} />
        </MapContainer>
      </div>
      {connecting ? (
        <div className="flex items-center justify-center gap-2 border-t bg-secondary px-3 py-2 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Connexion au suivi en direct…
        </div>
      ) : stale ? (
        <div className="flex items-center justify-center gap-2 border-t bg-secondary px-3 py-2 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          En attente de la position du livreur…
        </div>
      ) : null}
    </div>
  );
}
