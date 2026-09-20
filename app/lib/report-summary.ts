import Anthropic from '@anthropic-ai/sdk';

import type { ReportData } from './report';

// THE SUMMARY AT THE TOP OF A REPORT (2026-09-20).
//
// Ruth's rule, and the whole architecture of this file: "AI should analyse the
// selected data. AI should not decide what data is selected." She chose the
// blocks; this writes a paragraph about what is in them and nothing else.
//
// AND THE OTHER HALF OF HER POINT: "if the data is just the data collected,
// the report can't be dismissed as AI dumps, it's the true collected data,
// with a summary for convenience." A summary that quietly invents a number
// destroys exactly that - one wrong figure and a clinician is right to
// disbelieve the pages behind it. So:
//
// ARITHMETIC IS DONE IN CODE, NEVER BY THE MODEL. `facts()` counts, averages,
// spans and ranges here, in TypeScript, and hands the model the answers. The
// model writes prose about figures it was given. This is the same division the
// weigh-in acknowledgement already uses - facts block, then interpretation -
// and for the same reason: a language model doing mental arithmetic over forty
// rows is a plausible wrong number waiting to happen.
//
// AND THE GUARD IS AT THE WRITE, not in the prompt. `withoutInvention()` reads
// every number out of the summary and drops any sentence carrying one the
// facts never contained. The prompt asks too, because asking is free and
// mostly works - but a rule the model is asked to follow is not a guard.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-5';

/** What the summary is allowed to know: figures this file worked out itself. */
export type ReportFacts = {
  lines: string[];
  /** Every number the lines contain, as written, for the guard to check against. */
  numbers: Set<string>;
};

function round(n: number): number {
  return Math.round(n);
}

function mean(values: number[]): number | null {
  const usable = values.filter((v) => Number.isFinite(v));
  if (usable.length === 0) return null;
  return usable.reduce((a, b) => a + b, 0) / usable.length;
}

function readings(n: number): string {
  return `${n} ${n === 1 ? 'reading' : 'readings'}`;
}

function dayCount(days: string[]): number {
  return new Set(days.map((d) => d.slice(0, 10))).size;
}

function hoursAndMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * THE FACTS BLOCK. Every figure the summary may use, counted here.
 *
 * It deliberately says how MUCH was recorded as well as what it showed,
 * because "nine nights out of thirty" is the difference between a pattern and
 * an impression, and a clinician reading a summary needs to know which they
 * have.
 */
export function facts(data: ReportData): ReportFacts {
  const lines: string[] = [];

  lines.push(`Period covered: ${data.periodLabel}.`);

  if (data.weights.length > 0) {
    const weights = data.weights.map((w) => w.weight).filter((w): w is number => w != null);
    if (weights.length > 0) {
      const first = weights[weights.length - 1];
      const last = weights[0];
      lines.push(
        `Weight: ${readings(weights.length)}, from ${first.toFixed(1)} kg to ${last.toFixed(1)} kg.`
      );
    }
    const fats = data.weights.map((w) => w.fat).filter((f): f is number => f != null);
    if (fats.length > 0) {
      lines.push(
        `Body fat: ${readings(fats.length)}, from ${fats[fats.length - 1].toFixed(1)}% to ${fats[0].toFixed(1)}%.`
      );
    }
  }

  // Each measure separately: an average across waist and resting heart rate
  // would be a number about nothing.
  const byMetric = new Map<string, string[]>();
  for (const m of data.metrics) {
    byMetric.set(m.name, [...(byMetric.get(m.name) ?? []), m.value]);
  }
  for (const [name, values] of byMetric) {
    lines.push(`${name}: ${readings(values.length)}, most recent ${values[0]}.`);
  }

  if (data.food.length > 0) {
    const days = data.food.length;
    const kcal = mean(data.food.map((f) => f.kcal));
    const protein = mean(data.food.map((f) => f.protein));
    lines.push(
      `Food: ${days} ${days === 1 ? 'day' : 'days'} logged` +
        (kcal != null ? `, averaging ${round(kcal)} kcal` : '') +
        (protein != null ? ` and ${round(protein)} g protein a day` : '') +
        '.'
    );
  }

  if (data.water.length > 0) {
    const ml = mean(data.water.map((w) => w.ml));
    lines.push(
      `Drinks: ${data.water.length} ${data.water.length === 1 ? 'day' : 'days'} logged` +
        (ml != null ? `, averaging ${round(ml)} ml a day` : '') +
        '.'
    );
  }

  if (data.sleep.length > 0) {
    const minutes = data.sleep.map((s) => s.minutes).filter((m): m is number => m != null);
    const avg = mean(minutes);
    lines.push(
      `Sleep: ${data.sleep.length} ${data.sleep.length === 1 ? 'night' : 'nights'} described` +
        (avg != null ? `, averaging ${hoursAndMinutes(avg)}` : '') +
        '.'
    );
    const qualities = data.sleep.map((s) => s.quality).filter((q): q is string => Boolean(q));
    if (qualities.length > 0) {
      const counts = new Map<string, number>();
      for (const q of qualities) counts.set(q, (counts.get(q) ?? 0) + 1);
      lines.push(
        'How those nights felt: ' +
          [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([q, n]) => `${q} ${n}`)
            .join(', ') +
          '.'
      );
    }
  }

  if (data.activity.length > 0) {
    const sessions = data.activity.length;
    const days = dayCount(data.activity.map((a) => a.at));
    const minutes = data.activity.map((a) => a.minutes).filter((m): m is number => m != null);
    const total = minutes.reduce((a, b) => a + b, 0);
    const kinds = new Map<string, number>();
    for (const a of data.activity) kinds.set(a.what, (kinds.get(a.what) ?? 0) + 1);
    lines.push(
      `Movement: ${sessions} ${sessions === 1 ? 'session' : 'sessions'} across ${days} ${days === 1 ? 'day' : 'days'}` +
        (total > 0 ? `, ${hoursAndMinutes(total)} in total` : '') +
        '.'
    );
    lines.push(
      'Kinds of movement: ' +
        [...kinds.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) => `${k} ${n}`)
          .join(', ') +
        '.'
    );
  }

  if (data.symptoms.length > 0) {
    lines.push(
      `Symptoms and observations chosen for this report: ${data.symptoms.length}. Each is printed in full below.`
    );
  }
  if (data.insights.length > 0) {
    lines.push(`Patterns chosen for this report: ${data.insights.length}.`);
  }
  if (data.plans.length > 0) {
    lines.push(`Plans chosen for this report: ${data.plans.length}.`);
  }
  if (data.cards.length > 0) {
    lines.push(`Summaries chosen for this report: ${data.cards.length}.`);
  }

  return { lines, numbers: numbersIn(lines.join(' ')) };
}

/**
 * Every number in a piece of text, normalised so "1,850" and "1850" are the
 * same figure and a trailing zero does not make two.
 */
export function numbersIn(text: string): Set<string> {
  const found = new Set<string>();
  for (const raw of text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []) {
    const cleaned = raw.replace(/,/g, '');
    const value = Number(cleaned);
    if (!Number.isFinite(value)) continue;
    found.add(String(value));
  }
  return found;
}

/**
 * THE GUARD. Any sentence carrying a number the facts never contained is
 * dropped, whole, rather than corrected - because a sentence built around a
 * figure that does not exist has nothing left when the figure goes.
 *
 * Years and dates are allowed through: they come from the records themselves,
 * which the model is also shown, and a date is not a claim about a trend.
 */
export function withoutInvention(
  summary: string,
  allowed: Set<string>,
  alsoAllowed: Set<string> = new Set()
): { text: string; dropped: string[] } {
  const kept: string[] = [];
  const dropped: string[] = [];

  // Split on sentence ends, keeping the punctuation with its sentence.
  const sentences = summary.match(/[^.!?]+[.!?]*/g) ?? [];
  for (const sentence of sentences) {
    const invented = [...numbersIn(sentence)].filter(
      (n) => !allowed.has(n) && !alsoAllowed.has(n)
    );
    if (invented.length > 0) dropped.push(sentence.trim());
    else kept.push(sentence);
  }

  return { text: kept.join('').trim(), dropped };
}

const INSTRUCTIONS = `You are writing the opening paragraph of a personal health record that somebody is about to hand to a clinician.

WHAT YOU ARE GIVEN
A block of figures, already counted, and the records themselves. That is the whole of what exists. There is no other context, no history, and nothing you know about this person.

WHAT TO WRITE
Two or three short paragraphs. What was recorded, over what period, and what the records show when read together. Name what recurs. Name what is thin - three nights of sleep out of ninety days is worth saying plainly, because it tells the reader how much weight to put on it.

RULES, IN ORDER OF IMPORTANCE
1. Every number you write must be one you were given. Do not add, average, total, convert or estimate. If a figure you want is not in the block, write the sentence without it or leave the sentence out.
2. Do not diagnose, and do not suggest a cause. "Headaches were noted on four of the days" is the record. "Headaches were likely dehydration" is not, however plausible.
3. Do not advise. Somebody else in the room does that.
4. Say what is absent as readily as what is present. A gap is information.
5. Write plainly, in British English, in the third person. No headings, no bullet points, no bold. Nothing that sounds like a brochure.

Return only the paragraphs.`;

/**
 * Writes the summary. Returns null when there is nothing worth summarising or
 * the model could not be reached - a report without a summary is a complete
 * report, so this never fails the build.
 */
export async function writeSummary(data: ReportData): Promise<{
  text: string;
  dropped: string[];
} | null> {
  const block = facts(data);
  if (block.lines.length <= 1) return null;

  // The records themselves, so the summary can name what recurs rather than
  // only counting it. Capped, because the point is a paragraph, not a re-read.
  const records: string[] = [];
  for (const s of data.symptoms.slice(0, 40)) {
    records.push(`Symptom, ${s.at.slice(0, 10)}: ${s.title}. ${s.content}`);
  }
  for (const i of data.insights.slice(0, 20)) {
    records.push(`Pattern, ${i.at.slice(0, 10)}: ${i.title}. ${i.content}`);
  }
  for (const c of data.cards.slice(0, 20)) {
    records.push(`${c.kind}: ${c.title}. ${c.content}`);
  }
  for (const p of data.plans.slice(0, 10)) {
    records.push(`Plan: ${p.title}. ${p.content}`);
  }

  let written: string;
  try {
    const reply = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 900,
      system: INSTRUCTIONS,
      messages: [
        {
          role: 'user',
          content:
            `THE FIGURES\n${block.lines.join('\n')}\n\n` +
            (records.length > 0 ? `THE RECORDS\n${records.join('\n\n')}\n` : 'No written records were chosen.\n'),
        },
      ],
    });
    written = reply.content
      .map((part) => (part.type === 'text' ? part.text : ''))
      .join('')
      .trim();
  } catch (err) {
    console.log('REPORT SUMMARY: not written -', err instanceof Error ? err.message : err);
    return null;
  }

  if (!written) return null;

  // Dates and years in the records are the model's to quote; nothing else is.
  const fromRecords = numbersIn(records.join(' '));
  const checked = withoutInvention(written, block.numbers, fromRecords);
  if (checked.dropped.length > 0) {
    console.log(`REPORT SUMMARY: dropped ${checked.dropped.length} sentence(s) with invented figures`);
  }
  if (!checked.text) return null;
  return checked;
}
