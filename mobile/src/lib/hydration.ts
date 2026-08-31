// Hydration (Part Twelve, build item 31).
//
// A same-day wellbeing reflection, and one of the few things in this app that
// needs no research caveat: how much water someone has had affects how they
// feel and how they read on the scale, immediately and uncontroversially.
//
// EXPLICITLY NOT GAMIFIED. No streaks, no chain to break, no badges, no
// yesterday-versus-today. The spec is unusually blunt about this, so the shape
// of the data follows: only TODAY is ever computed here, because a module that
// could hand back a run of days would eventually be asked to.

// A sensible daily default. Deliberately a round, unfussy figure rather than a
// bodyweight formula: precision here would imply an accuracy that does not
// exist, and would invite exactly the target-chasing this is written against.
export const DAILY_TARGET_ML = 2000;

// Common measures, so "a glass" and "a mug" mean something without asking.
const GLASS_ML = 250;
const MUG_ML = 300;
const PINT_ML = 568;
const BOTTLE_ML = 500;

// The measures offered by the quick-tap (build item 26). Deliberately the same
// four the free-text parser already understands, and in the same millilitres -
// a tap and the sentence "a mug of tea" must not disagree about what a mug is.
//
// Four, not more. This is a shortcut for the common case, and a longer menu
// would recreate the typing it exists to remove. Anything unusual still goes
// through chat, where the parser handles explicit volumes.
export type QuickMeasure = { label: string; ml: number };
export const QUICK_MEASURES: QuickMeasure[] = [
  { label: 'Glass', ml: GLASS_ML },
  { label: 'Mug', ml: MUG_ML },
  { label: 'Bottle', ml: BOTTLE_ML },
  { label: 'Pint', ml: PINT_ML },
];

export type HydrationEntry = { ml: number; happened_at: string };

// Free text to millilitres, or null when there is no drink in it.
//
// Deliberately a small closed set of MEASURES, not of drinks - which is the
// distinction principle 13 actually draws. "How big is a pint" is a fixed fact
// with a right answer and no open-ended tail; "is this a drink" is the
// open-ended judgement, and that stays with the model at log time.
export function parseVolume(text: string): number | null {
  const t = text.toLowerCase();

  const explicit = /(\d+(?:\.\d+)?)\s*(ml|l|litres?|liters?)\b/.exec(t);
  if (explicit) {
    const n = Number(explicit[1]);
    if (!isFinite(n) || n <= 0) return null;
    return explicit[2] === 'ml' ? n : n * 1000;
  }

  const counted = /(\d+(?:\.\d+)?|a|an|another)\s*(glass(?:es)?|mugs?|cups?|pints?|bottles?)\b/.exec(t);
  if (counted) {
    const raw = counted[1];
    const count = raw === 'a' || raw === 'an' || raw === 'another' ? 1 : Number(raw);
    if (!isFinite(count) || count <= 0) return null;
    const unit = counted[2];
    const per = unit.startsWith('pint')
      ? PINT_ML
      : unit.startsWith('mug') || unit.startsWith('cup')
        ? MUG_ML
        : unit.startsWith('bottle')
          ? BOTTLE_ML
          : GLASS_ML;
    return count * per;
  }

  return null;
}

// Today's total against the target. Capped at 1 for the bar's width only - the
// underlying total is never clamped, because someone who drank three litres
// did drink three litres.
export function hydrationToday(
  entries: HydrationEntry[],
  now: Date = new Date()
): { ml: number; target: number; fraction: number } {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const ml = entries
    .filter((e) => {
      const t = new Date(e.happened_at).getTime();
      return !isNaN(t) && t >= startOfDay;
    })
    .reduce((s, e) => s + (e.ml > 0 ? e.ml : 0), 0);
  return { ml, target: DAILY_TARGET_ML, fraction: Math.min(ml / DAILY_TARGET_ML, 1) };
}

// "1.2L of about 2L" - the honest phrasing for a reflection rather than a score.
// No percentage, and no "to go": both turn a gentle reflection into a target to
// hit, which is precisely what the spec rules out.
export function hydrationLabel(ml: number, target: number = DAILY_TARGET_ML): string {
  const fmt = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}L` : `${Math.round(v)}ml`);
  return `${fmt(ml)} of about ${fmt(target)}`;
}
