import type { TransportMode } from '@tagalong/shared';

// How getting around and paying works in each country. Fares are rough city averages, used only
// for ranges ("$12–18"), and should be tuned from real trips. Countries without a fare model get
// travel times without prices rather than made-up numbers.

export interface Rate {
  base: number;
  /** Distance included in the base fare. */
  baseKm: number;
  perKm: number;
  /** Spread for traffic, surge and bargaining: [low, high] multipliers. */
  spread: [number, number];
}

/** Flat transit fare, possibly rising with distance, capped. */
export interface Flat {
  flat: number;
  perKm?: number;
  cap: number;
}

export interface CountryProfile {
  code: string;
  currency: string;
  /** Modes that exist here. "auto" is an auto-rickshaw or tuk-tuk; "scooter" is a bike taxi or rental. */
  modes: TransportMode[];
  /** What to call each mode for travelers here. */
  modeNames?: Partial<Record<TransportMode, string>>;
  fares: Partial<Record<TransportMode, Rate | Flat>>;
}

const P = (p: CountryProfile) => p;

export const COUNTRIES: Record<string, CountryProfile> = {
  in: P({
    code: 'in',
    currency: 'INR',
    modes: ['walk', 'auto', 'cab', 'metro', 'bus', 'train', 'scooter'],
    modeNames: { auto: 'auto-rickshaw', cab: 'cab (Ola/Uber)', scooter: 'bike taxi (Rapido) or rental scooter' },
    fares: {
      auto: { base: 30, baseKm: 1.5, perKm: 16, spread: [0.9, 1.35] },
      cab: { base: 70, baseKm: 2, perKm: 18, spread: [0.9, 1.4] },
      scooter: { base: 25, baseKm: 1, perKm: 7, spread: [0.9, 1.3] },
      metro: { flat: 10, perKm: 3.3, cap: 60 },
      bus: { flat: 10, perKm: 1.25, cap: 50 },
      train: { flat: 10, perKm: 0.5, cap: 200 },
    },
  }),
  us: P({
    code: 'us',
    currency: 'USD',
    modes: ['walk', 'cab', 'metro', 'bus', 'train', 'scooter'],
    modeNames: { cab: 'Uber/Lyft or taxi', scooter: 'e-scooter rental', metro: 'metro/rail' },
    fares: {
      cab: { base: 4, baseKm: 0, perKm: 1.6, spread: [0.9, 1.6] },
      scooter: { base: 1, baseKm: 0, perKm: 0.9, spread: [0.9, 1.2] },
      metro: { flat: 2.5, cap: 2.5 },
      bus: { flat: 2.5, cap: 2.5 },
      train: { flat: 3, perKm: 0.2, cap: 15 },
    },
  }),
  gb: P({
    code: 'gb',
    currency: 'GBP',
    modes: ['walk', 'cab', 'metro', 'bus', 'train', 'scooter'],
    modeNames: { cab: 'Uber or black cab', metro: 'Tube/metro' },
    fares: { cab: { base: 3.5, baseKm: 0, perKm: 2, spread: [0.9, 1.5] }, metro: { flat: 2.8, cap: 4 }, bus: { flat: 1.75, cap: 1.75 }, train: { flat: 4, perKm: 0.3, cap: 30 } },
  }),
  ae: P({
    code: 'ae',
    currency: 'AED',
    modes: ['walk', 'cab', 'metro', 'bus'],
    fares: { cab: { base: 12, baseKm: 0, perKm: 2.2, spread: [0.9, 1.4] }, metro: { flat: 4, perKm: 0.3, cap: 8.5 }, bus: { flat: 3, cap: 7.5 } },
  }),
  th: P({
    code: 'th',
    currency: 'THB',
    modes: ['walk', 'auto', 'cab', 'metro', 'bus', 'scooter'],
    modeNames: { auto: 'tuk-tuk', cab: 'Grab or taxi', scooter: 'motorbike taxi' },
    fares: {
      auto: { base: 60, baseKm: 1, perKm: 25, spread: [0.9, 1.6] },
      cab: { base: 45, baseKm: 1, perKm: 10, spread: [0.9, 1.4] },
      scooter: { base: 25, baseKm: 1, perKm: 10, spread: [0.9, 1.3] },
      metro: { flat: 17, perKm: 2, cap: 62 },
      bus: { flat: 10, cap: 25 },
    },
  }),
  sg: P({
    code: 'sg',
    currency: 'SGD',
    modes: ['walk', 'cab', 'metro', 'bus'],
    fares: { cab: { base: 4, baseKm: 1, perKm: 0.9, spread: [0.9, 1.4] }, metro: { flat: 1.2, perKm: 0.06, cap: 2.5 }, bus: { flat: 1.2, perKm: 0.06, cap: 2.5 } },
  }),
  id: P({
    code: 'id',
    currency: 'IDR',
    modes: ['walk', 'cab', 'scooter', 'bus'],
    modeNames: { cab: 'Grab/Gojek car', scooter: 'Gojek/Grab bike' },
    fares: { cab: { base: 15000, baseKm: 1, perKm: 4500, spread: [0.9, 1.5] }, scooter: { base: 10000, baseKm: 1, perKm: 2500, spread: [0.9, 1.4] } },
  }),
  vn: P({
    code: 'vn',
    currency: 'VND',
    modes: ['walk', 'cab', 'scooter', 'bus'],
    modeNames: { cab: 'Grab car or taxi', scooter: 'Grab bike' },
    fares: { cab: { base: 20000, baseKm: 1, perKm: 12000, spread: [0.9, 1.4] }, scooter: { base: 12000, baseKm: 1, perKm: 4500, spread: [0.9, 1.3] } },
  }),
  lk: P({
    code: 'lk',
    currency: 'LKR',
    modes: ['walk', 'auto', 'cab', 'bus', 'train'],
    modeNames: { auto: 'tuk-tuk' },
    fares: { auto: { base: 120, baseKm: 1, perKm: 100, spread: [0.9, 1.4] }, cab: { base: 250, baseKm: 1, perKm: 140, spread: [0.9, 1.4] } },
  }),
  np: P({
    code: 'np',
    currency: 'NPR',
    modes: ['walk', 'cab', 'bus', 'scooter'],
    fares: { cab: { base: 100, baseKm: 1, perKm: 60, spread: [0.9, 1.5] } },
  }),
};

// Euro countries share a profile.
for (const code of ['fr', 'de', 'it', 'es', 'nl', 'pt', 'at', 'be', 'gr', 'ie']) {
  COUNTRIES[code] = {
    code,
    currency: 'EUR',
    modes: ['walk', 'cab', 'metro', 'bus', 'train', 'scooter'],
    fares: { cab: { base: 4, baseKm: 0, perKm: 1.8, spread: [0.9, 1.5] }, metro: { flat: 2.1, cap: 2.5 }, bus: { flat: 2, cap: 2.5 }, train: { flat: 3, perKm: 0.15, cap: 40 } },
  };
}

/** Currencies for countries we don't have a full profile for yet. */
const CURRENCY: Record<string, string> = {
  ca: 'CAD', au: 'AUD', nz: 'NZD', jp: 'JPY', kr: 'KRW', cn: 'CNY', hk: 'HKD', tw: 'TWD', my: 'MYR', ph: 'PHP', mv: 'MVR', bt: 'BTN',
  bd: 'BDT', pk: 'PKR', tr: 'TRY', eg: 'EGP', za: 'ZAR', ke: 'KES', ma: 'MAD', mx: 'MXN', br: 'BRL', ar: 'ARS', ch: 'CHF', se: 'SEK',
  no: 'NOK', dk: 'DKK', pl: 'PLN', cz: 'CZK', hu: 'HUF', qa: 'QAR', sa: 'SAR', om: 'OMR', ge: 'GEL', az: 'AZN', ru: 'RUB',
};

/** A profile for any country: full if we have one, otherwise currency and common modes, no fares. */
export function countryProfile(code: string | undefined): CountryProfile {
  const c = (code ?? 'in').toLowerCase();
  return COUNTRIES[c] ?? { code: c, currency: CURRENCY[c] ?? 'USD', modes: ['walk', 'cab', 'bus', 'metro', 'train'], fares: {} };
}
