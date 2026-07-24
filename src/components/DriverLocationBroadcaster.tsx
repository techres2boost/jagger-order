"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { haversineDistanceKm } from "@/lib/geo";
import { Navigation, WifiOff } from "lucide-react";

// Monté uniquement sur l'écran de livraison active du livreur (statut 'delivering').
// - navigator.geolocation.watchPosition (foreground), throttle ~5s ou déplacement
//   significatif (> ~15 m).
// - Broadcast Supabase Realtime (pas de stockage) sur le channel
//   `order-tracking-${orderId}`, event "position" : { lat, lng, heading, timestamp }.
// - Perte de signal / onglet masqué → badge "Signal GPS perdu" (ne bloque rien).
// - Cleanup complet (stop watchPosition + unsubscribe) au démontage / statut changé.

const THROTTLE_MS = 5000;
const SIGNIFICANT_MOVE_KM = 0.015; // ~15 mètres

export function DriverLocationBroadcaster({
  orderId,
  active,
}: {
  orderId: string;
  active: boolean;
}) {
  const [gpsLost, setGpsLost] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);

  const lastSentAtRef = useRef(0);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGpsLost(true);
      return;
    }

    const channel = supabase.channel(`order-tracking-${orderId}`, {
      config: { broadcast: { self: false } },
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") setBroadcasting(true);
    });

    function broadcast(lat: number, lng: number, heading: number | null) {
      channel.send({
        type: "broadcast",
        event: "position",
        payload: { lat, lng, heading, timestamp: Date.now() },
      });
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsLost(false);
        const { latitude: lat, longitude: lng, heading } = pos.coords;
        const now = Date.now();
        const moved = lastPosRef.current
          ? haversineDistanceKm(lastPosRef.current, { lat, lng })
          : Infinity;
        // Throttle : on n'émet que toutes les ~5 s, sauf déplacement significatif.
        if (now - lastSentAtRef.current < THROTTLE_MS && moved < SIGNIFICANT_MOVE_KM) return;
        lastSentAtRef.current = now;
        lastPosRef.current = { lat, lng };
        broadcast(lat, lng, Number.isFinite(heading) ? heading : null);
      },
      () => setGpsLost(true),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    // Onglet masqué : le foreground GPS n'est plus fiable → on signale la perte.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") setGpsLost(true);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
      lastSentAtRef.current = 0;
      lastPosRef.current = null;
      setBroadcasting(false);
    };
  }, [orderId, active]);

  if (!active) return null;

  return (
    <div
      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
        gpsLost ? "bg-destructive/15 text-destructive" : "bg-brand/10 text-brand"
      }`}
    >
      {gpsLost ? (
        <>
          <WifiOff className="h-4 w-4" />
          Signal GPS perdu
        </>
      ) : (
        <>
          <Navigation className="h-4 w-4" />
          {broadcasting ? "Position partagée en direct" : "Activation du partage…"}
        </>
      )}
    </div>
  );
}
