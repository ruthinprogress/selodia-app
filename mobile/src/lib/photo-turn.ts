// A PHOTO SHE SENT WITH NO WORDS, on the phone's side.
//
// When the image classifier cannot place a photo, it used to end the matter:
// "I couldn't quite make that out. Want to just tell me what it was instead?"
// The model had looked at it and the app had kept one word. Now the photo goes
// into the conversation as her message and Selodía says what it can see and
// asks what she wants. See app/lib/photo-turn.ts for the server half, including
// why nothing is saved from it on that turn.

import type { PickedImage } from '@/lib/image-logging';

/**
 * The text of the turn when there were no words. Never shown: a bubble with an
 * image hides it. It exists because the model needs some text beside an image,
 * and putting a question in her mouth would be the app speaking for her.
 *
 * MUST MATCH app/lib/photo-turn.ts - check-photo-turn.mjs asserts it.
 */
export const PHOTO_ONLY_MESSAGE = '[photo]';

/**
 * The most a photo turn may carry. The chat route stores a turn's image under
 * the same ceiling as an "Ask about this" card, 4 MB. A photo over it keeps the
 * existing "too big" message rather than arriving as a blank.
 */
export const MAX_PHOTO_TURN_BYTES = 4 * 1024 * 1024;

function base64Bytes(b64: string): number {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

/** Whether this photo can go into the conversation at all. */
export function fitsAPhotoTurn(image: PickedImage): boolean {
  return base64Bytes(image.base64) <= MAX_PHOTO_TURN_BYTES;
}

/** A URI the thread can draw her own photo from before anything is stored. */
export function photoUri(image: PickedImage): string {
  return `data:${image.mediaType};base64,${image.base64}`;
}

/** What a stored row's text should look like in the thread. */
export function displayedText(content: string, hasImage: boolean): string {
  return hasImage && content === PHOTO_ONLY_MESSAGE ? '' : content;
}
