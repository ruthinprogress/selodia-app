import type { SupabaseClient } from '@supabase/supabase-js';

// Discuss-card image plumbing (build item 30, slice 1).
//
// When someone taps "Ask about this", the entry's breakdown card is carried
// into the chat thread as an IMAGE — a shared visual reference both the person
// and Selodia can see, rather than structured data handed to the model
// invisibly. This module owns the two halves the server needs: getting that
// image into Storage, and getting it in front of the model exactly once.

export const DISCUSS_BUCKET = 'discuss-cards';

export type DiscussEntryType = 'food' | 'activity' | 'measurement';

// Only 'food' is wired today — the food breakdown card is the only one built
// (Measurements and Activity are items 38/39). The seam is generic so those
// arrive without a schema change.
const ENTRY_TYPES: DiscussEntryType[] = ['food', 'activity', 'measurement'];

export function isDiscussEntryType(v: unknown): v is DiscussEntryType {
  return typeof v === 'string' && (ENTRY_TYPES as string[]).includes(v);
}

// Anthropic accepts these; anything else is refused rather than guessed at, so
// a malformed client can't get arbitrary bytes stored as an "image".
const ALLOWED_MEDIA = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type CardMediaType = (typeof ALLOWED_MEDIA)[number];

export function isCardMediaType(v: unknown): v is CardMediaType {
  return typeof v === 'string' && (ALLOWED_MEDIA as readonly string[]).includes(v);
}

// A captured card is a small PNG. This ceiling is generous for that and still
// well under what would bloat a request; it exists so a bad client can't push
// arbitrarily large payloads through the chat route.
const MAX_CARD_BYTES = 4 * 1024 * 1024;

function base64ToBytes(b64: string): Uint8Array {
  const bin = Buffer.from(b64, 'base64');
  return new Uint8Array(bin);
}

// Store a posted card image under {user_id}/... — the prefix the Storage RLS
// policies key on. Returns the object path, or null if anything is off, so the
// caller degrades to a text-only turn rather than failing the whole message.
export async function uploadDiscussCard(
  supabase: SupabaseClient,
  userId: string,
  imageBase64: string,
  mediaType: CardMediaType
): Promise<string | null> {
  if (typeof imageBase64 !== 'string' || imageBase64.length === 0) return null;

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(imageBase64);
  } catch {
    return null;
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_CARD_BYTES) return null;

  const ext = mediaType === 'image/png' ? 'png' : mediaType === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(DISCUSS_BUCKET)
    .upload(path, bytes, { contentType: mediaType, upsert: false });

  if (error) {
    console.log('DISCUSS CARD UPLOAD FAILED:', error.message);
    return null;
  }
  return path;
}

export type PendingCardImage = {
  messageId: string;
  base64: string;
  mediaType: CardMediaType;
};

// Find the one card image that hasn't reached the model yet and load it.
//
// Server-authoritative on purpose: the client could track "have I sent this
// yet", but that state would be lost on an app restart mid-conversation, and
// the person would either lose the reference or pay for it twice. The flag
// lives with the message it belongs to.
export async function loadPendingCardImage(
  supabase: SupabaseClient,
  userId: string
): Promise<PendingCardImage | null> {
  const { data: row } = await supabase
    .from('chat_messages')
    .select('id, image_path')
    .eq('user_id', userId)
    .eq('source', 'chat')
    .not('image_path', 'is', null)
    .eq('image_sent_to_model', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row?.image_path) return null;

  const { data: blob, error } = await supabase.storage
    .from(DISCUSS_BUCKET)
    .download(row.image_path as string);
  if (error || !blob) {
    // The reference is unusable, so retire it rather than retrying every turn
    // for the rest of the conversation.
    console.log('DISCUSS CARD DOWNLOAD FAILED:', error?.message);
    await markCardImageSent(supabase, row.id as string);
    return null;
  }

  const buf = Buffer.from(await blob.arrayBuffer());
  const mediaType: CardMediaType = (row.image_path as string).endsWith('.png')
    ? 'image/png'
    : (row.image_path as string).endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';

  return { messageId: row.id as string, base64: buf.toString('base64'), mediaType };
}

// Flip the flag only AFTER the model call succeeds, so a failed call doesn't
// silently consume the one chance the image had to be seen.
export async function markCardImageSent(supabase: SupabaseClient, messageId: string) {
  const { error } = await supabase
    .from('chat_messages')
    .update({ image_sent_to_model: true })
    .eq('id', messageId);
  if (error) console.log('DISCUSS CARD FLAG UPDATE FAILED:', error.message);
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;

const part = (v: unknown, unit: string): string | null => {
  const n = num(v);
  return n == null ? null : `${n}${unit}`;
};

// WHAT THE ENTRY ACTUALLY SAYS, for the model (2026-09-16).
//
// THE GAP THIS CLOSES. "Ask about this" has always tagged the turn with the
// entry's id and type - and that tag was pure bookkeeping, used to pull one
// entry's Q&A back out of a scrolled thread. Nothing ever put the entry's
// CONTENTS in front of the model. Item 30's design says the card travels as an
// image, but the phone has never captured one (no view-capture library is
// installed), so the seam above has sat unused and the model has been answering
// questions about an entry it could not see. Ruth, on the food card: "it did
// not appear or get acknowledged" - two faults wearing one coat. The card was
// the app's half; this is the other.
//
// TEXT, NOT A PICTURE, and read from the same tables the card draws from, so
// the two cannot disagree about what was eaten. When the view-capture library
// arrives the image can join this; it does not replace it, because an image
// cannot be searched, summed or quoted back.
//
// Returns null for a missing row rather than inventing a placeholder: an entry
// deleted after the question was asked leaves the question standing on its own,
// which is the same honesty the card itself keeps.
export async function loadDiscussEntryFacts(
  supabase: SupabaseClient,
  tag: DiscussTag,
  // True only on the turn that posted the card. Every later turn is a carried
  // one, and gets carriedLead instead.
  opening: boolean = true
): Promise<string | null> {
  if (!tag) return null;
  // DO NOT READ THE CARD BACK (Ruth, 2026-09-16, on the first reply this block
  // ever produced: "I don't think it needs such a lengthy text acknowledgement -
  // find a more punchy solution"). The reply recited every item and the total,
  // directly beneath a table showing every item and the total. Handing the model
  // the facts was right; it just had no idea the person could already see them.
  const openingLead =
    'THE ENTRY THEY ARE ASKING ABOUT. They tapped "Ask about this" on it, so its card is on screen DIRECTLY ABOVE your reply - itemised, with its totals. They can see all of it.\n' +
    'So do not read it back. No list of what was in it, no totals, no recital of the date. One short line that shows you know which entry this is, then ask what they want to know about it. Two sentences at most, and shorter is better.\n' +
    'The facts below are for ANSWERING, not for repeating.';

  // THE CARRIED TURN IS NOT THE OPENING TURN (2026-09-19). Until now every turn
  // of a discussion was handed the opening lead - "they tapped Ask about this,
  // ask what they want to know" - so forty messages in, the model was still
  // being told she had just tapped the card, and had no reason to judge that
  // the talk had moved on. This lead asks for that judgement on every turn,
  // with a high bar, because the card is how the transcript keeps its meaning.
  const carriedLead =
    'A DISCUSSION IS ANCHORED TO THIS ENTRY. Earlier in this conversation they opened it with "Ask about this", and its card sits above that turn in the thread, which is how anyone reading back later knows what "it", "that meal" or "the protein" refer to.\n' +
    'JUDGE THIS MESSAGE: is it still about this entry, or has the conversation genuinely moved on to something unrelated? A follow-up, a tangent still rooted in it, or a question that only makes sense because of it is STILL ABOUT IT. Set discussTopicEnded only when you are confident this message is about something else entirely - and if you are unsure, it has not moved on.\n' +
    'The facts below are for answering, not for repeating.';

  const lead = opening ? openingLead : carriedLead;

  if (tag.entryType === 'food') {
    const [{ data: log }, { data: items }] = await Promise.all([
      supabase
        .from('food_logs')
        .select('raw_text, meal_label, happened_at, kcal, protein_g, carbs_g, fat_g')
        .eq('id', tag.entryId)
        .maybeSingle(),
      supabase
        .from('food_items')
        .select('name, quantity, kcal, protein_g')
        .eq('food_log_id', tag.entryId)
        .order('created_at', { ascending: true }),
    ]);
    if (!log) return null;

    // Her own words name it, not the inferred category - the same flip the log
    // views took the same day, and for the same reason: "what could be
    // discussed about 'dinner' - it's not specific enough to add any value".
    const named = (log.raw_text as string | null)?.trim() || (log.meal_label as string | null)?.trim() || 'a meal';

    // THE SAME TOTALS THE TABLE DRAWS, NOT THE LOG'S OWN (2026-09-16). The first
    // reply this block produced said "18g protein" under a table whose total read
    // ~16g. Both numbers were real: food_logs holds the parse's figure for the
    // whole meal, and the table sums its items, and the two differ by a rounding
    // step or two. food-breakdown-table.ts already refused that trade for exactly
    // this reason - "a table whose total does not equal its own visible column is
    // the one thing a reader will spot instantly" - and then the model was handed
    // the other number and quoted it. When there are items, the sum of the items
    // IS the total, here as well as there.
    const rows = items ?? [];
    const sum = (pick: (r: (typeof rows)[number]) => unknown): number | null => {
      const vals = rows.map(pick).filter((v): v is number => typeof v === 'number');
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
    };
    const totals =
      rows.length > 0
        ? [part(sum((r) => r.kcal), ' kcal'), part(sum((r) => r.protein_g), 'g protein')].filter(
            (p): p is string => p !== null
          )
        : [
            part(log.kcal, ' kcal'),
            part(log.protein_g, 'g protein'),
            part(log.carbs_g, 'g carbs'),
            part(log.fat_g, 'g fat'),
          ].filter((p): p is string => p !== null);

    const lines = rows.map((it) => {
      const qty = (it.quantity as string | null)?.trim();
      const macros = [part(it.kcal, ' kcal'), part(it.protein_g, 'g protein')].filter(
        (p): p is string => p !== null
      );
      return `- ${String(it.name ?? 'item').trim()}${qty ? ` (${qty})` : ''}${
        macros.length > 0 ? `: ${macros.join(', ')}` : ''
      }`;
    });

    return [
      lead,
      `Food logged ${when(log.happened_at as string | null)}: "${named}".`,
      totals.length > 0 ? `Totals: ${totals.join(', ')}.` : 'No macros were recorded for it.',
      lines.length > 0
        ? `What was in it:\n${lines.join('\n')}`
        : 'It was logged as one item, with no itemised breakdown - so do not refer to items it does not have.',
    ].join('\n');
  }

  if (tag.entryType === 'activity') {
    const { data } = await supabase
      .from('activity_logs')
      .select('activity_type, duration_min, kcal_burned, happened_at')
      .eq('id', tag.entryId)
      .maybeSingle();
    if (!data) return null;
    const detail = [part(data.duration_min, ' min'), part(data.kcal_burned, ' kcal burned')].filter(
      (p): p is string => p !== null
    );
    return [
      lead,
      `Activity logged ${when(data.happened_at as string | null)}: ${
        (data.activity_type as string | null)?.trim() || 'a session'
      }.`,
      detail.length > 0 ? `${detail.join(', ')}.` : 'No duration or burn was recorded for it.',
    ].join('\n');
  }

  const { data } = await supabase
    .from('body_measurements')
    .select('weight_kg, body_fat_pct, muscle_kg, measured_at')
    .eq('id', tag.entryId)
    .maybeSingle();
  if (!data) return null;
  const detail = [
    part(data.weight_kg, ' kg'),
    part(data.body_fat_pct, '% body fat'),
    part(data.muscle_kg, ' kg muscle'),
  ].filter((p): p is string => p !== null);
  return [
    lead,
    `Body reading taken ${when(data.measured_at as string | null)}.`,
    detail.length > 0 ? `${detail.join(', ')}.` : 'No values were recorded on it.',
  ].join('\n');
}

export type DiscussTag = { entryId: string; entryType: DiscussEntryType } | null;

/**
 * What the conversation is about, in words short enough for one line above the
 * message box: her own words for a meal, the session's name, or "a body
 * reading". Null when the entry has gone - a deleted meal is not something a
 * conversation can still be anchored to by name.
 */
export async function discussEntryName(
  supabase: SupabaseClient,
  tag: DiscussTag
): Promise<string | null> {
  if (!tag) return null;
  const clip = (s: string) => (s.length > 48 ? `${s.slice(0, 47).trimEnd()}…` : s);
  if (tag.entryType === 'food') {
    const { data } = await supabase
      .from('food_logs')
      .select('raw_text, meal_label')
      .eq('id', tag.entryId)
      .maybeSingle();
    if (!data) return null;
    const words = (data.raw_text as string | null)?.trim() || (data.meal_label as string | null)?.trim();
    return words ? clip(words) : 'a meal';
  }
  if (tag.entryType === 'activity') {
    const { data } = await supabase
      .from('activity_logs')
      .select('activity_type')
      .eq('id', tag.entryId)
      .maybeSingle();
    if (!data) return null;
    return clip((data.activity_type as string | null)?.trim() || 'a session');
  }
  const { data } = await supabase.from('body_measurements').select('id').eq('id', tag.entryId).maybeSingle();
  return data ? 'a body reading' : null;
}

// Which entry (if any) the current turn belongs to.
//
// The tag persists for the natural life of a conversational thread — from the
// posting turn forward — rather than expiring on a timer. A clock can't tell a
// twenty-minute pause from a change of subject, so the only honest signal is
// the model's own read of whether the conversation has moved on, declared on
// the classify tool call it already makes (Part Two principle 13: classify
// where the understanding already is, never by pattern-matching downstream).
//
// CONTINUE-BY-DEFAULT is deliberate (decided 2026-08-21). Silence from the
// model keeps the tag, because the alternative — dropping it unless re-affirmed
// every turn — loses genuine follow-ups. The accepted trade is a "stuck tag":
// if the model never declares an end, one entry's history slowly absorbs the
// whole conversation. That is a known, monitorable risk (count consecutive
// messages sharing one entry id), not an oversight.
// TWO THINGS END A DISCUSSION BESIDES THE MODEL SAYING SO (2026-09-16).
//
// The "stuck tag" above stopped being theoretical the day it was written.
// Ruth tapped "Ask about this" on a 7 September pizza, and the tag then rode
// every message for the next two hours: a bare "Hi" forty-eight minutes later,
// and a message logging two entirely new meals. The thread drew that pizza's
// card above a Turkish-leftovers catch-up, and she read it as the catch-up
// having been filed in the previous week. The model never set discussTopicEnded
// once - not on the greeting, not on the new log - so continue-by-default
// continued, exactly as designed and entirely wrongly.
//
// LOGGING SOMETHING NEW ENDS IT. Not a judgment call: the person has just put a
// different entry into the app, so whatever the conversation was about, it is
// now about this. This is the signal the model was being asked to infer and
// failing to - and it is already sitting on the classify result.
//
// A LONG GAP ENDS IT. The original note argued a clock cannot tell a
// twenty-minute pause from a change of subject, and that is true - so the
// threshold is not set anywhere near twenty minutes. Three quarters of an hour
// later, "Hi" is a new conversation by any reading, and treating it as a
// follow-up about a pizza is not a close call.
const STALE_AFTER_MINUTES = 45;

// THE ANCHOR IS MEANING, NOT NAVIGATION (Ruth, 2026-09-19).
//
// On 18 September her oxtail dinner stayed attached for 38 messages, through
// subjects that had nothing to do with it. The first fix, the same morning,
// released it after six of her messages. She reversed it:
//
//   "The anchor card is not just UI - it preserves the context of the
//   conversation. Without it, the transcript quickly becomes difficult to
//   understand because references like 'it', 'that meal' or 'the protein' lose
//   their meaning. The card should remain attached for as long as the
//   conversation is genuinely about that item. Please don't remove it after an
//   arbitrary number of messages."
//
// She is right, and the count was the wrong fix for a real fault. Read back in
// six months, message seven about the dinner means nothing without its card.
// So a discussion ends only when:
//
//   1. she opens another "Ask about this" (posted, below),
//   2. she closes the topic herself (closedByUser),
//   3. Selodia is confident the conversation has genuinely moved on
//      (topicEnded) - which now actually gets judged, see carriedLead in
//      loadDiscussEntryFacts: the 38-message evening happened because every turn
//      told the model she had just tapped the card, so it never had reason to
//      think otherwise.
//
// Two content signals stay as forms of the third, because neither counts
// anything: logging a NEW entry is a change of subject by definition, and a
// 45-minute silence followed by a new message is a new conversation.

export function resolveDiscussTag(input: {
  posted: DiscussTag;
  previous: DiscussTag;
  topicEnded: boolean;
  // Minutes between the previous tagged message and now, when it can be known.
  minutesSincePrevious?: number | null;
  // This turn put a new entry in the log.
  loggedSomethingNew?: boolean;
  // She closed the topic herself, from the card.
  closedByUser?: boolean;
}): DiscussTag {
  // Posting a card starts that entry's discussion outright. It outranks an
  // end-of-topic declaration: the declaration is about the message the person
  // just sent, while the posting is a deliberate act of changing the subject TO
  // this entry.
  if (input.posted) return input.posted;
  if (!input.previous) return null;
  if (input.loggedSomethingNew) return null;
  if (
    typeof input.minutesSincePrevious === 'number' &&
    input.minutesSincePrevious > STALE_AFTER_MINUTES
  ) {
    return null;
  }
  if (input.closedByUser) return null;
  if (input.topicEnded) return null;
  return input.previous;
}
