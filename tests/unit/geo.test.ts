import { describe, it, expect } from "vitest";
import { haversineMeters } from "@/lib/business/geo";

describe("haversineMeters", () => {
  const ikebukuro = { latitude: 35.729503, longitude: 139.71086 };

  it("同じ地点は0m", () => {
    expect(haversineMeters(ikebukuro, ikebukuro)).toBe(0);
  });

  it("緯度0.001度の差は約111m", () => {
    const north = {
      latitude: ikebukuro.latitude + 0.001,
      longitude: ikebukuro.longitude,
    };
    expect(haversineMeters(ikebukuro, north)).toBeCloseTo(111, 0);
  });

  it("池袋〜新宿は約4.4km", () => {
    const shinjuku = { latitude: 35.690921, longitude: 139.700258 };
    const distance = haversineMeters(ikebukuro, shinjuku);
    expect(distance).toBeGreaterThan(4300);
    expect(distance).toBeLessThan(4500);
  });

  it("向きを入れ替えても同じ距離になる", () => {
    const shinjuku = { latitude: 35.690921, longitude: 139.700258 };
    expect(haversineMeters(ikebukuro, shinjuku)).toBeCloseTo(
      haversineMeters(shinjuku, ikebukuro),
      6
    );
  });
});
