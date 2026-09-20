import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
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
// at a time from the camera, and PDFs.
//
// "ALL PHOTO FORMATS" IS HANDLED BY CONVERTING, NOT BY ACCEPTING. The model
// reads PNG, JPEG, WebP and GIF, and not HEIC - which is what an iPhone writes
// by default. Every photographed page is resized and re-saved as JPEG before it
// is sent, which fixes the format and the size in one step, so what leaves the
// phone is always something the model can read and small enough to arrive.

export type DocumentPage = { base64: string; mediaType: string; label: string };

export type PickOutcome =
  | { ok: true; pages: DocumentPage[] }
  | {
      ok: false;
      reason:
        | 'cancelled'
        | 'denied'
        | 'too_large'
        | 'too_big_together'
        | 'too_many'
        | 'unsupported'
        | 'no_file_picker'
        | 'failed';
    };

/** What the server will read. Anything else is refused here rather than uploaded first. */
const READABLE = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];

/**
 * HEIC IS AN IPHONE'S NATIVE FORMAT and the model cannot read it - but the
 * resizer can OPEN it and saves everything as JPEG, so it arrives readable.
 * That is what "all photo formats" needed, and the reason this is a list of
 * things to convert rather than a list of things to refuse.
 *
 * For a stretch it was neither: readableType returned null for HEIC exactly as
 * it did for a .docx, so the three comments explaining the careful HEIC message
 * described a branch that did not exist and she would have got the generic
 * refusal. A comment describing behaviour the code does not have is worse than
 * no comment, because the next person trusts it.
 */
const CONVERTIBLE = ['image/heic', 'image/heif'];

export const MAX_PAGES = 8;

// WHAT WILL ACTUALLY GO THROUGH. The server sits behind a platform that refuses
// a request body over about 4.5MB, and base64 is a third larger than the bytes
// it carries - so the whole letter has to come in under roughly 3MB decoded.
// The old limit here was 12MB PER PAGE, which meant a two-page letter passed
// every check this file made and was then thrown away by the platform, with a
// non-JSON body the app could not read a message out of.
const MAX_ONE_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_BYTES = 3 * 1024 * 1024;

// A4 at 1800px on the long edge is about 150 dpi, which reads a hospital number
// comfortably and a printed letter easily - and lands around 400KB, so four
// pages fit where one used to. This is why the photo is taken at quality 1 and
// reduced here rather than captured small: the picker's own compression works
// on a full-resolution image and leaves a file far larger than this for no
// more legibility.
const LONG_EDGE = 1800;
const JPEG_QUALITY = 0.75;

/**
 * SHRINK A PHOTOGRAPHED PAGE UNTIL IT FITS, and leave a PDF alone - a PDF is
 * already compressed and is not an image this can open. Returns the page
 * unchanged if resizing is unavailable or fails, so the worst case is the
 * size check below refusing it with words rather than a crash.
 */
async function shrink(uri: string, mediaType: string, label: string): Promise<DocumentPage | null> {
  try {
    const context = ImageManipulator.manipulate(uri);
    context.resize({ width: LONG_EDGE });
    const image = await context.renderAsync();
    const out = await image.saveAsync({
      compress: JPEG_QUALITY,
      format: SaveFormat.JPEG,
      base64: true,
    });
    if (!out.base64) return null;
    return { base64: out.base64, mediaType: 'image/jpeg', label };
  } catch {
    // The native module is missing, or the file is not an image it can open.
    return toPage(uri, mediaType, label);
  }
}

/** Refuses a set that cannot be sent, in words that say what to do instead. */
export function tooBig(pages: DocumentPage[]): boolean {
  return pages.reduce((n, p) => n + base64Bytes(p.base64), 0) > MAX_TOTAL_BYTES;
}

/**
 * The type a file really is. A picker that reports nothing useful -
 * "application/octet-stream" is common on Android - should not cost her the
 * file when its name says plainly what it is.
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
  // Convertible rather than readable: shrink() re-saves it as JPEG on the way
  // out, so what reaches the server is a format the model accepts.
  if (CONVERTIBLE.includes(fixed) || CONVERTIBLE.includes(fromName ?? '')) return 'image/heic';
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

      // RESIZED, NOT JUST READ. The picker's base64 is the full-resolution
      // photograph, which is several times what can be sent.
      const page = await shrink(asset.uri, mediaType, asset.fileName ?? `Page ${i + 1}`);
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
      const page =
        mediaType === 'application/pdf'
          ? await toPage(asset.uri, mediaType, asset.name || 'Document')
          : await shrink(asset.uri, mediaType, asset.name || 'Document');
      if (!page) return { ok: false, reason: 'too_large' };
      if (base64Bytes(page.base64) > MAX_ONE_BYTES) return { ok: false, reason: 'too_large' };
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
      return 'One of those pages is too large to send. A photo taken in the app is usually smaller than a scan.';
    case 'too_big_together':
      return 'Those pages come to more than I can send in one go. Two or three at a time works, and I will read each set.';
    case 'too_many':
      return `That is more than ${MAX_PAGES} pages. Add the ones with the findings and the reference numbers.`;
    case 'unsupported':
      return 'That kind of file cannot be read yet. A photo of the page, or a PDF, both work.';
    case 'no_file_picker':
      return 'Opening a file needs the newer version of the app. A photo of the page works in this one.';
    default:
      return 'Something went wrong picking that. Please try again.';
  }
}
