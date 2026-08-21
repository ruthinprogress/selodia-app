import { supabase } from '@/lib/supabase';

// Signed URLs for discuss-card images in the chat thread (build item 30, slice 2).
//
// The `discuss-cards` bucket is PRIVATE — these are a rendering of someone's own
// food log, which is health data — so there is no public URL to point an <Image>
// at. Each path has to be exchanged for a short-lived signed URL.

export const DISCUSS_BUCKET = 'discuss-cards';

// An hour comfortably outlives a chat session. Deliberately short rather than
// maximal: a leaked link should stop working quickly, and re-signing on the next
// history load costs one batched call.
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

// Exchange card image paths for signed URLs, as ONE batched call rather than one
// per message — a long thread could otherwise fire dozens of round trips while
// the person watches an empty screen.
//
// Returns a path -> URL map. A path that fails to sign is simply absent, so the
// caller renders that bubble without its image instead of failing the whole
// history load: a broken image is a much smaller loss than an unreadable thread.
export async function signCardImageUrls(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => typeof p === 'string' && p.length > 0))];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;

  const { data, error } = await supabase.storage
    .from(DISCUSS_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);

  if (error || !data) return out;

  for (const row of data) {
    // The batch API reports per-item failures inline rather than throwing, so a
    // single bad path never costs the rest of the batch its URLs.
    if (row.signedUrl && !row.error && typeof row.path === 'string') {
      out.set(row.path, row.signedUrl);
    }
  }
  return out;
}

// Pair each message with its signed URL, if it has an image and that image
// signed successfully. Pure and separated from the network call above so the
// mapping is testable without Supabase.
export function attachImageUrls<T extends { imagePath?: string | null }>(
  messages: T[],
  urls: Map<string, string>
): (T & { imageUri: string | null })[] {
  return messages.map((m) => ({
    ...m,
    imageUri: m.imagePath ? (urls.get(m.imagePath) ?? null) : null,
  }));
}
