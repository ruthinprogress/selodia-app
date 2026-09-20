import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import { ApiError, authedPost } from '@/lib/api';
import { base64Bytes } from '@/lib/image-logging';

// A MEDICAL DOCUMENT, PAGE BY PAGE (Ruth, 20 September 2026).
//
// "I wanted to upload the consultant letter with the mri results and the letter
// so it could extract it and add summary to Me tab ... I didnt understand the
// letter fully tbh. This is something selodia needs to be able to do to help
// ppl."
//
// WHY PAGES ARE COLLECTED BEFORE ANYTHING IS READ. A consultant letter runs to
// three sides, and the parts she needs are never on one of them: the hospital
// number is on the first, the findings in the middle, the route back in at the
// end. Reading each photograph as it arrives would produce three records of one
// letter, each missing what the others had. So pages accumulate, and the read
// happens once, on all of them.
//
// Asked how multi-page should work, she declined the incremental option:
// "Lets just get those right the first time. Please make it so it can accept
// all photo formats and pdf." So: several photos at once from the gallery, one
// at a time from the camera, PDFs, and the formats a phone actually produces -
// including HEIC, which is what an iPhone writes by default and which every
// other path in this app quietly refuses.

export type DocumentPage = { base64: string; mediaType: string; label: string };

export type PickOutcome =
  | { ok: true; pages: DocumentPage[] }
  | { ok: false; reason: 'cancelled' | 'denied' | 'too_large' | 'too_many' | 'unsupported' | 'no_file_picker' | 'failed' };

/** What the server will read. Anything else is refused here rather than uploaded first. */
const READABLE = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
];

export const MAX_PAGES = 8;
const MAX_ONE_BYTES = 12 * 1024 * 1024;

/**
 * HEIC IS NOT A CURIOSITY, it is what an iPhone writes by default, and "all
 * photo formats" was the instruction. The other paths in this app normalise to
 * four types and drop the rest; a letter is exactly the thing somebody will
 * have photographed months ago on a phone that writes HEIC.
 */
export function readableType(mimeType: string | undefined, name?: string): string | null {
  const fromName = (() => {
    const ext = (name ?? '').toLowerCase().split('.').pop() ?? '';
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'heic') return 'image/heic';
    if (ext === 'heif') return 'image/heif';
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    return null;
  })();

  const raw = (mimeType ?? '').toLowerCase().split(';')[0].trim();
  const fixed = raw === 'image/jpg' ? 'image/jpeg' : raw;
  if (READABLE.includes(fixed)) return fixed;
  // A picker that reports nothing useful ("application/octet-stream" is common
  // on Android) should not cost her the file when the name says what it is.
  return fromName;
}

/**
 * CAN THIS BUILD OPEN A FILE? expo-document-picker is a native module, and an
 * over-the-air update cannot add native code. So on the build she is carrying
 * today the JavaScript is present and the native side is not, and calling it
 * throws. Rather than show her a control that fails (principle 8: never a
 * control that does nothing), the option is hidden until the build that has it.
 */
export function canPickFiles(): boolean {
  try {
    return typeof DocumentPicker?.getDocumentAsync === 'function';
  } catch {
    return false;
  }
}

async function toPage(uri: string, mediaType: string, label: string): Promise<DocumentPage | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    if (!base64 || base64Bytes(base64) > MAX_ONE_BYTES) return null;
    return { base64, mediaType, label };
  } catch {
    return null;
  }
}

/** Several pages at once from the gallery, or one from the camera. */
export async function pickPageImages(source: 'camera' | 'library'): Promise<PickOutcome> {
  try {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return { ok: false, reason: 'denied' };

    // QUALITY 1, unlike every other photo path in this app. Those compress to
    // 0.6 because a plate of food survives it. Small printed type does not, and
    // the thing being read here is a hospital number.
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: 'images',
      quality: 1,
      base64: true,
      allowsMultipleSelection: source === 'library',
      selectionLimit: MAX_PAGES,
    };

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return { ok: false, reason: 'cancelled' };

    const assets = result.assets ?? [];
    if (assets.length === 0) return { ok: false, reason: 'failed' };
    if (assets.length > MAX_PAGES) return { ok: false, reason: 'too_many' };

    const pages: DocumentPage[] = [];
    for (const [i, asset] of assets.entries()) {
      const mediaType = readableType(asset.mimeType, asset.fileName ?? undefined);
      if (!mediaType) return { ok: false, reason: 'unsupported' };

      // base64 comes back from the picker for most formats; a file read is the
      // fallback, and the only route for anything the picker hands over as a
      // URI alone.
      const page = asset.base64
        ? { base64: asset.base64, mediaType, label: asset.fileName ?? `Page ${i + 1}` }
        : await toPage(asset.uri, mediaType, asset.fileName ?? `Page ${i + 1}`);

      if (!page) return { ok: false, reason: 'too_large' };
      if (base64Bytes(page.base64) > MAX_ONE_BYTES) return { ok: false, reason: 'too_large' };
      pages.push(page);
    }

    return { ok: true, pages };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/** A PDF, or a photo already saved as a file. Needs the build that has the picker. */
export async function pickPageFiles(): Promise<PickOutcome> {
  if (!canPickFiles()) return { ok: false, reason: 'no_file_picker' };
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: READABLE,
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return { ok: false, reason: 'cancelled' };

    const assets = result.assets ?? [];
    if (assets.length === 0) return { ok: false, reason: 'failed' };
    if (assets.length > MAX_PAGES) return { ok: false, reason: 'too_many' };

    const pages: DocumentPage[] = [];
    for (const asset of assets) {
      const mediaType = readableType(asset.mimeType, asset.name);
      if (!mediaType) return { ok: false, reason: 'unsupported' };
      const page = await toPage(asset.uri, mediaType, asset.name || 'Document');
      if (!page) return { ok: false, reason: 'too_large' };
      pages.push(page);
    }

    return { ok: true, pages };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export type ReadDocumentResult =
  | {
      ok: true;
      card: { title: string; section: string; body: string };
      message: string;
    }
  | { ok: false; message: string };

/**
 * Sends every page as one document and returns the offer. Nothing is saved by
 * this call: the server holds the card as a pending save, and it is written
 * only when she says yes in the conversation.
 */
export async function readDocument(pages: DocumentPage[]): Promise<ReadDocumentResult> {
  try {
    const res = await authedPost<{
      card?: { title: string; section: string; body: string };
      message?: string;
    }>('/api/parse-document', {
      pages: pages.map((p) => ({ base64: p.base64, mediaType: p.mediaType })),
    });
    if (!res.card || !res.message) throw new Error('empty');
    return { ok: true, card: res.card, message: res.message };
  } catch (err) {
    return {
      ok: false,
      message:
        (err instanceof ApiError && err.userMessage) ||
        'I could not read that just now. Nothing was saved.',
    };
  }
}

/** What she is told when picking did not produce pages. */
export function pickFailureMessage(reason: Exclude<PickOutcome, { ok: true }>['reason']): string | null {
  switch (reason) {
    case 'cancelled':
      return null;
    case 'denied':
      return 'Selodía needs permission to open your photos before it can read a document.';
    case 'too_large':
      return 'One of those pages is too large to read. A photo taken in the app is usually smaller.';
    case 'too_many':
      return `That is more than ${MAX_PAGES} pages. Add the ones with the findings and the reference numbers.`;
    case 'unsupported':
      return 'That kind of file cannot be read. A photo or a PDF works.';
    case 'no_file_picker':
      return 'Opening a file needs the newer version of the app. A photo of the page works in this one.';
    default:
      return 'Something went wrong picking that. Please try again.';
  }
}
