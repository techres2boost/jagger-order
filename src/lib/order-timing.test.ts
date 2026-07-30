import { describe, it, expect } from "vitest";
import { computeEstimatedTimes, PREP_MINUTES } from "@/lib/order-timing";

// Référence : estimated_ready_at = accepted_at + 15 min ;
// estimated_delivery_at = estimated_ready_at + ceil(distance / 25 km/h * 60) min.
const ACCEPTED = new Date("2026-07-01T12:00:00.000Z");

describe("computeEstimatedTimes", () => {
  it("ready = accepted + 15 min", () => {
    const { estimatedReadyAt } = computeEstimatedTimes(ACCEPTED, 5);
    expect(estimatedReadyAt.toISOString()).toBe("2026-07-01T12:15:00.000Z");
    expect(PREP_MINUTES).toBe(15);
  });

  it("delivery = ready + temps de trajet (arrondi au supérieur)", () => {
    // 5 km à 25 km/h = 12 min pile → ready(12:15) + 12 = 12:27
    const { estimatedDeliveryAt } = computeEstimatedTimes(ACCEPTED, 5);
    expect(estimatedDeliveryAt.toISOString()).toBe("2026-07-01T12:27:00.000Z");
  });

  it("arrondit le temps de trajet au supérieur (ceil)", () => {
    // 5.04867 km / 25 * 60 = 12.116… → ceil = 13 min → 12:15 + 13 = 12:28
    const { estimatedDeliveryAt } = computeEstimatedTimes(ACCEPTED, 5.04867030561614);
    expect(estimatedDeliveryAt.toISOString()).toBe("2026-07-01T12:28:00.000Z");
  });

  it("distance null → aucun temps de trajet (delivery = ready)", () => {
    const { estimatedReadyAt, estimatedDeliveryAt } = computeEstimatedTimes(ACCEPTED, null);
    expect(estimatedDeliveryAt.getTime()).toBe(estimatedReadyAt.getTime());
  });

  it("distance 0 → delivery = ready", () => {
    const { estimatedReadyAt, estimatedDeliveryAt } = computeEstimatedTimes(ACCEPTED, 0);
    expect(estimatedDeliveryAt.getTime()).toBe(estimatedReadyAt.getTime());
  });
});
