// Protein-quality flagging (SELODIA_SPEC.md, Part Eight). The per-source
// classification is captured deterministically at log time (protein_source, per
// Part Two principle 13); the rules over it are fixed, not model-invented:
// collagen is always incomplete, plant proteins are incomplete (worth a
// complementary pairing), animal proteins need no flag. This module holds the
// day-level rule — pure and testable, in the interpretation-layer mould. The
// per-item flags (collagen "incomplete", plant "pair it") render with the
// itemised breakdown card (build item 13); this is the day-level nudge.

export type ProteinSource = 'animal' | 'plant' | 'collagen';

// Incomplete sources per Part Eight: collagen and plant. Animal is complete.
const INCOMPLETE_SOURCES: ProteinSource[] = ['plant', 'collagen'];
// A day reads as mostly-incomplete when MORE than half its protein comes from
// incomplete sources.
const INCOMPLETE_DAY_THRESHOLD = 0.5;
// Small buffer on the target, since plant protein is absorbed a little less
// efficiently (Part Eight's "100-105g rather than 95g").
const PROTEIN_BUFFER_FACTOR = 1.1;
// Below this there's too little protein logged so far to say anything meaningful.
const MIN_DAY_PROTEIN_G = 20;

export type ProteinQualityNudge = {
  incompleteShare: number; // 0-1, share of the day's protein from incomplete sources
  bufferedTarget: number | null; // rounded buffered target, when a base target is known
  message: string;
};

// Given a day's protein grouped by source (grams; a null source is protein whose
// source wasn't classified and counts only toward the total), decide whether the
// day-level nudge fires. Returns null when there's nothing to say — enough
// complete protein, or too little logged.
export function dayLevelProteinNudge(
  proteinBySource: { source: ProteinSource | null; grams: number }[],
  baseTargetG: number | null
): ProteinQualityNudge | null {
  const pos = (g: number) => (g > 0 ? g : 0);
  const total = proteinBySource.reduce((s, r) => s + pos(r.grams), 0);
  if (total < MIN_DAY_PROTEIN_G) return null;

  const incomplete = proteinBySource
    .filter((r) => r.source != null && INCOMPLETE_SOURCES.includes(r.source))
    .reduce((s, r) => s + pos(r.grams), 0);
  const incompleteShare = incomplete / total;
  if (incompleteShare <= INCOMPLETE_DAY_THRESHOLD) return null;

  const bufferedTarget =
    baseTargetG != null && baseTargetG > 0 ? Math.round(baseTargetG * PROTEIN_BUFFER_FACTOR) : null;
  const targetClause =
    bufferedTarget != null
      ? ` Plant protein is absorbed a little less efficiently, so nudging your target up a touch today (around ${bufferedTarget}g rather than ${Math.round(baseTargetG!)}g) covers the difference.`
      : '';
  const message =
    `Most of today's protein so far is from incomplete sources (collagen or plant). Pairing a complementary source (a grain alongside the legumes, or a little dairy) rounds out the amino acids.${targetClause}`;

  return { incompleteShare, bufferedTarget, message };
}

// Per-item protein-quality flags (build item 13's half of item 12). The same
// captured `protein_source` that drives the day-level nudge above, read one item
// at a time for the itemised breakdown card. Collagen is always incomplete;
// plant protein is complete enough in combination, so it gets a pairing nudge
// rather than a deficiency label; animal protein needs no flag at all.
//
// Returns null for anything with nothing to say — animal protein, an
// unclassified source (older rows predating item 12, or a food carrying
// negligible protein), or an item with no meaningful protein in it.
export function perItemProteinFlag(
  source: ProteinSource | null | undefined,
  grams: number | null | undefined
): string | null {
  if (grams == null || grams < MIN_ITEM_PROTEIN_G) return null;
  if (source === 'collagen') return 'incomplete';
  if (source === 'plant') return 'pair it';
  return null;
}

// Below this an item's protein is incidental (a splash of milk, a garnish) and
// flagging it would be noise on a card that should read calmly.
const MIN_ITEM_PROTEIN_G = 3;

// ---------------------------------------------------------------------------
// Meal-level amino-acid completeness (2026-08-27).
//
// WHY THIS EXISTS. The chat breakdown's commentary was built by mapping
// perItemProteinFlag over the items and writing a sentence from the result. On
// a real breakfast - banana, chia pudding, a spoon of 0% yoghurt, blueberries -
// it said "a grain or a little dairy alongside rounds out the amino acids",
// underneath a table that visibly contained yoghurt.
//
// The lesson is bigger than the bug. A per-item flag is scoped to ITS ITEM: "pair
// it" beside chia is true whatever else is on the plate. Lift the same flag into
// a sentence under the table and it silently becomes a claim about the WHOLE
// MEAL, which nothing checked. Per-item labels must never be promoted to
// meal-level prose without re-reasoning over the meal - which is what this does.
//
// It reasons over amino_profile, not protein_source: {animal, plant, collagen}
// cannot express complementarity, because complementarity is about WHICH amino
// acid is limiting. Legumes are methionine-limited, grains lysine-limited;
// together they are complete, and two legumes are not.

export type AminoProfile =
  | 'complete'
  | 'limiting_lysine'
  | 'limiting_methionine'
  | 'limiting_tryptophan';

const AMINO_PROFILES: AminoProfile[] = [
  'complete',
  'limiting_lysine',
  'limiting_methionine',
  'limiting_tryptophan',
];

// Valid-or-null, never valid-or-guess - the same contract as proteinSource, so a
// stray classification degrades to "we don't know" rather than to a wrong claim.
export const aminoProfile = (v: unknown): AminoProfile | null =>
  typeof v === 'string' && (AMINO_PROFILES as string[]).includes(v) ? (v as AminoProfile) : null;

// Below this a meal is not carrying meaningful protein, and amino-acid
// completeness is not a conversation worth having about it. The real case that
// exposed the bug was ~6.7g across a whole breakfast: the honest assessment
// there is silence, not advice. (The day-level nudge holds the same line at 20g
// for a whole day, and for the same reason.)
const MEAL_MIN_PROTEIN_G = 15;

// Below this share, the meal's protein is mostly complete already and its
// incomplete portion is a side note - saying anything would be nagging.
const INCOMPLETE_SHARE_FLOOR = 1 / 3;

// What it takes for a source to genuinely cover another's gap. EITHER threshold
// passes: complementation does not need equal amounts (5g of rice meaningfully
// complements 20g of lentils), but a garnish does not count - the 1g spoon of
// yoghurt that started all this fails both, as it should.
const COVERING_MIN_G = 5;
const COVERING_MIN_SHARE = 0.25;

export type AminoItem = {
  name: string;
  proteinG: number | null;
  aminoProfile: AminoProfile | null;
};

export type MealAminoAssessment = {
  // 'complete' when the meal's incomplete sources are genuinely covered;
  // 'short' when a gap really remains once everything present is accounted for.
  verdict: 'complete' | 'short';
  message: string;
};

function gramsWith(items: AminoItem[], profile: AminoProfile): number {
  return items
    .filter((i) => i.aminoProfile === profile)
    .reduce((s, i) => s + (i.proteinG && i.proteinG > 0 ? i.proteinG : 0), 0);
}

// Names in the order the items were LOGGED, so the sentence reads down the same
// order as the table above it. Grouping them by profile instead put "Basmati
// rice and Lentil dhal" under a table listing the dhal first.
function namesWith(items: AminoItem[], profiles: AminoProfile[]): string[] {
  return items
    .filter((i) => i.aminoProfile != null && profiles.includes(i.aminoProfile) && (i.proteinG ?? 0) > 0)
    .map((i) => i.name.trim());
}

// Names are kept EXACTLY as stored - lower-casing mangles brands, and the person
// wrote them. Every sentence below is built so its verb agrees with "protein",
// never with a food name, because no rule can pluralise an arbitrary one.
function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// Does this source contribute enough to genuinely cover a gap, rather than
// being a garnish that happens to be the right kind of food?
function covers(grams: number, mealTotal: number): boolean {
  return grams >= COVERING_MIN_G || (mealTotal > 0 && grams / mealTotal >= COVERING_MIN_SHARE);
}

// The whole meal, assessed together. Returns null when there is nothing honest
// and non-obvious to say, which is most meals - and deliberately so, since a
// line that fires on every log stops being read.
export function mealAminoAssessment(items: AminoItem[]): MealAminoAssessment | null {
  const total = items.reduce((s, i) => s + (i.proteinG && i.proteinG > 0 ? i.proteinG : 0), 0);
  if (total < MEAL_MIN_PROTEIN_G) return null;

  const complete = gramsWith(items, 'complete');
  const lysine = gramsWith(items, 'limiting_lysine');
  const methionine = gramsWith(items, 'limiting_methionine');
  const tryptophan = gramsWith(items, 'limiting_tryptophan');
  const incomplete = lysine + methionine + tryptophan;

  // Mostly complete protein already: the incomplete part is a side note.
  if (incomplete / total < INCOMPLETE_SHARE_FLOOR) return null;

  const completeCovers = covers(complete, total);
  // Grains and legumes cover each other's limiting acid. Each side has to be
  // present in a real amount for that to mean anything.
  const pairCovers = covers(lysine, total) && covers(methionine, total);
  // Collagen is short on tryptophan specifically, which any other real protein
  // source supplies - so it is covered by anything that is not itself collagen.
  const tryptophanCovered = tryptophan === 0 || covers(complete + lysine + methionine, total);

  if ((completeCovers || pairCovers) && tryptophanCovered) {
    const coveringNames = completeCovers
      ? namesWith(items, ['complete'])
      : namesWith(items, ['limiting_lysine', 'limiting_methionine']);
    return {
      verdict: 'complete',
      message: `The protein here is complete between the ${list(coveringNames)}. Nothing missing across this meal.`,
    };
  }

  // A real gap remains. Name the acid that is short and what supplies it, and
  // scope the reassurance to THE DAY - never to timing being irrelevant.
  //
  // THIS DISTINCTION IS DELIBERATE AND MUST NOT BE "TIDIED" INTO SOMETHING
  // SIMPLER (research, Ruth, 2026-08-27). Two different claims sit here:
  //   - That complementary proteins need not be eaten in the SAME MEAL for
  //     amino-acid adequacy is well established (Academy of Nutrition and
  //     Dietetics position, 2016), and superseded the 1970s protein-combining
  //     idea. Saying "later today rounds out the day" is squarely inside it.
  //   - Whether same-day-but-different-meal complementation is as effective as
  //     same-meal specifically for MUSCLE PROTEIN SYNTHESIS is NOT settled - it
  //     is open research, with a trial running because it has never been tested.
  // An earlier draft said "It doesn't have to be in the same meal", which reads
  // as the second claim, and this app's user lifts seriously - MPS is precisely
  // the outcome she is training for. So the copy stays in the supported lane and
  // makes no claim about timing for training purposes, in either direction.
  // See SELODIA_SPEC.md Resources for the citations.
  if (!tryptophanCovered) {
    return {
      verdict: 'short',
      message: `The protein here is mostly collagen, which is very low in tryptophan. Another protein source later today rounds out the day.`,
    };
  }

  const shortOn = lysine > methionine ? 'lysine' : 'methionine';
  const supplies =
    shortOn === 'lysine'
      ? 'legumes, dairy, eggs, fish or meat'
      : 'grains, nuts or seeds, or any animal source';
  return {
    verdict: 'short',
    message: `Nothing here supplies much ${shortOn}, so ${supplies} later today rounds out the day.`,
  };
}
