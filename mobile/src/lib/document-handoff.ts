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
// WHETHER CHAT SHOULD READ IT ON ARRIVAL OR WAIT FOR MORE PAGES (14 October
// 2026). One rule, both screens: something chosen from the gallery is read
// straight away, because everything she meant to send was in her hand when she
// chose it. Something photographed waits, because the next side of the letter
// is still on the table. Ruth on the old behaviour, which asked either way:
// "wierd screen comes up adking if you want the upload read....obviously you
// do, it's uncessary extra step."
let readOnArrival = false;

export function handOverDocument(pages: DocumentPage[], opts?: { readNow?: boolean }): void {
  waiting = pages;
  readOnArrival = opts?.readNow === true;
}

/** Takes the pages and empties the box, so they can never be collected twice. */
export function collectDocument(): { pages: DocumentPage[]; readNow: boolean } {
  const pages = waiting;
  const readNow = readOnArrival;
  waiting = [];
  readOnArrival = false;
  return { pages, readNow };
}

export function hasDocumentWaiting(): boolean {
  return waiting.length > 0;
}

/** Signed out, or anything else that should not leave a letter lying about. */
export function clearDocumentHandoff(): void {
  waiting = [];
  readOnArrival = false;
}
