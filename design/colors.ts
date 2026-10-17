// Color tokens for the app ("Golden hour"). Import from here; never hard-code hex values in screens.
// Contrast ratios (WCAG 2.1) are noted where a color carries text. 4.5 is the minimum for body text.
// Preview: design/ui-direction.html

export const palette = {
  // UI surfaces: calm, warm, paper-like
  peach: '#F7CFAA', // app background. Ink on it: 11.76. Cocoa on it: 4.95
  cream: '#FCE6CD', // cards. Ink on it: 14.10. Cocoa on it: 5.94
  creamLine: '#F1C79E', // card borders, dashed dividers
  sand: '#F8DDBF', // chips inside cards
  ink: '#231A14', // text, primary button, active tab
  cocoa: '#6E5142', // secondary text
  dune: '#8E6F5D', // inactive tab labels, placeholders (not for body text)

  // Sky (scene backgrounds; also the time-of-day system)
  sky: {
    top: '#3E56A8', // white text on it: 6.77
    mid: '#6F8FCB',
    haze: '#C7D3DA',
    glow: '#F6CDA4', // horizon at golden hour
    sun: '#F7C873',
    night: '#1B2147',
  },

  // Accents (from the city: walls, spice, fields)
  terracotta: '#B8482A', // "now", food, highlights. White text: 5.25
  soil: '#8C3B22',
  saffron: '#E9963A', // Laddoo's hat, warm accents. Ink text only.
  gold: '#F2B33D', // points, coins, rewards. Ink text: 9.18
  leaf: '#3F7A4E', // nature, success. White text: 5.12
  meadow: '#7DA857', // illustration ground
  grass: '#6A9A4A', // illustration foreground
  rose: '#E08A74', // Pink City walls
  hills: '#9AB0C2', // far mountains
} as const;

// Laddoo the elephant. Kept separate so the character stays on-model across art, Rive files and UI.
export const laddoo = {
  skin: '#9EACC8',
  skinShade: '#8F9DBB',
  body: '#94A2C0',
  ear: '#8C9ABA',
  earInner: '#F0A897',
  cheeks: '#F0A897',
  hat: palette.saffron,
  hatBrim: '#D9822B',
  hatBand: palette.terracotta,
  backpack: palette.terracotta,
  eyes: palette.ink,
} as const;

type Category = 'food' | 'sight' | 'transport' | 'nature' | 'culture' | 'shopping';
type Role =
  | 'bg' | 'surface' | 'surfaceChip' | 'border' | 'text' | 'textMuted' | 'textFaint'
  | 'primary' | 'onPrimary'
  | 'now' | 'onNow'
  | 'reward' | 'onReward'
  | 'success' | 'onSky';

export type Theme = Record<Role, string> & { category: Record<Category, string> };

export const light: Theme = {
  bg: palette.peach,
  surface: palette.cream,
  surfaceChip: palette.sand,
  border: palette.creamLine,
  text: palette.ink,
  textMuted: palette.cocoa,
  textFaint: palette.dune,

  primary: palette.ink, // the one black pill per screen
  onPrimary: palette.cream,

  now: palette.terracotta,
  onNow: '#FFFFFF',

  reward: palette.gold,
  onReward: palette.ink,

  success: palette.leaf,
  onSky: '#FFFFFF', // header text over the scene's sky

  category: {
    food: palette.terracotta,
    sight: palette.sky.top,
    transport: palette.cocoa,
    nature: palette.leaf,
    culture: palette.rose,
    shopping: palette.saffron,
  },
};

// Night: used after sunset, when the scene's sky turns indigo.
export const night: Theme = {
  bg: '#1E1A26',
  surface: '#2A2433',
  surfaceChip: '#352D40',
  border: '#3E3549',
  text: '#FCE6CD', // on bg: 14.09
  textMuted: '#C9AE98', // on surface: 7.14
  textFaint: '#8E7C70',

  primary: palette.cream,
  onPrimary: palette.ink,

  now: '#E07A5A',
  onNow: palette.ink, // 5.78

  reward: palette.gold,
  onReward: palette.ink,

  success: '#7FC48E',
  onSky: '#FFFFFF',

  category: {
    food: '#E07A5A',
    sight: '#8FA8E8',
    transport: '#C9AE98',
    nature: '#7FC48E',
    culture: '#F0A897',
    shopping: '#F2B36A',
  },
};
