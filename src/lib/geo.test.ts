import { describe, it, expect } from "vitest";
import {
  haversineDistanceKm,
  deliveryDistanceKm,
  isWithinDeliveryZone,
  hasValidCoords,
  RESTAURANT_LOCATION,
  DELIVERY_RADIUS_KM,
} from "@/lib/geo";

// Valeurs de référence ÉPINGLÉES sur le trigger Postgres `enforce_delivery_zone`
// (même formule Haversine, mêmes coords resto Jagger, earth = 6371). Calculées
// côté base :
//   inside  (36.80, 10.18) → 6.56179724702146 km
//   outside (36.90, 10.30) → 13.6225127717711 km
//   resto                  → 0 km
// Toute divergence TS↔SQL ferait échouer ces tests (garde anti-drift).
const INSIDE = { lat: 36.8, lng: 10.18 };
const OUTSIDE = { lat: 36.9, lng: 10.3 };
const SQL_INSIDE_KM = 6.56179724702146;
const SQL_OUTSIDE_KM = 13.6225127717711;

describe("haversineDistanceKm", () => {
  it("renvoie 0 pour deux points identiques (le restaurant)", () => {
    expect(haversineDistanceKm(RESTAURANT_LOCATION, RESTAURANT_LOCATION)).toBeCloseTo(0, 9);
  });

  it("correspond au trigger Postgres pour un point dans la zone", () => {
    expect(haversineDistanceKm(RESTAURANT_LOCATION, INSIDE)).toBeCloseTo(SQL_INSIDE_KM, 6);
  });

  it("correspond au trigger Postgres pour un point hors zone", () => {
    expect(haversineDistanceKm(RESTAURANT_LOCATION, OUTSIDE)).toBeCloseTo(SQL_OUTSIDE_KM, 6);
  });

  it("est symétrique (a→b == b→a)", () => {
    expect(haversineDistanceKm(INSIDE, OUTSIDE)).toBeCloseTo(
      haversineDistanceKm(OUTSIDE, INSIDE),
      9,
    );
  });
});

describe("hasValidCoords", () => {
  it("rejette null / undefined / NaN / (0,0)", () => {
    expect(hasValidCoords(null)).toBe(false);
    expect(hasValidCoords(undefined)).toBe(false);
    expect(hasValidCoords({ lat: null, lng: 10 })).toBe(false);
    expect(hasValidCoords({ lat: NaN, lng: 10 })).toBe(false);
    expect(hasValidCoords({ lat: 0, lng: 0 })).toBe(false);
  });

  it("accepte des coordonnées exploitables", () => {
    expect(hasValidCoords(INSIDE)).toBe(true);
  });
});

describe("deliveryDistanceKm", () => {
  it("renvoie null pour des coordonnées invalides", () => {
    expect(deliveryDistanceKm(null)).toBeNull();
    expect(deliveryDistanceKm({ lat: 0, lng: 0 })).toBeNull();
  });

  it("renvoie la distance depuis le restaurant pour des coordonnées valides", () => {
    expect(deliveryDistanceKm(INSIDE)).toBeCloseTo(SQL_INSIDE_KM, 6);
  });
});

describe("isWithinDeliveryZone", () => {
  it("accepte un point sous le rayon", () => {
    expect(SQL_INSIDE_KM).toBeLessThanOrEqual(DELIVERY_RADIUS_KM);
    expect(isWithinDeliveryZone(INSIDE)).toBe(true);
  });

  it("refuse un point au-delà du rayon", () => {
    expect(SQL_OUTSIDE_KM).toBeGreaterThan(DELIVERY_RADIUS_KM);
    expect(isWithinDeliveryZone(OUTSIDE)).toBe(false);
  });

  it("fail-closed : coordonnées invalides = hors zone", () => {
    expect(isWithinDeliveryZone(null)).toBe(false);
    expect(isWithinDeliveryZone({ lat: 0, lng: 0 })).toBe(false);
  });
});
