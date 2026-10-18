// Small text helpers for matching place names: "Rawat Mishthan Bhandar" ≈ "Rawat Misthan Bhandar".

const STOP = new Set(['the', 'and', 'of', 'in', 'at', 'a', 'an', 'near', 'with', 'for', 'best', 'famous', 'shop', 'place', 'jaipur', 'udaipur', 'goa', 'varanasi', 'rishikesh', 'india']);

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9ऀ-ॿ]+/g, ' ')
    .trim();
}

/** Meaningful words, lightly stemmed ("cafes" → "cafe"). */
export function tokens(s: string): string[] {
  return normalizeName(s)
    .split(' ')
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
}

function trigrams(s: string): Set<string> {
  const t = `  ${normalizeName(s)} `;
  const out = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
}

/** Trigram Jaccard similarity, 0–1. Robust to small spelling differences. */
export function similarity(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / (A.size + B.size - inter);
}

// Words that appear in many business names and say nothing about which place it is.
const GENERIC = new Set(['mishthan', 'misthan', 'mishtan', 'bhandar', 'sweets', 'sweet', 'restaurant', 'cafe', 'hotel', 'dhaba', 'wala', 'wale', 'shop', 'store', 'kitchen', 'house', 'corner', 'centre', 'center', 'point', 'chai', 'tea']);

/** The words that identify a business: "Rawat Mishthan Bhandar" → ["rawat"]. */
export function distinctiveTokens(s: string): string[] {
  const t = tokens(s);
  const d = t.filter((w) => !GENERIC.has(w));
  return d.length ? d : t;
}

/** Same business name? Every distinctive word must appear (allowing small misspellings). */
export function sameBusiness(curated: string, candidate: string): boolean {
  const want = distinctiveTokens(curated);
  const have = tokens(candidate);
  return want.every((w) => have.some((h) => h === w || similarity(h, w) >= 0.6)) && similarity(curated, candidate) >= 0.35;
}
