export const PREP_MINUTES = 15;
const AVERAGE_SPEED_KMH = 25;

// estimated_ready_at = accepted_at + 15 min ; estimated_delivery_at = estimated_ready_at + temps de trajet.
export function computeEstimatedTimes(acceptedAt: Date, distanceKm: number | null) {
  const estimatedReadyAt = new Date(acceptedAt.getTime() + PREP_MINUTES * 60_000);
  const travelMinutes = distanceKm != null ? Math.ceil((distanceKm / AVERAGE_SPEED_KMH) * 60) : 0;
  const estimatedDeliveryAt = new Date(estimatedReadyAt.getTime() + travelMinutes * 60_000);
  return { estimatedReadyAt, estimatedDeliveryAt };
}
