"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { haversineDistanceKm } from "@/lib/geo";

// Provider global du partage de position du livreur.
//
// Monté au niveau du layout authentifié (persistant, indépendant de l'écran ou
// du modal affiché). Il diffuse la position GPS du livreur pour CHAQUE commande
// qui lui est assignée au statut "delivering", dès qu'elle y passe et jusqu'à ce
// qu'elle soit livrée — sans dépendre du montage d'un quelconque écran/modal.
//
// - Une seule surveillance GPS (watchPosition + premier fix rapide) diffusée à
//   tous les channels `order-tracking-${orderId}` actifs.
// - Répond à l'event "request-position" (client qui rejoint) avec la dernière
//   position connue.
// - Inerte pour les comptes non-livreur (aucune fiche livreurs → rien ne tourne).
//
// Le statut (partage actif / signal perdu) est exposé via contexte pour que le
// modal de détail commande l'affiche en lecture seule ("Position partagée en
// direct"), sans être lui-même le déclencheur du broadcast.

const THROTTLE_MS = 5000;
const SIGNIFICANT_MOVE_KM = 0.015; // ~15 mètres

type PositionPayload = { lat: number; lng: number; heading: number | null; timestamp: number };

interface DriverBroadcastContextValue {
  // Commandes du livreur actuellement diffusées (statut "delivering").
  activeOrderIds: string[];
  // Vrai si le signal GPS est momentanément perdu (onglet masqué / erreur).
  gpsLost: boolean;
  // Vrai dès qu'au moins un channel de diffusion est abonné.
  broadcasting: boolean;
}

const DriverBroadcastContext = createContext<DriverBroadcastContextValue>({
  activeOrderIds: [],
  gpsLost: false,
  broadcasting: false,
});

export function useDriverBroadcast() {
  return useContext(DriverBroadcastContext);
}

export function DriverBroadcastProvider({ children }: { children: ReactNode }) {
  const [livreurId, setLivreurId] = useState<string | null>(null);
  const [activeOrderIds, setActiveOrderIds] = useState<string[]>([]);
  const [gpsLost, setGpsLost] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);

  // Partagés entre les cycles GPS (une seule surveillance quelle que soit la
  // liste de commandes) pour appliquer le throttle et rejouer la dernière
  // position aux nouveaux clients.
  const lastSentAtRef = useRef(0);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastPayloadRef = useRef<PositionPayload | null>(null);

  // 1) Résolution du livreur + suivi Realtime de ses commandes "delivering".
  useEffect(() => {
    // [DIAG] 1. Montage du provider.
    let mounted = true;
    let ordersChannel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!mounted || !u.user) return;
      const { data: livreur, error: livreurError } = await supabase
        .from("livreurs")
        .select("id")
        .eq("user_id", u.user.id)
        .maybeSingle();
      // [DIAG] 2. Résolution de la fiche livreur.
      // Compte non-livreur (ou accès refusé) : provider inerte.
      if (!mounted || !livreur) return;
      setLivreurId(livreur.id);

      const load = async () => {
        const { data, error } = await supabase
          .from("orders")
          .select("id")
          .eq("assigned_livreur_id", livreur.id)
          .eq("status", "delivering");
        const ids = ((data as Array<{ id: string }>) ?? []).map((o) => o.id);
        // [DIAG] 3. Résultat de la requête "commandes delivering assignées".
        if (mounted) setActiveOrderIds(ids);
      };
      await load();

      ordersChannel = supabase
        .channel(`driver-broadcast-orders-${livreur.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `assigned_livreur_id=eq.${livreur.id}`,
          },
          () => {
            load();
          },
        )
        .subscribe((status) => {});
    })();

    return () => {
      mounted = false;
      if (ordersChannel) supabase.removeChannel(ordersChannel);
    };
  }, []);

  // Clé stable : ne relance le cycle GPS/channels que si l'ensemble change.
  const activeKey = useMemo(() => [...activeOrderIds].sort().join(","), [activeOrderIds]);

  // 2) Surveillance GPS + diffusion, tant qu'au moins une commande est en cours.
  useEffect(() => {
    const ids = activeKey ? activeKey.split(",") : [];
    // [DIAG] Entrée de l'effet GPS/diffusion.
    if (!livreurId) return;
    if (ids.length === 0) {
      setBroadcasting(false);
      setGpsLost(false);
      return;
    }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      console.warn("[driver-broadcast] geolocation indisponible dans cet environnement");
      setGpsLost(true);
      return;
    }

    const channels: Array<ReturnType<typeof supabase.channel>> = [];

    const broadcastAll = (payload: PositionPayload) => {
      lastPayloadRef.current = payload;
      channels.forEach((ch) => {
        // [DIAG] 5. Position diffusée + channel utilisé.
        ch.send({ type: "broadcast", event: "position", payload });
      });
    };
    const emitPosition = (lat: number, lng: number, heading: number | null) => {
      broadcastAll({
        lat,
        lng,
        heading: Number.isFinite(heading) ? (heading as number) : null,
        timestamp: Date.now(),
      });
    };
    // Premier point rapide : précision standard + cache court accepté.
    const emitQuickFix = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsLost(false);
          emitPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.heading);
        },
        (err) => {
          // [DIAG] Erreur géoloc (souvent la cause : permission refusée / iframe /
          // contexte non sécurisé / timeout).
          console.warn(
            "[driver-broadcast] 4a. getCurrentPosition ÉCHEC — code",
            err.code,
            err.message,
          );
        },
        { enableHighAccuracy: false, maximumAge: 30000, timeout: 8000 },
      );
    };

    // Canaux privés : l'autorisation est vérifiée côté serveur (RLS sur
    // realtime.messages) — seul le livreur assigné peut diffuser sa position.
    supabase.realtime.setAuth();

    for (const orderId of ids) {
      const ch = supabase.channel(`order-tracking-${orderId}`, {
        config: { private: true, broadcast: { self: false } },
      });
      // Un client rejoint le suivi → on renvoie tout de suite la dernière position.
      ch.on("broadcast", { event: "request-position" }, () => {
        if (lastPayloadRef.current) {
          ch.send({ type: "broadcast", event: "position", payload: lastPayloadRef.current });
        } else {
          emitQuickFix();
        }
      });
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setBroadcasting(true);
          if (lastPayloadRef.current) {
            ch.send({ type: "broadcast", event: "position", payload: lastPayloadRef.current });
          } else {
            emitQuickFix();
          }
        }
      });
      channels.push(ch);
    }

    // Premier point immédiat, avant le fix haute précision de watchPosition.
    emitQuickFix();

    // [DIAG] 4. Démarrage de watchPosition.
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
        emitPosition(lat, lng, heading);
      },
      (err) => {
        console.warn("[driver-broadcast] 4. watchPosition ÉCHEC — code", err.code, err.message);
        setGpsLost(true);
      },
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
      channels.forEach((ch) => supabase.removeChannel(ch));
      lastSentAtRef.current = 0;
      lastPosRef.current = null;
      lastPayloadRef.current = null;
      setBroadcasting(false);
    };
  }, [livreurId, activeKey]);

  const value = useMemo<DriverBroadcastContextValue>(
    () => ({ activeOrderIds, gpsLost, broadcasting }),
    [activeOrderIds, gpsLost, broadcasting],
  );

  return (
    <DriverBroadcastContext.Provider value={value}>{children}</DriverBroadcastContext.Provider>
  );
}
