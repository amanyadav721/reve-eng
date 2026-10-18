import type { TransportMode } from '@tagalong/shared';

// Ride apps have no public fare APIs we can use (Uber forbids price comparison; Ola and Rapido
// have none), so fares are our own estimate, always shown as a range.
// Rates are rough Indian city averages for 2026 and should be tuned per city from real trips.

interface Rate {
  base: number;
  /** Kilometres included in the base fare. */
  baseKm: number;
  perKm: number;
  /** Spread for traffic, surge and bargaining: [low, high] multipliers. */
  spread: [number, number];
}

const RATES: Partial<Record<TransportMode, Rate>> = {
  auto: { base: 30, baseKm: 1.5, perKm: 16, spread: [0.9, 1.35] },
  cab: { base: 70, baseKm: 2, perKm: 18, spread: [0.9, 1.4] },
  scooter: { base: 25, baseKm: 1, perKm: 7, spread: [0.9, 1.3] },
};

export interface FareEstimate {
  minInr: number;
  maxInr: number;
}

export function estimateFare(mode: TransportMode, km: number): FareEstimate {
  if (km < 0 || !Number.isFinite(km)) throw new RangeError(`bad distance: ${km}`);
  if (mode === 'walk') return { minInr: 0, maxInr: 0 };
  if (mode === 'metro') return band(10 + Math.ceil(km / 3) * 10, 60);
  if (mode === 'bus') return band(10 + Math.ceil(km / 4) * 5, 50);
  if (mode === 'train') return band(10 + Math.ceil(km / 10) * 5, 200);

  const r = RATES[mode];
  if (!r) throw new Error(`no fare model for ${mode}`);
  const fare = r.base + Math.max(0, km - r.baseKm) * r.perKm;
  return { minInr: round10(fare * r.spread[0]), maxInr: Math.max(round10(fare * r.spread[0]) + 10, round10(fare * r.spread[1])) };
}

function band(value: number, cap: number): FareEstimate {
  const v = Math.min(value, cap);
  return { minInr: v, maxInr: v };
}

function round10(n: number): number {
  return Math.max(10, Math.round(n / 10) * 10);
}
