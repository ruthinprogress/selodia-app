// The conversational acknowledgment after a photo log (build item 10b, step 4).
//
// WHY THIS EXISTS. The parse-* routes save data and return the row; they were
// never designed to say anything. The warm reply lives only in ask-unflump, on
// the text path. So a photo log saved silently - a save toast and nothing else.
//
// WHY IT IS NOT A "FUNCTIONAL RECEIPT". ask-unflump's prompt forbids writing a
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
  const lines = [`${longDate(f.measuredAt)} — weigh-in logged`, ''];
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
  const lines = [`${f.mealLabel} — logged`, ''];
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
    lines.push('Rough estimate — hard to be precise from a photo.');
  }
  return lines.join('\n');
}

export function activityFactsBlock(f: ActivityFacts): string {
  const lines = ['Activity logged', ''];
  for (const e of f.entries) {
    const bits = [
      n0(e.durationMin) && `${n0(e.durationMin)} min`,
      n0(e.kcalBurned) && `${n0(e.kcalBurned)} kcal`,
    ]
      .filter(Boolean)
      .join(' · ');
    lines.push(bits ? `${e.activityType} — ${bits}` : e.activityType);
  }
  // A tracker only counts what it was worn for. Naming that is the same
  // discipline as naming a missing body-fat reading: the number is not wrong,
  // but it is not the whole day either.
  const tracked = f.entries.find((e) => e.source && e.source !== 'manual');
  if (tracked) {
    lines.push('', `Counted by ${tracked.source} — anything it wasn't on you for won't be in there.`);
  }
  return lines.join('\n');
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

DO NOT PRESCRIBE EQUIPMENT OR METHOD. If a reading is missing body fat or muscle, that is usually the scale, not a choice they made. Never suggest they use different scales, take a "fuller scan", or change how they measure.

BE HONEST ABOUT WHAT ISN'T THERE. If the facts block says something was missing or is a rough estimate, that is real context for how much weight the number carries. Name it plainly where it matters; do not apologise for it.

WARM, NOT EFFUSIVE. A knowledgeable friend who happens to know their numbers. No exclamation marks, no praise for the act of logging, no cheerleading. Never congratulate a direction of change in body weight.

WHEN AN INTERPRETATION IS SUPPLIED. You may be given a line from the interpretation layer - the app's own reading of the measurement. Treat it as already said: it will be shown to them verbatim. Do not repeat, rephrase, or contradict it. Write something that sits alongside it, or write nothing at all beyond a brief forward-looking line.

If there is genuinely nothing worth saying, reply with exactly: NOTHING`;

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
