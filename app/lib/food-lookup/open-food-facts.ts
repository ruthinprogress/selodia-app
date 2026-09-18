import { foodWithoutQuantity, readQuantity } from './normalise';

// TIER 2: Open Food Facts (Part Eleven).
//
// Free, open, no API key, and strong on UK supermarket own-brands - which is why
// the spec makes it the primary database source ahead of USDA. McCance and
// Widdowson is the other half of tier 2 and is not built here: it is a
// downloadable dataset rather than an API, and importing it is its own job.
//
// WHAT THIS WILL AND WILL NOT ANSWER. Only a single weighed food - "73g boiled
// new potatoes" - because a per-100g source can only answer a question that
// carries a weight. Multiplying per-100g values by a weight somebody gave is
// arithmetic; deciding that "a handful of almonds" is 30g is a judgement, and
// judgements belong to the model. This is the line that keeps tier 2 honest.
//
// IT IS ALSO ALLOWED TO SAY NO, and says it often. A search that returns
// something unconvincing returns null and the log goes to the model as it always
// did. The failure mode being avoided is not "a missed saving"; it is somebody
// being shown a stranger's biscuit.

const SEARCH = 'https://world.openfoodfacts.org/cgi/search.pl';

// Open Food Facts asks every caller to identify itself, and throttles those who
// do not. This is a real address for a real app rather than a spoofed browser.
const USER_AGENT = 'Selodia/1.0 (https://selodia.app; hello@selodia.app)';

export type OffMatch = {
  name: string;
  per100: { kcal: number; protein_g: number; carbs_g: number; fat_g: number; sodium_mg: number | null };
  confidence: number;
  /** What the search was asked, for the audit trail. */
  query: string;
};

type OffProduct = {
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, unknown>;
};

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

// HOW SURE ARE WE THAT THIS IS THE SAME FOOD? Word overlap, both ways: every
// word of the query should appear in the product's name, and a product whose
// name says a great deal more than the query is probably a different, more
// specific thing ("potato waffles" for "potatoes").
export function scoreMatch(query: string, productName: string): number {
  const q = new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  const p = new Set(productName.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  if (q.size === 0 || p.size === 0) return 0;
  let hits = 0;
  for (const w of q) if (p.has(w)) hits++;
  const covered = hits / q.size;
  // How much of the product's own name the query accounts for. Low means the
  // product is saying something the person did not.
  const explained = hits / p.size;
  return covered * 0.75 + explained * 0.25;
}

/** The nutriments block, per 100g, or null when it is not complete enough to use. */
export function readNutriments(n: Record<string, unknown> | undefined): OffMatch['per100'] | null {
  if (!n) return null;
  const kcal = num(n['energy-kcal_100g']);
  const protein = num(n.proteins_100g);
  const carbs = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);
  // All four or nothing: a row with calories and no protein would silently log
  // zero protein, and zero is a claim.
  if (kcal == null || protein == null || carbs == null || fat == null) return null;
  if (kcal < 0 || kcal > 900) return null;
  const sodium = num(n.sodium_100g);
  return {
    kcal,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    // Open Food Facts stores sodium in grams per 100g.
    sodium_mg: sodium == null ? null : Math.round(sodium * 1000),
  };
}

/** The best Open Food Facts match for a single food, or null. */
export async function lookupFood(
  food: string,
  opts: { minConfidence?: number; fetchImpl?: typeof fetch } = {}
): Promise<OffMatch | null> {
  const minConfidence = opts.minConfidence ?? 0.8;
  const doFetch = opts.fetchImpl ?? fetch;

  const url =
    `${SEARCH}?search_terms=${encodeURIComponent(food)}` +
    '&search_simple=1&action=process&json=1&page_size=10' +
    // UK first, because the person is here and a US own-brand is a different
    // recipe under the same words.
    '&countries_tags_en=united-kingdom' +
    '&fields=product_name,brands,nutriments';

  let products: OffProduct[] = [];
  try {
    const res = await doFetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        // REQUIRED, and not obviously so. Node's fetch sends "Accept: */*" by
        // default, and Open Food Facts' edge answers that with a 503 - every
        // request failed until this was isolated by testing the headers one at a
        // time against a curl that worked. Without it the whole tier silently
        // never matches anything, which looks exactly like "no data available".
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      console.log('OFF: search returned', res.status);
      return null;
    }
    const body = (await res.json()) as { products?: OffProduct[] };
    products = Array.isArray(body.products) ? body.products : [];
  } catch (err) {
    // A database that is down is not an error anybody should hear about: the
    // model answers, exactly as it did before this existed.
    console.log('OFF: search failed -', err instanceof Error ? err.message : err);
    return null;
  }

  let best: OffMatch | null = null;
  for (const p of products) {
    const name = (p.product_name ?? '').trim();
    if (!name) continue;
    const per100 = readNutriments(p.nutriments);
    if (!per100) continue;
    const confidence = scoreMatch(food, name);
    if (!best || confidence > best.confidence) {
      best = { name, per100, confidence, query: food };
    }
  }

  if (!best || best.confidence < minConfidence) return null;
  return best;
}

/** per-100g values and a weight, multiplied. Arithmetic, not judgement. */
export function scaleToQuantity(per100: OffMatch['per100'], grams: number) {
  const f = grams / 100;
  const r = (v: number) => Math.round(v * f * 10) / 10;
  return {
    kcal: Math.round(per100.kcal * f),
    protein_g: r(per100.protein_g),
    carbs_g: r(per100.carbs_g),
    fat_g: r(per100.fat_g),
    sodium_mg: per100.sodium_mg == null ? null : Math.round(per100.sodium_mg * f),
  };
}

/** The whole of tier 2 for one entry, or null when it is not tier 2's question. */
export async function lookupWeighedEntry(
  rawText: string,
  opts: { minConfidence?: number; fetchImpl?: typeof fetch } = {}
) {
  const quantity = readQuantity(rawText);
  const food = foodWithoutQuantity(rawText);
  // Millilitres are left alone: density is not one, and treating 100ml of olive
  // oil as 100g would be wrong by a fifth.
  if (!quantity || !('grams' in quantity) || !food) return null;

  const match = await lookupFood(food, opts);
  if (!match) return null;

  return {
    ...scaleToQuantity(match.per100, quantity.grams),
    source: 'open_food_facts' as const,
    confidence: match.confidence,
    matchedName: match.name,
  };
}
