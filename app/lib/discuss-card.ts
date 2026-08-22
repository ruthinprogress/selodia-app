import type { SupabaseClient } from '@supabase/supabase-js';

// Discuss-card image plumbing (build item 30, slice 1).
//
// When someone taps "Ask about this", the entry's breakdown card is carried
// into the chat thread as an IMAGE — a shared visual reference both the person
// and Unflump can see, rather than structured data handed to the model
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

export type DiscussTag = { entryId: string; entryType: DiscussEntryType } | null;

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
export function resolveDiscussTag(input: {
  posted: DiscussTag;
  previous: DiscussTag;
  topicEnded: boolean;
}): DiscussTag {
  // Posting a card starts that entry's discussion outright. It outranks an
  // end-of-topic declaration: the declaration is about the message the person
  // just sent, while the posting is a deliberate act of changing the subject TO
  // this entry.
  if (input.posted) return input.posted;
  if (input.previous && !input.topicEnded) return input.previous;
  return null;
}
