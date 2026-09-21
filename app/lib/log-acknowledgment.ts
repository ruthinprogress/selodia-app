import { EVIDENCE_PRINCIPLE } from './principles';

// The conversational acknowledgment after a photo log (build item 10b, step 4).
//
// WHY THIS EXISTS. The parse-* routes save data and return the row; they were
// never designed to say anything. The warm reply lives only in ask-selodia, on
// the text path. So a photo log saved silently - a save toast and nothing else.
//
// WHY IT IS NOT A "FUNCTIONAL RECEIPT". ask-selodia's prompt forbids writing a
// "Logged: ..." line, because on the TEXT path the person has just spoken and
// the reply belongs to what they said; the toast carries the facts separately.
// A photo has no utterance to reply to. There is nothing to respond to except
// the reading itself, so here the facts ARE the substance rather than a
// restatement of it. Confirmed as a deliberate decision on 2026-08-26 after the
// conflict was raised, against real examples of Ruth's own logging voice.
//
// SHAPE, taken from those examples: a compact facts block, then a separate
// interpretive read. Two moves, not one paragraph. The facts are composed here,
// deterministically; only the read needs a model.

export type AckKind = 'body_measurement' | 'food' | 'activity';

// A compact, factual recent history. Present only when the caller genuinely has
// it, so its absence is meaningful: no block means no grounds for a comparison,
// which the voice guidance treats as a hard stop rather than an invitation.
export type RecentContext = { recent: string | null };

export type BodyFacts = RecentContext & {
  measuredAt: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  muscleKg: number | null;
  sourceApp: string | null;
  // Already gap-aware ("↗ +0.2 vs 3 days ago"), composed by the client where
  // formatWeeklyDelta lives. Null when there is nothing honest to compare to.
  deltaLabel: string | null;
  // The interpretation layer's own words for this reading, or null when it has
  // nothing to say. Never rewritten here - it has been through its own language
  // pass and its silences are deliberate.
  interpretation: string | null;
};

export type FoodFacts = RecentContext & {
  mealLabel: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  confidence: string | null;
  dayKcal: number | null;
  dayProteinG: number | null;
  kcalTarget: number | null;
  proteinTargetG: number | null;
  proteinNote: string | null;
};

export type ActivityFacts = RecentContext & {
  entries: {
    activityType: string;
    durationMin: number | null;
    kcalBurned: number | null;
    source: string | null;
  }[];
  // Present INSTEAD of entries when the photo was a whole-day tracker screen.
  // Kept as its own field rather than a funny-looking entry so the block below
  // cannot accidentally describe a day as a session.
  dailySummary: {
    date: string;
    steps: number | null;
    kcalBurned: number | null;
    activeKcal?: number | null;
    activeMinutes: number | null;
    distanceKm: number | null;
    source: string | null;
  } | null;
};

const n0 = (v: number | null): string | null => (v == null ? null : String(Math.round(v)));
const n1 = (v: number | null): string | null =>
  v == null ? null : String(Math.round(v * 10) / 10);

function longDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Today';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

// --- facts blocks ------------------------------------------------------------
// Plain lines rather than an aligned table: a chat bubble is variable-width, so
// columns would ragged out on a phone. The label carries the structure instead.

export function bodyFactsBlock(f: BodyFacts): string {
  const lines = [`${longDate(f.measuredAt)} · weigh-in logged`, ''];
  const w = n1(f.weightKg);
  lines.push(w ? `Weight ${w} kg${f.deltaLabel ? `  ${f.deltaLabel}` : ''}` : 'Weight not readable');
  const bf = n1(f.bodyFatPct);
  const mu = n1(f.muscleKg);
  if (bf) lines.push(`Body fat ${bf}%`);
  if (mu) lines.push(`Muscle ${mu} kg`);
  // Say what ISN'T there. A scale photo that captured only weight looks the
  // same as a full reading unless the absence is named - and the person cannot
  // tell whether it failed to read or their scale never measured it.
  if (!bf && !mu) lines.push("Body fat and muscle weren't in this one.");
  else if (!bf) lines.push("Body fat wasn't in this one.");
  else if (!mu) lines.push("Muscle wasn't in this one.");
  return lines.join('\n');
}

export function foodFactsBlock(f: FoodFacts): string {
  const parts = [n0(f.kcal) && `${n0(f.kcal)} kcal`, n0(f.proteinG) && `${n0(f.proteinG)}g protein`]
    .filter(Boolean)
    .join(' · ');
  const lines = [`${f.mealLabel} · logged`, ''];
  if (parts) lines.push(parts);
  const dayParts = [
    n0(f.dayKcal) && `${n0(f.dayKcal)}${f.kcalTarget ? ` / ${n0(f.kcalTarget)}` : ''} kcal`,
    n0(f.dayProteinG) && `${n0(f.dayProteinG)}${f.proteinTargetG ? ` / ${n0(f.proteinTargetG)}` : ''}g protein`,
  ]
    .filter(Boolean)
    .join(' · ');
  if (dayParts) lines.push(`Today so far: ${dayParts}`);
  // Low confidence is a real caveat about the number, so it is stated with the
  // number rather than buried in the prose.
  if (f.confidence && f.confidence.toLowerCase() === 'low') {
    lines.push('Rough estimate. Hard to be precise from a photo.');
  }
  return lines.join('\n');
}

export function activityFactsBlock(f: ActivityFacts): string {
  // A DAY, NOT A SESSION, AND SAID SO IN WORDS. The whole bug this fixes was a
  // day's total presented as a workout, so the acknowledgment has to be
  // explicit: nothing was logged as an activity, and the burn figure covers
  // everything the body did, including simply being alive.
  //
  // THIS BLOCK IS SHOWN TO HER, WORD FOR WORD. It once carried the model's
  // briefing ("Do not congratulate them...") and that text appeared on her
  // Activity screen. Anything meant only for the model goes in
  // activityModelNote below, never in here.
  if (f.dailySummary) {
    const d = f.dailySummary;
    const kcal = n0(d.activeKcal ?? null)
      ? `${n0(d.activeKcal ?? null)} kcal from moving`
      : null;
    const bits = [
      n0(d.steps) && `${Number(d.steps).toLocaleString('en-GB')} steps`,
      n0(d.activeMinutes) && `${n0(d.activeMinutes)} min active`,
      n1(d.distanceKm) && `${n1(d.distanceKm)} km`,
      kcal,
    ].filter(Boolean);
    return [
      `${longDate(d.date)} · daily summary saved`,
      '',
      bits.join(' · '),
      // The whole-day figure is real, but it is mostly the body simply being
      // alive. Shown second and labelled, so it cannot be read as exercise.
      n0(d.kcalBurned) ? `${Number(Math.round(d.kcalBurned as number)).toLocaleString('en-GB')} kcal across the whole day, resting included` : '',
      d.source ? `\nCounted by ${d.source}. Anything it wasn't on you for won't be in there.` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  const lines = ['Activity logged', ''];
  for (const e of f.entries) {
    const bits = [
      n0(e.durationMin) && `${n0(e.durationMin)} min`,
      n0(e.kcalBurned) && `${n0(e.kcalBurned)} kcal`,
    ]
      .filter(Boolean)
      .join(' · ');
    lines.push(bits ? `${e.activityType} · ${bits}` : e.activityType);
  }
  // A tracker only counts what it was worn for. Naming that is the same
  // discipline as naming a missing body-fat reading: the number is not wrong,
  // but it is not the whole day either.
  const tracked = f.entries.find((e) => e.source && e.source !== 'manual');
  if (tracked) {
    lines.push('', `Counted by ${tracked.source}. Anything it wasn't on you for won't be in there.`);
  }
  return lines.join('\n');
}

// Briefing for the model only. Never composed into the message she sees.
export function activityModelNote(f: ActivityFacts): string | null {
  if (!f.dailySummary) return null;
  return 'This is a whole day added up by a tracker, not a session they did. No activity was logged. Do not congratulate them on it as training and do not call it a workout.';
}

export function factsBlock(kind: AckKind, facts: BodyFacts | FoodFacts | ActivityFacts): string {
  if (kind === 'body_measurement') return bodyFactsBlock(facts as BodyFacts);
  if (kind === 'food') return foodFactsBlock(facts as FoodFacts);
  return activityFactsBlock(facts as ActivityFacts);
}

// --- the interpretive read ---------------------------------------------------

// Voice guidance for the one sentence or two that follow the facts. Written
// against real examples of how Ruth's own logging conversations read, not from
// a description of them - the qualities below are what those examples actually
// do, in the order they matter.
export const ACK_VOICE = `You are Selodía. Someone has just logged something by photographing it. The facts have already been shown to them in a short block directly above your words - you will be given that block. Write ONLY the read that follows it.

WHAT TO WRITE. One or two sentences. A specific read of what actually happened - what is notable in it, what is unremarkable, and, ONLY where a recent-history block is given below, how it sits against those particular numbers. Then a close that keeps things moving: an opening for what is next, or a light question, never a full stop that ends the exchange.

NEVER RESTATE THE FACTS. The numbers are already on screen immediately above you. Repeating them wastes the only two sentences you have and reads as filing paperwork back at them.

BE SPECIFIC OR SAY LESS. "Looking good, keep it up" is worse than silence. If the data genuinely supports nothing more than a plain observation, make the plain observation and stop - do not inflate it into encouragement.

NEVER INVENT A COMPARISON. You can see only what you are given. You do not know their history, their usual, their recent weeks, or their pattern unless it is written in front of you. Phrases like "in line with your usual", "middle of where you've been sitting lately", "on par with your recent walks" are FABRICATIONS unless the numbers behind them are in the material above - and a fabricated comparison about someone's own body is worse than saying nothing specific at all. When a recent-history block is provided, compare against those numbers and only those. When it is not, do not reach for a comparison; describe what is in front of you instead.

OBSERVE FIRST. INTERPRET FROM EVIDENCE. You are shown the reading and nothing about their day: no food, no salt, no training, no sleep, no cycle. So you may describe what the number did, and you may name a GENERAL, scientifically plausible possibility if it is clearly labelled as one and claims nothing about them - "day-to-day weight often moves with water, so one reading can't say much on its own". What you must never do is attribute this change to something about THEIR day, body or behaviour, because nothing you have been shown supports it: "yesterday was salty", "a hard session a day or two ago", "your cycle", "a short night" are fabrications about someone's own body however they are hedged - "might be the salty food" still points at salty food nobody logged. When there are several possible reasons, prefer curiosity to certainty: a light question is better than a guess.

HYDRATION IS THE ONE WORTH NAMING, and it is allowed on exactly these terms (Ruth said yes, 21 September 2026). Day-to-day weight moves with body water more than with anything else, and a person watching the scale move two pounds overnight is owed that fact - it is the difference between a number that frightens and a number that is understood. So you may say something like "a single day's weight moves with body water more than with anything else, so one reading on its own says very little". What you may NOT do is turn it towards her: "you're retaining water", "you look like you're holding fluid", "that'll be hydration" are claims about her body, and you have not been shown her drinking, her salt or anything else. The test is whether the sentence would be equally true of a stranger. If it would not, do not write it.

THE CHANGE ON SCREEN IS THE ONLY CHANGE. The facts block already states how this reading compares, and against when. Do not compute another difference, name another day, or put a different number on it. If the block says down 0.1 against two days ago, then "up 0.3 since yesterday" is a contradiction of what they are reading one line above.

DO NOT PRESCRIBE EQUIPMENT OR METHOD. If a reading is missing body fat or muscle, that is usually the scale, not a choice they made. Never suggest they use different scales, take a "fuller scan", or change how they measure.

BE HONEST ABOUT WHAT ISN'T THERE. If the facts block says something was missing or is a rough estimate, that is real context for how much weight the number carries. Name it plainly where it matters; do not apologise for it.

WARM, NOT EFFUSIVE. A knowledgeable friend who happens to know their numbers. No exclamation marks, no praise for the act of logging, no cheerleading. Never congratulate a direction of change in body weight.

WHEN AN INTERPRETATION IS SUPPLIED. You may be given a line from the interpretation layer - the app's own reading of the measurement. Treat it as already said: it will be shown to them verbatim. Do not repeat, rephrase, or contradict it. Write something that sits alongside it, or write nothing at all beyond a brief forward-looking line.

${EVIDENCE_PRINCIPLE}

If there is genuinely nothing worth saying, reply with exactly: NOTHING`;

// THE PROMPT IS NOT THE GUARD (2026-09-19).
//
// On 18 September a weigh-in photo was answered: "Weight's up 0.3 kg since
// yesterday, but yesterday was on the salty side and you had a hard session a
// day or two ago." Directly above it, the facts block read "Weight 56.5 kg,
// down 0.1 vs 2 days ago". Two inventions in one sentence. The causes were made
// up - this route is never shown food or activity for a body measurement - and
// the number contradicted the line she was reading one line higher. Ruth logged
// it as bug 11: "reference only what is there, and never invent context to
// sound reassuring."
//
// The prompt already forbade invented comparisons. It did not hold, which is
// the lesson of the nine duplicate dinners the same day: a rule the model is
// asked to follow is not a guard. So the read is checked in code before it is
// posted, and a read that fails is dropped - the facts and the app's own
// interpretation still go out, which is a true reply; a fabricated one is not.

// REFINED THE SAME DAY, TO RUTH'S PRINCIPLE (2026-09-19): "Observe first.
// Interpret from evidence." She was explicit that Selodia MAY "explain
// scientifically plausible possibilities (clearly labelled as possibilities)",
// and must not "confidently state causes that it has no evidence for... a
// weight increase should never be attributed to salty food, exercise, hormones
// or anything else unless the user has actually logged information supporting
// that interpretation." The first version of this guard dropped both, so it was
// stricter than the principle it was enforcing.
//
// So there are two lists, and the line between them is whether the words make
// a claim about HER.
//
// ATTRIBUTIONS name something she did or something about her body - food, salt,
// a session, her cycle, her sleep. This route is shown none of those, so any
// mention is an attribution without evidence, hedged or not: "might be the
// salty food" still points at salty food nobody logged.
const ATTRIBUTIONS = [
  /\bsalt(y|ier)?\b/i,
  /\bsodium\b/i,
  /\b(hard|heavy|big|tough) (session|workout|day)\b/i,
  /\b(workout|training|trained|gym|exercise)\b/i,
  /\b(period|cycle|luteal|hormon\w*)\b/i,
  /\b(sleep|slept)\b/i,
  /\bstress(ed|ful)?\b/i,
  /\b(carbs?|glycogen)\b/i,
  /\b(alcohol|wine|takeaway)\b/i,
];

// GENERAL MECHANISMS are physiology rather than biography: water moves weight
// from day to day in everybody. Naming one is allowed - but only as a labelled
// possibility, and only in a sentence that says nothing about her. "Weight
// often moves with water from day to day" passes; "you're probably retaining
// water" does not, because that is a claim about her body dressed as a
// mechanism.
const MECHANISMS = [
  /\bwater\b/i,
  /\bretain(ing|ed)?\b/i,
  /\bretention\b/i,
  /\bfluid\b/i,
  /\bbloat(ed|ing)?\b/i,
  /\bhydrat(ed|ion|ing)\b/i,
];
const LABELLED_POSSIBILITY =
  /\b(could|might|may|can|often|usually|sometimes|common(ly)?|normal(ly)?|possibl[ey]|tends? to)\b|\bday[- ]to[- ]day\b/i;
const ABOUT_HER =
  /\b(you|your|you're|youre|you've|youve|yours)\b|\b(yesterday|last night|this morning|today|tonight|this week)\b/i;

function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((t) => t.trim().length > 0);
}

/**
 * True when a body-measurement read gives a reason the data cannot support, or
 * puts a number on the change that is not on screen.
 *
 * `material` is everything the model was actually shown: the facts block, the
 * interpretation and any recent history. A number in the read that is in none
 * of those was produced by the model, not read from the data.
 */
export function readInventsContext(
  kind: AckKind,
  read: string | null,
  material: string
): boolean {
  if (!read || kind !== 'body_measurement') return false;
  if (ATTRIBUTIONS.some((re) => re.test(read))) return true;
  // A mechanism is judged sentence by sentence, because the label and the
  // claim have to sit together: "Water moves weight. You've had a salty week."
  // is a possibility in one sentence and an attribution in the next.
  for (const sentence of sentencesOf(read)) {
    if (!MECHANISMS.some((re) => re.test(sentence))) continue;
    if (!LABELLED_POSSIBILITY.test(sentence) || ABOUT_HER.test(sentence)) return true;
  }

  // Every measured-looking number must be one the model was given. Compared
  // without its sign, because "down 0.1" and "-0.1" are the same figure written
  // two ways and neither is an invention.
  const shown = new Set((material.match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(Number(n))));
  const claimed = read.match(/\d+(?:\.\d+)?(?=\s?(?:kg|%|kilos?|pounds?|lbs?|stone|st)\b)/gi) ?? [];
  return claimed.some((n) => !shown.has(String(Number(n))));
}

// The model is told to emit this when a read would be filler. Handled as a real
// answer rather than a failure: silence is often the right output, and the
// alternative is generic encouragement, which the examples above rule out.
export const ACK_NOTHING = 'NOTHING';

export function isEmptyAck(text: string | null | undefined): boolean {
  if (!text) return true;
  return text.trim().toUpperCase().replace(/[.!]$/, '') === ACK_NOTHING;
}

// Assembles what actually gets posted into the thread.
export function composeAcknowledgment(params: {
  facts: string;
  interpretation: string | null;
  read: string | null;
}): string {
  const blocks = [params.facts.trim()];
  // The interpretation goes before the model's read: it is the app's own
  // finding about the reading, and the read is written to sit alongside it.
  if (params.interpretation?.trim()) blocks.push(params.interpretation.trim());
  if (!isEmptyAck(params.read)) blocks.push((params.read as string).trim());
  return blocks.join('\n\n');
}
