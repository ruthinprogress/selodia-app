import * as ImagePicker from 'expo-image-picker';

import { authedPost } from '@/lib/api';
import type { AddSource } from '@/lib/composer-add';

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
  | { status: 'logged'; kind: Exclude<ImageKind, 'unclear'> }
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

  try {
    if (kind === 'body_measurement') {
      await authedPost('/api/parse-body-measurement', {
        imageBase64: image.base64,
        mediaType: image.mediaType,
      });
    } else if (kind === 'food') {
      await authedPost('/api/parse-food', {
        images: [{ imageBase64: image.base64, mediaType: image.mediaType }],
      });
    } else {
      await authedPost('/api/parse-activity', {
        images: [{ imageBase64: image.base64, mediaType: image.mediaType }],
      });
    }
    return { status: 'logged', kind };
  } catch {
    return { status: 'failed' };
  }
}

// What Unflump says back. The unreadable-photo line is verbatim from Part
// Fifteen's Error States - it was written for exactly this moment, and it keeps
// the fallback in-world: not being able to read an image is a real perceptual
// limit, not a build-status one.
export function messageForResult(result: ImageLogResult): string | null {
  switch (result.status) {
    case 'logged':
      // The save toast already confirms it; a second confirmation in the thread
      // would be the functional receipt the logging rules rule out.
      return null;
    case 'unclear':
      return "I couldn't quite make that out — want to just tell me what it was instead?";
    case 'too_large':
      return "That image is a bit too big for me to take in — a smaller one, or just tell me what it was?";
    case 'denied':
      return result.source === 'camera'
        ? "I don't have camera access yet — you can turn it on in your phone's settings, or just tell me what it was."
        : "I don't have access to your photos yet — you can turn it on in your phone's settings, or just tell me what it was.";
    case 'failed':
      return "Something went wrong with that image — want to try again, or just tell me what it was?";
    case 'cancelled':
    default:
      return null;
  }
}
