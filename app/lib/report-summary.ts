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
  // ROUND FIRST, THEN SPLIT. Flooring the hours and rounding the remainder
  // separately turns an average of 419.67 minutes into "6h 60m" - a nonsense
  // figure in a document whose entire argument is that its figures are exact.
  const whole = Math.round(minutes);
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// EVERY ROW THIS FILE READS ARRIVES OLDEST FIRST (loadReport orders ascending,
// so the report's own tables read forwards in time). Saying so once, here,
// because reading it backwards is what made the first version of this file
// announce a 4.2 kg loss as a gain.
const oldest = <T,>(rows: T[]): T => rows[0];
const newest = <T,>(rows: T[]): T => rows[rows.length - 1];

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
      lines.push(
        `Weight: ${readings(weights.length)}, from ${oldest(weights).toFixed(1)} kg on the first to ${newest(weights).toFixed(1)} kg on the last.`
      );
    }
    const fats = data.weights.map((w) => w.fat).filter((f): f is number => f != null);
    if (fats.length > 0) {
      lines.push(
        `Body fat: ${readings(fats.length)}, from ${oldest(fats).toFixed(1)}% on the first to ${newest(fats).toFixed(1)}% on the last.`
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
    lines.push(`${name}: ${readings(values.length)}, most recent ${newest(values)}.`);
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

/** Numbers written as words, which a digit-matching guard cannot see. */
const WORDED =
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|half|third|quarter|dozen|most|majority|average|typically|usually)\b/i;

/**
 * THE GUARD: THE SUMMARY CARRIES NO FIGURES AT ALL.
 *
 * The first version kept a whitelist of every number the facts contained and
 * dropped any sentence naming something else. A review broke it in three ways
 * in one afternoon, and all three were the same flaw - a bare number carries
 * no meaning, so the whitelist could not tell one from another:
 *
 *   - "7 nights" in the facts licensed "7 hours a night", "woke 7 times" and
 *     "body fat is around 7%". Three inventions, all waved through.
 *   - The records' own free text was whitelisted too, so a symptom reading
 *     "lasted about 40 minutes" licensed "migraines affected 40% of the days".
 *   - And a date in scope contributed 2026, 9 and 14 as separate integers, so
 *     almost every small number in the language was permitted by accident.
 *
 * A whitelist of bare digits cannot be fixed, because the thing that makes a
 * figure right or wrong is the unit and the subject, not the digit. So the
 * division moved instead of being patched: THE APP PRINTS THE FIGURES AND THE
 * MODEL WRITES THE PROSE. `facts()` already counts everything, and those lines
 * now print above the paragraphs as their own block, in the app's words. The
 * summary's job is what the records show when read together - what recurs,
 * what is thin, what is absent - which is the analysis Ruth asked for, and
 * needs no arithmetic of its own.
 *
 * That makes the guard total rather than approximate: a sentence with a figure
 * in it goes, because there is no figure the summary is allowed to state. The
 * figures are still on the page, one block above, every one of them counted
 * here. Worded numbers go too, since "fourteen of the ninety days" is the same
 * claim wearing different clothes.
 */
export function withoutFigures(summary: string): { text: string; dropped: string[] } {
  const dropped: string[] = [];
  const paragraphs = summary.split(/\r?\n\s*\r?\n/);
  const keptParagraphs: string[] = [];

  for (const paragraph of paragraphs) {
    // A SENTENCE ENDS AT A FULL STOP FOLLOWED BY A SPACE, and not at the one
    // inside 74.5 - splitting on every '.' cut correct sentences in half and
    // then threw both halves away. Abbreviations are stitched back on, because
    // a paragraph ending "..., i.e." is its own kind of broken.
    const sentences = stitch(paragraph.split(/(?<=[.!?])\s+/));
    const kept: string[] = [];
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;
      if (numbersIn(trimmed).size > 0 || WORDED.test(trimmed)) dropped.push(trimmed);
      else kept.push(trimmed);
    }
    if (kept.length > 0) keptParagraphs.push(kept.join(' '));
  }

  // Paragraph breaks survive, because the renderer turns them into paragraphs
  // and a summary that arrives as one slab reads like a wall.
  return { text: keptParagraphs.join('\n\n').trim(), dropped };
}

/** "e.g." and friends are not the end of a sentence. */
const ABBREVIATION = /\b(?:e\.g|i\.e|etc|vs|Dr|Mr|Mrs|Ms|Prof|approx|no)\.$/i;

function stitch(parts: string[]): string[] {
  const out: string[] = [];
  for (const part of parts) {
    if (out.length > 0 && ABBREVIATION.test(out[out.length - 1].trim())) {
      out[out.length - 1] = `${out[out.length - 1]} ${part}`;
    } else {
      out.push(part);
    }
  }
  return out;
}

const INSTRUCTIONS = `You are writing the opening paragraphs of a personal health record that somebody is about to hand to a clinician.

WHAT YOU ARE GIVEN
A block of figures, already counted by the app, and the records themselves. That is the whole of what exists. There is no other context, no history, and nothing you know about this person.

WHERE THE FIGURES GO
The figures are printed on the page directly above your paragraphs, exactly as you were given them. Your paragraphs must contain NO figures of any kind: no counts, no averages, no percentages, no durations, no dates, and no numbers written as words. Not because a figure would be unwelcome, but because it is already there and repeating it is the one way this document can contradict itself.

Write "sleep was described on only a few of the nights, so it should not be read as a picture of usual sleep", never "sleep was described on 9 of 90 nights". The reader has the 9 and the 90 immediately above.

WHAT TO WRITE
Two or three short paragraphs saying what the records show when read together. What recurs, and in what circumstances. What the written entries describe. What is thin or missing, said plainly, because it tells the reader how much weight to put on the rest.

RULES
1. No figures. This is checked, and any sentence containing one is deleted before she sees it.
2. Do not diagnose, and do not suggest a cause. "Swelling was noted after long periods seated" is the record. "Swelling was likely venous insufficiency" is not, however plausible.
3. Do not advise. Somebody else in the room does that.
4. Say what is absent as readily as what is present. A gap is information.
5. Write plainly, in British English, in the third person. No headings, no bullet points, no bold. Nothing that sounds like a brochure.

Return only the paragraphs.`;

/** The result of drafting: what it says, what the guard removed, and why. */
export type Draft =
  | { ok: true; text: string; dropped: string[] }
  | { ok: false; reason: 'too-little' | 'unreachable' | 'all-figures' };

/**
 * Writes the summary. It never throws and never fails the build: a report
 * without a summary is a complete report. But it says WHICH of the three
 * things happened, because "we could not reach the model" and "there was too
 * little chosen to say anything about" call for different words on the phone,
 * and the first version reported both as silence.
 */
export async function writeSummary(data: ReportData): Promise<Draft> {
  const block = facts(data);
  if (block.lines.length <= 1) return { ok: false, reason: 'too-little' };

  // The records themselves, so the summary can say what they describe rather
  // than only how many there are. Capped, because the point is a paragraph and
  // not a re-read - and taken from the END, because the rows arrive oldest
  // first and a selection of sixty symptoms would otherwise be summarised from
  // the sixty that matter least.
  const records: string[] = [];
  for (const s of data.symptoms.slice(-40)) {
    records.push(`Symptom, ${s.at.slice(0, 10)}: ${s.title}. ${s.content}`);
  }
  for (const i of data.insights.slice(-20)) {
    records.push(`Pattern, ${i.at.slice(0, 10)}: ${i.title}. ${i.content}`);
  }
  for (const c of data.cards.slice(-20)) {
    records.push(`${c.kind}: ${c.title}. ${c.content}`);
  }
  for (const p of data.plans.slice(-10)) {
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
    return { ok: false, reason: 'unreachable' };
  }

  if (!written) return { ok: false, reason: 'unreachable' };

  const checked = withoutFigures(written);
  if (checked.dropped.length > 0) {
    console.log(`REPORT SUMMARY: removed ${checked.dropped.length} sentence(s) carrying figures`);
  }
  // EVERY SENTENCE WENT, which is a different thing from having nothing to say
  // and must not be reported as silence - she ticked the box and waited.
  if (!checked.text) return { ok: false, reason: 'all-figures' };
  return { ok: true, text: checked.text, dropped: checked.dropped };
}
