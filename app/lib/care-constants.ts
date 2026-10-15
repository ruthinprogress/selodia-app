import type { SupabaseClient } from '@supabase/supabase-js';

// THE DETAILS THAT STAY THE SAME.
//
// Ruth, 14 October 2026: "It might be useful to populate a section where the
// pertinent details always live as they come in from the user, stuff that
// usually stays the same like NHS numbers, axa memebership numbers etc etc.
// easy to access for the user."
//
// WHAT MAKES SOMETHING A CONSTANT, and it is not "a number". An appointment
// time is a number and changes every time. A constant is the thing a desk asks
// for to find you: your NHS number, your insurer's membership number, the
// hospital number on your wristband, your date of birth read back to confirm
// it is you. It is true before the call and still true after it.
//
// It lives in a table of its own rather than on a care record, because it
// belongs to HER and not to one referral. The referral keeps its own copy in
// its "To quote" lines - she asked for that explicitly: "each thread of
// accessing care stays in the current format with everything needed for it,
// and then the constants are in their own section" - so this is a second place
// the same digits appear, on purpose. The record is what she hands to a
// clinician. This is what she reads out.

/** The longest anything here may be. A constant is short by nature. */
const MAX_LABEL = 60;
const MAX_VALUE = 120;
const MAX_NOTE = 160;

/** The most anybody keeps. Past this, something has gone wrong upstream. */
export const MAX_CONSTANTS = 40;

export type CareConstant = {
  label: string;
  value: string;
  note: string | null;
};

export type StoredConstant = CareConstant & {
  id: string;
  source: 'document' | 'conversation';
  confirmed: boolean;
  updated_at: string;
};

/**
 * THE FEW LABELS THAT GENUINELY ARRIVE IN DIFFERENT WORDS.
 *
 * Kept deliberately small. Every entry here MERGES two labels into one row, so
 * a wrong entry silently overwrites one number with another - which is the
 * worst failure this file has available to it. So a pair goes in only when the
 * two phrasings cannot mean different things.
 *
 * "Membership number" is NOT in here, and that is the shape of the rule: she
 * could hold one with AXA and another with a gym, and merging those would hand
 * her the wrong one at the worst moment. The insurer's name stays part of its
 * label.
 */
const SAME_THING: [RegExp, string][] = [
  [/^(my )?nhs (no|num|number|number is)?\.?$/i, 'nhs number'],
  [/^(my )?(date of birth|dob|d\.o\.b)\.?$/i, 'date of birth'],
  [/^(my )?(hospital|patient) (no|num|number)\.?$/i, 'hospital number'],
  [/^(my )?(gp|doctors|doctor's) (surgery|practice)$/i, 'gp practice'],
];

/**
 * The identity of a constant: what makes two labels the same label.
 *
 * Punctuation, case, spacing and a leading "my" carry no meaning here - "My
 * NHS no." and "NHS number" are one thing, and keeping both would mean showing
 * her two rows and letting her work out that they agree.
 */
export function labelKey(label: string): string {
  const tidy = label
    .replace(/\s+/g, ' ')
    .replace(/[:.]+$/, '')
    .trim();
  for (const [pattern, canonical] of SAME_THING) {
    if (pattern.test(tidy)) return canonical;
  }
  return tidy
    .toLowerCase()
    .replace(/^my /, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
};

/**
 * WHAT IS REFUSED, in code, because the prompt is a request and this is a rule.
 *
 * A one-off masquerading as a constant is the failure that makes the section
 * useless: a row reading "Appointment: 3pm Tuesday" is wrong by Thursday, and
 * once two of those are in she stops trusting the ones that are right. The
 * label is where this shows - an appointment, a date she was seen, a result -
 * so the label is what gets checked.
 */
const NOT_A_CONSTANT =
  /\b(appointment|appt|booking|arriv\w*|slot|scan time|result|results|reading|weight|dose|today|tomorrow|next week)\b/i;

/**
 * THE LABEL IS NOT WRITTEN IN THE FIRST PERSON (Ruth, 14 October 2026, reading
 * a line of a test transcript: "why did it say 'my' axa memebership?").
 *
 * The line she caught was my own test input, written in her voice - but she was
 * right about the shape, because nothing stopped it. The model is asked for the
 * label in THEIR words, so "my NHS number" is a label it will sometimes write,
 * and it was stored and shown exactly as given. In a section that is already
 * hers, every row reading "my..." is the app talking about her instead of to
 * her, which is the same fault check-second-person.mjs exists for.
 *
 * The dedup key already dropped it, so there was never going to be a second
 * row - only a row that read oddly. Fixed at the write rather than asked for in
 * the prompt, per the standing rule: never ask the model not to do a thing
 * twice.
 */
function tidyLabel(label: string): string {
  const without = label.replace(/^(my|our)\s+/i, '').trim();
  if (!without) return label;
  // "nhs number" arriving lower-case stays lower-case; only a word that was
  // capitalised BECAUSE it followed "my" gets its capital back.
  return /^[a-z]/.test(without) && /^[A-Z]/.test(label)
    ? without.charAt(0).toUpperCase() + without.slice(1)
    : without;
}

export function coerceConstant(v: unknown): CareConstant | null {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return null;
  const raw = v as Record<string, unknown>;
  const label = clean(raw.label, MAX_LABEL) ? tidyLabel(clean(raw.label, MAX_LABEL) as string) : null;
  const value = clean(raw.value, MAX_VALUE);
  if (!label || !value) return null;
  if (NOT_A_CONSTANT.test(label)) return null;
  // A label that is only punctuation normalises to nothing, and a row with no
  // identity would take the unique index's one unnamed slot.
  if (!labelKey(label)) return null;
  return { label, value, note: clean(raw.note, MAX_NOTE) };
}

export function coerceConstants(v: unknown): CareConstant[] {
  if (!Array.isArray(v)) return [];
  const out: CareConstant[] = [];
  const seen = new Set<string>();
  for (const entry of v) {
    const c = coerceConstant(entry);
    if (!c) continue;
    const key = labelKey(c.label);
    // Last one wins WITHIN a single turn, because a message that says a number
    // twice is correcting itself, not listing two things.
    if (seen.has(key)) {
      out[out.findIndex((o) => labelKey(o.label) === key)] = c;
      continue;
    }
    seen.add(key);
    out.push(c);
    if (out.length >= MAX_CONSTANTS) break;
  }
  return out;
}

/**
 * Write them, one row per label.
 *
 * ON CONFLICT THE NEW VALUE WINS, which is the whole point of a constant: she
 * changed insurer, or the first read of a letter got a digit wrong, and the
 * thing she said most recently is the thing a desk will accept. The label is
 * re-saved too, so her own words for it stay current.
 *
 * A NOTE IS NEVER ERASED BY SILENCE. An arriving row with no note leaves the
 * one that is there alone - otherwise mentioning a number in passing would
 * quietly strip the line explaining what it is for.
 *
 * Returns the labels that landed, for the reply to be able to say so honestly.
 */
export async function recordConstants(
  supabase: SupabaseClient,
  userId: string,
  constants: CareConstant[],
  source: 'document' | 'conversation',
  confirmedByLabel?: (label: string) => boolean
): Promise<string[]> {
  if (constants.length === 0) return [];

  const existing = new Map<string, { note: string | null }>();
  const { data: before } = await supabase
    .from('care_constants')
    .select('label_key, note')
    .eq('user_id', userId);
  for (const row of before ?? []) {
    existing.set(row.label_key as string, { note: (row.note as string | null) ?? null });
  }

  const rows = constants.map((c) => {
    const key = labelKey(c.label);
    return {
      user_id: userId,
      label: c.label,
      label_key: key,
      value: c.value,
      note: c.note ?? existing.get(key)?.note ?? null,
      source,
      confirmed: confirmedByLabel ? confirmedByLabel(c.label) : true,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from('care_constants')
    .upsert(rows, { onConflict: 'user_id,label_key' });
  if (error) {
    console.log('CARE CONSTANTS write failed:', error.message);
    return [];
  }
  return constants.map((c) => c.label);
}

/** Everything she has, newest touched first. */
export async function readConstants(supabase: SupabaseClient, userId: string): Promise<StoredConstant[]> {
  const { data } = await supabase
    .from('care_constants')
    .select('id, label, value, note, source, confirmed, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(MAX_CONSTANTS);
  return (data ?? []) as unknown as StoredConstant[];
}

/**
 * The block the chat is given, so "what's my NHS number" is answerable ANYWHERE
 * rather than only on a turn anchored to the letter it came off.
 *
 * Ruth's test for the whole product, the same day: "this is what replaces
 * Claude, actually being able to pick up anywhere in chat and it knows what
 * you're talking about and gives you exactly what you need." A number she has
 * already given it, that it then cannot produce without being handed the right
 * record first, fails that test completely.
 *
 * VALUES IN FULL, not a count and not a hint. A block saying "you have 4
 * references on file" would cost the same tokens and answer nothing.
 */
export function constantsBlock(rows: StoredConstant[]): string {
  if (rows.length === 0) return '';
  const lines = rows.map((r) => {
    const bits = [r.note, r.confirmed ? null : 'not yet checked against the document']
      .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
      .join('; ');
    return `- ${r.label}: ${r.value}${bits ? ` (${bits})` : ''}`;
  });
  return [
    'THEIR STANDING DETAILS. These are the things a desk asks for to find them, kept because they do not change.',
    ...lines,
    'Give one of these straight back when asked, exactly as written above, including the spacing. Never say where to find it, never ask them to check a letter, and never guess at one that is not listed.',
  ].join('\n');
}

/**
 * Take standing details back out.
 *
 * Ruth, 15 October 2026, having asked the app to pull the numbers she needs
 * regularly out of her care records. It pulled nine, including her date of
 * birth, her address, a GP referral number and an authorisation code. Her
 * correction: "GP practice and its phone number and AXA membership number and
 * the AXA claim follow-up line are recurring details, the rest are linked to
 * active enquiries and will expire, or already exist here in the app in my
 * profile."
 *
 * The app's own answer told her what was missing: "I can add to that list from
 * here, but I don't have a way to take the other entries out of it." It was
 * right. recordConstants upserts and nothing has ever deleted, so a list that
 * went in wrong stayed wrong, and she had no screen to fix it from either.
 *
 * A LIST SHE CANNOT PRUNE IS WORSE THAN NO LIST. The point of this table is
 * that she can read a number out to somebody waiting on the phone without
 * opening a letter. An authorisation code that expired three weeks ago sitting
 * in that list is the thing that makes her stop trusting the rest of it.
 *
 * MATCHED THE SAME WAY THEY WERE STORED, through labelKey, so "my AXA
 * membership number", "AXA membership" and "axa membership number" all find
 * the row that any of them created. Returns the labels actually removed, so
 * the reply can say what went rather than what was asked for - she has been
 * told something was done that was not, and that is the bug this app keeps
 * coming back to.
 */
export async function forgetConstants(
  supabase: SupabaseClient,
  userId: string,
  labels: string[]
): Promise<string[]> {
  const keys = [...new Set(labels.map((l) => labelKey(l)).filter(Boolean))];
  if (keys.length === 0) return [];

  // SELECTED FIRST, so what comes back is what was really there. A delete
  // reports a count, and a count cannot tell her WHICH of the three she named
  // actually existed.
  const { data: found, error: readError } = await supabase
    .from('care_constants')
    .select('label, label_key')
    .eq('user_id', userId)
    .in('label_key', keys);
  if (readError) {
    console.log('CARE CONSTANTS remove failed to read:', readError.message);
    return [];
  }
  if ((found ?? []).length === 0) return [];

  const { error } = await supabase
    .from('care_constants')
    .delete()
    .eq('user_id', userId)
    .in(
      'label_key',
      (found ?? []).map((r) => r.label_key as string)
    );
  if (error) {
    console.log('CARE CONSTANTS remove failed:', error.message);
    return [];
  }
  return (found ?? []).map((r) => r.label as string);
}
