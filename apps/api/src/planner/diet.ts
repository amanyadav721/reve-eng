import type { TripPreferences } from '@tagalong/shared';

// A hard guardrail: never send a vegetarian to eat mutton. Keyword-based, so it catches the
// obvious cases the model gets wrong ("laal maas kachori"); it is not a full ingredient database.

type Diet = NonNullable<TripPreferences['diet']>;

const MEAT = /\b(laal\s*maas|lal\s*maas|safed\s*maas|mutton|chicken|lamb|goat|keema|kheema|kebab|kabab|seekh|tikka(?!\s*masala\s*paneer)|biryani|haleem|nihari|korma|fish|prawn|prawns|shrimp|crab|lobster|squid|calamari|pork|vindaloo|sorpotel|xacuti|beef|bacon|ham|sausage|salami|meat|non[\s-]?veg)\b/i;
const EGG = /\b(egg|eggs|omelette|omelet|anda|bhurji)\b/i;
const DAIRY = /\b(lassi|paneer|ghee|kulfi|rabri|rabdi|malai|malaiyo|curd|dahi|raita|butter|cheese|cream|milk|khoa|mawa|kheer|ghewar|rasmalai|rasgulla|shrikhand|chai|tea|coffee|ice\s*cream|kachori\s+mawa|mawa\s+kachori)\b/i;
const JAIN_EXTRA = /\b(onion|pyaaz|pyaz|garlic|lehsun|potato|aloo|carrot|beetroot|radish|mooli|ginger)\b/i;

/** Why this dish breaks the diet, or undefined if it looks fine. */
export function dietConflict(diet: Diet | undefined, dish: string): string | undefined {
  if (!diet || diet === 'nonveg') return undefined;
  if (MEAT.test(dish)) return 'contains meat or fish';
  if (diet === 'egg') return undefined;
  if (EGG.test(dish)) return 'contains egg';
  if (diet === 'vegan' && DAIRY.test(dish)) return 'contains dairy';
  if (diet === 'jain' && JAIN_EXTRA.test(dish)) return 'contains onion, garlic or root vegetables';
  return undefined;
}
