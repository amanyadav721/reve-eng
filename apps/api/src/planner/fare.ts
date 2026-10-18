import type { TransportMode } from '@tagalong/shared';

import { countryProfile, type Flat, type Rate } from '../places/countries.js';

// Ride apps have no public fare APIs we can use (Uber forbids price comparison; Ola and Rapido
// have none), so fares are our own estimate per country, always shown as a range, in local currency.

export interface FareEstimate {
  min: number;
  max: number;
}

/** Fare range for a ride, or undefined when we have no fare model for that mode in that country. */
export function estimateFare(mode: TransportMode, km: number, country = 'in'): FareEstimate | undefined {
  if (km < 0 || !Number.isFinite(km)) throw new RangeError(`bad distance: ${km}`);
  if (mode === 'walk') return { min: 0, max: 0 };
  const profile = countryProfile(country);
  const rule = profile.fares[mode];
  if (!rule) return undefined;
  const step = roundingStep(profile.currency);

  if ('flat' in rule) {
    const v = Math.min((rule as Flat).flat + (rule.perKm ?? 0) * km, rule.cap);
    // Transit fares are quoted precisely: ₹23, $2.50, ₫7,000.
    const r = roundTo(v, step === 1 ? 0.5 : step / 10);
    return { min: r, max: r };
  }
  const r = rule as Rate;
  const fare = r.base + Math.max(0, km - r.baseKm) * r.perKm;
  const min = Math.max(step, roundTo(fare * r.spread[0], step));
  return { min, max: Math.max(min + step, roundTo(fare * r.spread[1], step)) };
}

/** Round prices like people quote them: ₹10s, $1s, ₫1,000s. */
function roundingStep(currency: string): number {
  if (['INR', 'THB', 'LKR', 'NPR'].includes(currency)) return 10;
  if (['IDR', 'VND'].includes(currency)) return 1000;
  return 1;
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}
