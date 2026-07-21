import { useEffect, useRef, useState } from "react";

type CountdownStatus =
  | "pending"
  | "accepted"
  | "ready"
  | "delivering"
  | "delivered"
  | "refused"
  | "expired"
  | "cancelled";

// Champs nécessaires au décompte. On accepte n'importe quel objet commande qui
// les expose (page de détail comme carte de la liste).
interface CountdownOrder {
  status: CountdownStatus;
  arrival_at: string | null;
  estimated_delivery_at?: string | null;
}

const isTerminal = (status: CountdownStatus) =>
  status === "delivered" ||
  status === "refused" ||
  status === "expired" ||
  status === "cancelled";

/**
 * Décompte temps réel vers l'heure d'arrivée figée (prépa + trajet), calculée
 * une seule fois côté serveur dans `arrival_at`. On ne fait ici que du compte à
 * rebours : `arrival_at - now()` recalculé chaque seconde, sans jamais recalculer
 * le temps total. Repli sur `estimated_delivery_at` pour les commandes acceptées
 * avant la migration `arrival_at`.
 */
export function useOrderCountdown(order: CountdownOrder | null) {
  const [now, setNow] = useState(() => Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  // On coupe le tick uniquement sur un statut terminal ; il reste vivant pendant
  // pending/accepted/ready/delivering pour l'arrivée estimée.
  useEffect(() => {
    if (order != null && isTerminal(order.status) && tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, [order?.status]);

  const arrivalTarget = order ? (order.arrival_at ?? order.estimated_delivery_at ?? null) : null;

  const minutesRemaining = arrivalTarget
    ? Math.ceil((new Date(arrivalTarget).getTime() - now) / 60000)
    : null;

  const arrivalTime = arrivalTarget
    ? new Date(arrivalTarget).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const label =
    minutesRemaining == null
      ? null
      : minutesRemaining > 0
        ? `${minutesRemaining} min`
        : "Bientôt là";

  return { now, minutesRemaining, arrivalTime, label };
}
