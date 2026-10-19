import type { Memory, TripPreferences } from '@tagalong/shared';

import { words } from './importance.js';

// Laddoo remembers, and shows it, so it must never remember wrong. A reason that says "you love
// forts" or "you loved the bungee in Jodhpur" has to be backed by what the traveler told us: their
// interests or a memory. Claims we can't back go back to the model.

/** Everything the traveler told us that a reason may cite. Skips don't count as loves. */
export function knownAbout(memories: Memory[], prefs: Partial<Pick<TripPreferences, 'interests' | 'spice'>> = {}): Set<string> {
  const text = [
    ...(prefs.interests ?? []),
    ...memories.filter((m) => m.kind !== 'skip').flatMap((m) => [m.text, m.evidence]),
    prefs.spice === 'hot' || prefs.spice === 'medium' ? 'spice spicy heat fiery' : '',
  ];
  return new Set(text.flatMap(words).map(alias));
}

// Words that say how, not what: "you love a good little view" claims a view.
const FILLER = new Set([
  'the', 'and', 'that', 'this', 'those', 'these', 'your', 'all', 'any', 'some', 'good', 'great', 'nice', 'little', 'bit', 'lot', 'lots',
  'thing', 'kind', 'sort', 'stuff', 'really', 'very', 'such', 'whole', 'real', 'true', 'big', 'huge', 'old', 'new', 'best', 'local', 'classic',
  'vibe', 'energy', 'feel', 'feeling', 'moment', 'experience', 'everything', 'anything', 'something', 'them', 'one', 'way',
]);

/** Synonyms the traveler might use either way round: "foodie" ⇄ "food", "caffeine" ⇄ "cafe". */
function alias(w: string): string {
  if (w === 'foodie' || w === 'eating' || w === 'eat' || w === 'eats') return 'food';
  if (w === 'coffee' || w === 'caffe') return 'cafe';
  if (w === 'temples' || w === 'mandir') return 'temple';
  if (w === 'historic' || w === 'historical') return 'history';
  return w;
}

// What a claim is about ends at punctuation or a word that starts a new thought.
const OBJECT = String.raw`([^.,;:!?()—–"]{2,60})`;
const BREAK = /\s(?:so|but|which|that|who|here|there|in|at|from|on|back|during|when|while|with|more|than|every|today|now|because|since|before|after|and now|this|these|we|we're|it's|is|was)\b.*$/i;
const PATTERNS = [
  new RegExp(String.raw`\byou(?:'ve| have)?\s+(?:always\s+|really\s+|so\s+|truly\s+|totally\s+|just\s+)?(?:love|loved|adore|adored|enjoyed|liked|are\s+into|'re\s+into|are\s+(?:a\s+)?(?:big\s+|huge\s+)?fan\s+of|'re\s+(?:a\s+)?(?:big\s+|huge\s+)?fan\s+of|are\s+crazy\s+about|'re\s+crazy\s+about)\s+${OBJECT}`, 'gi'),
  new RegExp(String.raw`\byour\s+(?:love|passion|soft\s+spot|fondness)\s+(?:of|for)\s+${OBJECT}`, 'gi'),
  new RegExp(String.raw`\b(?:since|as|because)\s+you\s+like\s+${OBJECT}`, 'gi'),
  // "You are a true street-food lover", "as a history buff".
  /\b(?:you(?:'re| are)|as)\s+(?:a|an|such a|a true|a real|a big|the)?\s*([a-z]+(?:[- ][a-z]+)?)[- ](?:lover|buff|fanatic|nerd|junkie|enthusiast)\b/gi,
];

/**
 * The reason without the sentences that claim something we don't know, or undefined when nothing
 * honest is left.
 */
export function withoutInventedClaims(reason: string, known: Set<string>): string | undefined {
  const kept = reason.split(/(?<=[.!?])\s+/).filter((sentence) => !inventedClaims(sentence, known).length);
  const out = kept.join(' ').trim();
  return out.length >= 10 ? out : undefined;
}

/**
 * Loves and memories a reason claims that we have no record of, e.g. ["forts"] for "Since you love
 * forts, start at Amber". Empty when every claim is backed.
 */
export function inventedClaims(reason: string, known: Set<string>): string[] {
  const text = reason.replace(/\*\*/g, '').replace(/[‘’]/g, "'");
  const out: string[] = [];
  for (const re of PATTERNS) {
    for (const m of text.matchAll(re)) {
      // "If you love forts…" claims nothing.
      if (/\b(?:if|whether|in case|unless)\s+$/i.test(text.slice(Math.max(0, m.index - 12), m.index))) continue;
      const object = m[1].replace(BREAK, '').trim();
      // "forts and palaces": each one has to be backed.
      for (const part of object.split(/\s+(?:and|or|&)\s+|\//i)) {
        const content = words(part).map(alias).filter((w) => !FILLER.has(w));
        if (content.length && !content.some((w) => known.has(w))) out.push(part.trim());
      }
    }
  }
  return [...new Set(out)];
}
