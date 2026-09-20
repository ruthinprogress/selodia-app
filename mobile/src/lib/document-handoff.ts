import type { DocumentPage } from '@/lib/document-pages';

// PASSING A PHOTOGRAPHED LETTER FROM TODAY TO CHAT.
//
// The document tray lives in Chat, because reading a letter is a conversation:
// Selodia reads it, says what it found, and asks whether to keep it. But the
// quick-log bar on Today takes photographs too, and somebody who photographs a
// consultant letter there has done nothing wrong.
//
// The alternatives were both bad. Telling her to go to Chat and do it again
// wastes the photograph she just took. Building a second tray on Today would be
// two places that read medical documents, which drift.
//
// So the page is left here and Chat collects it. A module-level box rather than
// a route param because a route param cannot carry a megabyte of base64, and
// rather than storage because this is a medical document that was never meant
// to be written anywhere - it lives in memory, for seconds, and is taken out by
// the first screen that asks.

let waiting: DocumentPage[] = [];

export function handOverDocument(pages: DocumentPage[]): void {
  waiting = pages;
}

/** Takes the pages and empties the box, so they can never be collected twice. */
export function collectDocument(): DocumentPage[] {
  const pages = waiting;
  waiting = [];
  return pages;
}

export function hasDocumentWaiting(): boolean {
  return waiting.length > 0;
}

/** Signed out, or anything else that should not leave a letter lying about. */
export function clearDocumentHandoff(): void {
  waiting = [];
}
