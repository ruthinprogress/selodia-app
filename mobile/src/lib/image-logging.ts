import * as ImagePicker from 'expo-image-picker';

import { authedPost } from '@/lib/api';
import type { AddSource } from '@/lib/composer-add';
import { activityAckFacts, bodyAckFacts, foodAckFacts } from '@/lib/log-acknowledgment-facts';
import { persistLogTurn } from '@/lib/log-turn';

// Logging by photo (build item 10b, step 3).
//
// Pick an image, classify it once, and hand it to whichever parse path already
// handles that kind. The person is never asked to categorise their own photo -
// the sheet asks only where the image comes from (Part Five, The Chat composer).

// Compressed on the way out. A raw phone photo is 5-10MB, and base64 inflates
// it by a third, so sending one untouched would be a slow multi-megabyte upload
// on mobile data. Quality is low enough to keep the payload sane and high
// enough to read a scale display, which is the hardest thing here.
const PICKER_QUALITY = 0.6;

// Matches the classify route's ceiling. Checked here too so an oversized image
// fails immediately with something readable rather than after a long upload.
const MAX_BASE64_BYTES = 8 * 1024 * 1024;

export type ImageKind = 'body_measurement' | 'food' | 'activity' | 'unclear';

export type PickedImage = { base64: string; mediaType: string };

export type ImageLogResult =
  // `message` is the composed acknowledgment - the facts block, the
  // interpretation layer's own words, and the read that follows. Null when the
  // acknowledgment could not be built, which degrades the reply rather than the
  // log: the data is saved either way.
  // foodLogId rides along for a FOOD log only: it is what lets the chat render
  // the itemised table under the acknowledgment, the same way the text path does.
  | {
      status: 'logged';
      kind: Exclude<ImageKind, 'unclear'>;
      message: string | null;
      foodLogId?: string | null;
    }
  | { status: 'unclear' }
  | { status: 'cancelled' }
  | { status: 'denied'; source: AddSource }
  | { status: 'too_large' }
  | { status: 'failed' };

// Anthropic accepts these; anything else is refused rather than sent and
// rejected downstream.
const SUPPORTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export function normalizeMediaType(mimeType: string | undefined): string | null {
  if (!mimeType) return null;
  const m = mimeType.toLowerCase().split(';')[0].trim();
  // Some pickers report jpg rather than jpeg.
  const fixed = m === 'image/jpg' ? 'image/jpeg' : m;
  return SUPPORTED.includes(fixed) ? fixed : null;
}

export function base64Bytes(base64: string): number {
  // Base64 encodes 3 bytes as 4 characters; padding trims a byte or two.
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export async function pickImage(source: AddSource): Promise<
  { ok: true; image: PickedImage } | { ok: false; reason: 'cancelled' | 'denied' | 'too_large' | 'failed' }
> {
  try {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return { ok: false, reason: 'denied' };

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: 'images',
      quality: PICKER_QUALITY,
      base64: true,
      allowsMultipleSelection: false,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled) return { ok: false, reason: 'cancelled' };

    const asset = result.assets?.[0];
    const mediaType = normalizeMediaType(asset?.mimeType);
    if (!asset?.base64 || !mediaType) return { ok: false, reason: 'failed' };
    if (base64Bytes(asset.base64) > MAX_BASE64_BYTES) return { ok: false, reason: 'too_large' };

    return { ok: true, image: { base64: asset.base64, mediaType } };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

// Classify, then send to the route that already handles that kind.
//
// 'unclear' deliberately has no fallback route. Guessing would file the photo
// against the wrong kind of the person's real data, so the caller falls back to
// asking them in words - which the text pipeline already handles perfectly.
export async function classifyAndLog(image: PickedImage): Promise<ImageLogResult> {
  let kind: ImageKind;
  try {
    const res = await authedPost<{ kind: ImageKind }>('/api/classify-image', {
      imageBase64: image.base64,
      mediaType: image.mediaType,
    });
    kind = res.kind;
  } catch {
    return { status: 'failed' };
  }

  if (kind === 'unclear') return { status: 'unclear' };

  // What each parse route hands back differs, so the saved row is captured here
  // rather than discarded - it is the raw material for the acknowledgment.
  let facts: unknown;
  let foodLogId: string | null = null;
  try {
    if (kind === 'body_measurement') {
      const saved = await authedPost<Record<string, never>>('/api/parse-body-measurement', {
        imageBase64: image.base64,
        mediaType: image.mediaType,
      });
      facts = await bodyAckFacts(saved as never);
    } else if (kind === 'food') {
      // parse-food returns the inserted food_logs row, so the id is already here.
      const saved = await authedPost<{ id?: string }>('/api/parse-food', {
        images: [{ imageBase64: image.base64, mediaType: image.mediaType }],
      });
      foodLogId = typeof saved?.id === 'string' ? saved.id : null;
      facts = await foodAckFacts(saved as never);
    } else {
      // `dailySummary` comes back INSTEAD of entries when the photo was a
      // whole-day tracker screen: nothing was logged as an activity, and the
      // acknowledgment has to say that rather than announce an empty log.
      const saved = await authedPost<{ entries: unknown[]; dailySummary?: unknown }>(
        '/api/parse-activity',
        { images: [{ imageBase64: image.base64, mediaType: image.mediaType }] }
      );
      facts = activityAckFacts((saved.entries ?? []) as never, (saved.dailySummary ?? null) as never);
    }
  } catch {
    return { status: 'failed' };
  }

  // The log has already succeeded by this point. An acknowledgment that fails
  // must never turn a saved reading into an error message, so this is caught
  // separately and degrades to a quiet save.
  let message: string | null = null;
  try {
    const ack = await authedPost<{ message: string }>('/api/acknowledge-log', { kind, facts });
    message = ack.message ?? null;
  } catch {
    message = null;
  }

  // Into the thread, not just onto the screen. Done HERE rather than in each
  // caller so every photo log gets it - the Chat composer, the food quick-log
  // and the activity quick-log all go through this one function, and a caller
  // that forgot would silently reintroduce the vanishing-history bug this
  // fixes. Awaited so the row exists before the caller navigates or refreshes.
  if (message) await persistLogTurn(message, foodLogId);

  return { status: 'logged', kind, message, foodLogId };
}

// What Selodia says back. The unreadable-photo line is verbatim from Part
// Fifteen's Error States - it was written for exactly this moment, and it keeps
// the fallback in-world: not being able to read an image is a real perceptual
// limit, not a build-status one.
export function messageForResult(result: ImageLogResult): string | null {
  switch (result.status) {
    case 'logged':
      // Reversed 2026-08-26. This returned null on the reasoning that a reply
      // would be the functional receipt ask-unflump's prompt forbids. That rule
      // is about the TEXT path, where the person has just spoken and the reply
      // belongs to what they said. A photo has no utterance to reply to, so
      // silence here is not restraint - it is a log that vanishes into a toast.
      // See app/lib/log-acknowledgment.ts for the full reasoning.
      return result.message;
    case 'unclear':
      return "I couldn't quite make that out. Want to just tell me what it was instead?";
    case 'too_large':
      return "That image is a bit too big for me to take in. A smaller one, or just tell me what it was?";
    case 'denied':
      return result.source === 'camera'
        ? "I don't have camera access yet. You can turn it on in your phone's settings, or just tell me what it was."
        : "I don't have access to your photos yet. You can turn it on in your phone's settings, or just tell me what it was.";
    case 'failed':
      return "Something went wrong with that image. Want to try again, or just tell me what it was?";
    case 'cancelled':
    default:
      return null;
  }
}
