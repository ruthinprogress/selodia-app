import type { SupabaseClient } from '@supabase/supabase-js';

// SLEEP (2026-09-20). "Leave out medication and mood. Add sleep."
//
// PARSED IN CODE, like water and unlike food. How long somebody slept is a
// fixed fact with a right answer - "half eleven till six" is six and a half
// hours in every context - and principle 13 hands the model the open-ended
// judgement instead: whether a message is about sleep at all, which it already
// decides when it sets logIntent.
//
// KEYED ON THE NIGHT. "Last night" said on Saturday morning is Friday's night,
// and the same sleep described again in the evening must land on the same row
// rather than a second one. See sleep_logs.night_of.
//
// EVERYTHING IS OPTIONAL EXCEPT THE NIGHT. "Slept badly" is a real entry with
// no hours in it, and a guess in the duration column would read later as a
// measurement. Quality is one of four words rather than a score, because a
// number invites an average, and an average of how somebody felt about their
// sleep is not a fact.

export type SleepQuality = 'poor' | 'broken' | 'ok' | 'good';

export type ParsedSleep = {
  nightOf: string;
  durationMin: number | null;
  wentToBed: string | null;
  wokeAt: string | null;
  quality: SleepQuality | null;
  awakenings: number | null;
};

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, once: 1, twice: 2,
};

/** "half eleven", "8:30pm", "20:30", "8pm" -> minutes since midnight, or null. */
const CLOCK_HOUR = `(?:\\d{1,2}|${Object.keys(WORD_NUMBERS).join('|')})`;

function readClock(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  const m = new RegExp(`^(?:(half)\\s+(?:past\\s+)?)?(${CLOCK_HOUR})(?::(\\d{2}))?\\s*(am|pm)?$`).exec(t);
  if (!m) return null;
  // The hour is spoken as often as it is written: "half eleven till half six".
  const hourValue = /^\d+$/.test(m[2]) ? Number(m[2]) : WORD_NUMBERS[m[2]];
  if (hourValue == null) return null;
  let hour = hourValue;
  const mins = m[3] ? Number(m[3]) : m[1] ? 30 : 0;
  if (hour > 23 || mins > 59) return null;
  const suffix = m[4];
  if (suffix === 'pm' && hour < 12) hour += 12;
  if (suffix === 'am' && hour === 12) hour = 0;
  // NO SUFFIX, SO READ IT AS A HUMAN WOULD. Bedtimes are in the evening and
  // waking is in the morning: "11 till 6" is eleven at night until six in the
  // morning, which is the only reading that makes sense of the sentence.
  return hour * 60 + mins;
}

function asTime(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

/** Bed and wake times, when both are given. Handles the crossing of midnight. */
function readWindow(text: string): { bed: number; wake: number } | null {
  const clock = `(?:half\\s+(?:past\\s+)?)?${CLOCK_HOUR}(?::\\d{2})?\\s*(?:am|pm)?`;
  const m =
    new RegExp(`\\b(?:from\\s+)?(${clock})\\s*(?:till|til|until|to|-|–)\\s*(${clock})`).exec(text) ??
    new RegExp(
      `\\bbed at\\s+(${clock})[^a-z0-9]{0,8}(?:i\\s+)?(?:woke|got up|was awake)(?:\\s*(?:up|at|around))*\\s+(${clock})`
    ).exec(text);
  if (!m) return null;
  let bed = readClock(m[1]);
  let wake = readClock(m[2]);
  if (bed == null || wake == null) return null;
  // An unsuffixed evening hour between 6 and 11 is pm; an unsuffixed waking
  // hour under 12 is am. Both are how the sentence would be read aloud.
  if (!/am|pm/.test(m[1]) && bed >= 6 * 60 && bed < 12 * 60) bed += 12 * 60;
  if (!/am|pm/.test(m[2]) && wake >= 12 * 60) wake -= 12 * 60;
  return { bed, wake };
}

function readDuration(text: string): number | null {
  const half = /\b(\d{1,2})\s*(?:and\s+a\s+half|½|\.5)\s*(?:hours?|hrs?|h)\b/.exec(text);
  if (half) return Number(half[1]) * 60 + 30;

  const decimal = /\b(\d{1,2}(?:\.\d)?)\s*(?:hours?|hrs?|h)\b/.exec(text);
  if (decimal) {
    const hours = Number(decimal[1]);
    if (hours > 0 && hours <= 24) return Math.round(hours * 60);
  }

  const worded = new RegExp(`\\b(${Object.keys(WORD_NUMBERS).join('|')})\\s*(?:and\\s+a\\s+half\\s*)?(?:hours?|hrs?)\\b`).exec(text);
  if (worded) {
    const hours = WORD_NUMBERS[worded[1]];
    const andAHalf = /and\s+a\s+half/.test(worded[0]);
    if (hours) return hours * 60 + (andAHalf ? 30 : 0);
  }

  const minutes = /\b(\d{2,3})\s*(?:minutes?|mins?)\b/.exec(text);
  if (minutes) {
    const n = Number(minutes[1]);
    if (n > 0 && n <= 1440) return n;
  }
  return null;
}

function readQuality(text: string): SleepQuality | null {
  if (/\b(badly|terrible|awful|rough|barely slept|hardly slept|couldn'?t sleep|no sleep|insomnia|dreadful)\b/.test(text))
    return 'poor';
  if (/\b(broken|restless|kept waking|woke (?:up )?(?:a lot|several|many|\d+|twice|three)|in and out|patchy|disturbed)\b/.test(text))
    return 'broken';
  if (/\b(well|great|deeply|solid|straight through|like a log|properly|brilliant|lovely)\b/.test(text))
    return 'good';
  if (/\b(ok|okay|alright|all right|fine|not bad|decent)\b/.test(text)) return 'ok';
  return null;
}

function readAwakenings(text: string): number | null {
  const m = new RegExp(`\\b(?:woke|awake|up)\\s*(?:up)?\\s*(\\d{1,2}|${Object.keys(WORD_NUMBERS).join('|')})\\s*(?:times?|x)?\\b`).exec(text);
  if (m) {
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : WORD_NUMBERS[m[1]];
    if (n != null && n >= 0 && n <= 30) return n;
  }
  if (/\bwoke (?:up )?(?:once|twice)\b/.test(text)) return /twice/.test(text) ? 2 : 1;
  return null;
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * WHICH NIGHT. The date the sleep started, so one night is one row whichever
 * side of midnight it began and whenever it is described.
 *
 * "Last night" before about four in the afternoon means the night just gone,
 * which started yesterday. Said in the evening it still means the night just
 * gone - people do not say "last night" about the sleep they are heading into.
 */
function readNight(text: string, now: Date): string {
  const day = (d: Date) => {
    const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
  };
  const shift = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return day(d);
  };

  const named = new RegExp(`\\b(${DAYS.join('|')})\\b`).exec(text);
  if (named) {
    const target = DAYS.indexOf(named[1]);
    let back = (now.getDay() - target + 7) % 7;
    if (back === 0) back = 7;
    return shift(back);
  }
  if (/\bnight before last\b/.test(text)) return shift(2);
  // Everything else - "last night", "slept badly", no time reference at all -
  // is the night just gone.
  return shift(1);
}

/** Everything a message says about sleep, or null when it says nothing. */
export function parseSleep(raw: string, now: Date = new Date()): ParsedSleep | null {
  const text = raw.toLowerCase();
  const window = readWindow(text);
  const duration =
    readDuration(text) ??
    (window ? ((window.wake - window.bed + 24 * 60) % (24 * 60)) || null : null);
  const quality = readQuality(text);
  const awakenings = readAwakenings(text);

  // Nothing about sleep at all: no hours, no window, no sense of how it went.
  // The model may have called this a sleep message, and it is still not one -
  // the guard is here, at the write.
  if (duration == null && !window && quality == null && awakenings == null) return null;

  return {
    nightOf: readNight(text, now),
    durationMin: duration,
    wentToBed: window ? asTime(window.bed) : null,
    wokeAt: window ? asTime(window.wake) : null,
    quality: quality ?? (awakenings != null && awakenings >= 2 ? 'broken' : null),
    awakenings,
  };
}

export type SleepEntry = ParsedSleep & { id: string };

/**
 * One row per night: a second description of the same night fills in what it
 * adds and leaves everything else alone, rather than writing a fresh row or
 * blanking what was already known.
 */
export async function logSleepFromText(
  supabase: SupabaseClient,
  userId: string,
  text: string,
  now: Date = new Date()
): Promise<SleepEntry | null> {
  const parsed = parseSleep(text, now);
  if (!parsed) return null;

  const { data: existing } = await supabase
    .from('sleep_logs')
    .select('id, duration_min, went_to_bed, woke_at, quality, awakenings, notes')
    .eq('user_id', userId)
    .eq('night_of', parsed.nightOf)
    .maybeSingle();

  const row = {
    user_id: userId,
    night_of: parsed.nightOf,
    duration_min: parsed.durationMin ?? existing?.duration_min ?? null,
    went_to_bed: parsed.wentToBed ?? existing?.went_to_bed ?? null,
    woke_at: parsed.wokeAt ?? existing?.woke_at ?? null,
    quality: parsed.quality ?? existing?.quality ?? null,
    awakenings: parsed.awakenings ?? existing?.awakenings ?? null,
    raw_input: text.slice(0, 500),
    source: 'chat',
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('sleep_logs')
    .upsert(row, { onConflict: 'user_id,night_of' })
    .select('id')
    .maybeSingle();
  if (error || !data?.id) {
    console.log('sleep_logs upsert failed:', error?.message);
    return null;
  }
  return { ...parsed, id: data.id as string };
}

const QUALITY_WORD: Record<SleepQuality, string> = {
  poor: 'a rough night',
  broken: 'a broken night',
  ok: 'an ok night',
  good: 'a good night',
};

/** The toast under the reply: what was stored, in the app's own words. */
export function sleepSaveSummary(entry: ParsedSleep): string {
  const bits: string[] = [];
  if (entry.durationMin != null) {
    const h = Math.floor(entry.durationMin / 60);
    const m = entry.durationMin % 60;
    bits.push(m === 0 ? `${h}h` : `${h}h ${m}m`);
  }
  if (entry.quality) bits.push(QUALITY_WORD[entry.quality]);
  if (entry.awakenings != null && entry.awakenings > 0) {
    bits.push(`awake ${entry.awakenings} ${entry.awakenings === 1 ? 'time' : 'times'}`);
  }
  return `Sleep · ${bits.join(' · ')}`;
}
