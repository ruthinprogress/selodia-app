// THE DETAILS THAT STAY THE SAME. The app half.
//
// THE OWNER IS app/lib/care-constants.ts, which decides what counts as one,
// normalises the label and writes the row. This file only reads and names,
// because the app only displays: every constant arrives through a letter being
// read or something said in chat, and both of those run on the server.
//
// Mirrored rather than imported for the reason me-items.ts and care-admin.ts
// are: the mobile tsconfig maps `@/*` into mobile/src and nothing crosses, so a
// shared file would need a build step, and a build step exists to be forgotten.
// scripts/check-standing-details.mjs compares the two sides.

/** One standing detail. Mirrors StoredConstant in app/lib/care-constants.ts. */
export type StandingDetail = {
  id: string;
  label: string;
  value: string;
  note: string | null;
  source: 'document' | 'conversation';
  confirmed: boolean;
  updated_at: string;
};

/**
 * THE SECTION NAME, and it is not "Constants".
 *
 * Ruth's word for these is "constants", and it is the right word for what they
 * are - but it describes the data rather than the moment she needs them. She
 * opens this when a receptionist has just asked her something. So the heading
 * names the moment: these are the details she is asked for.
 */
export const DETAILS_SECTION = 'Details I Am Asked For';

/**
 * What she sees, since 20 October 2026: "Details I am asked for - rename to
 * 'Details to Access Health Care'".
 *
 * Her reason is the one above, one step on. "The details she is asked for"
 * names the moment; it does not say what the moment is FOR, which matters once
 * the section below it is called Health Care Records. These two headings now
 * read as a pair: the details you need to get care, then the records of it.
 *
 * Renamed at render, never in the database. DETAILS_SECTION above is matched
 * against stored rows.
 */
export const DETAILS_SECTION_LABEL = 'Details to Access Health Care';

/** The line under it: what belongs here, in the order it gets asked for. */
export const DETAILS_SUBTITLE = 'Numbers, memberships, references';

/**
 * What she sees before anything has arrived.
 *
 * NAMES WHAT PUTS ONE HERE, like CARE_EMPTY does, rather than reporting that a
 * table is empty. Nothing in this section is ever typed into a form, so a
 * person looking at it blank needs to know how it fills.
 */
export const DETAILS_EMPTY =
  'Nothing here yet. Tell me a number you get asked for, like your NHS number, and it lands here.';

/** Shown under a detail whose digits the two reads of a photograph disagreed on. */
export const UNCHECKED_NOTE = 'Worth checking against the letter';

/**
 * WHAT A TAP DOES.
 *
 * Ruth, 14 October 2026: "also anything that can be a live link to reduce
 * friction, should be, eg, your doctor surgery to message for referrals or apts
 * at Klinik." A surgery's booking page is a thing to open. An NHS number is a
 * thing to read out or paste into a form, and opening it would be nonsense.
 *
 * So the row decides from the value and its label, and says which it will do
 * before it is tapped. A row that sometimes opened a browser and sometimes did
 * not, with no way to tell which, would be worse than one that always did the
 * same dull thing.
 */
export type TapAction = { kind: 'open'; url: string; verb: string } | { kind: 'copy' };

/**
 * A NUMBER IS ONLY A PHONE NUMBER IF ITS LABEL SAYS SO.
 *
 * "485 777 3456" is an NHS number and "020 7946 0958" is a surgery's line, and
 * nothing in the digits tells them apart: ten against eleven is not a rule,
 * because people write both with and without spaces and some write +44. The
 * first draft of this file guessed from the digits alone and would have offered
 * to ring her NHS number - which is the exact species of guess this section
 * exists to end. So the label decides, and when the label does not say, the row
 * copies, because copying a phone number is merely unhelpful and dialling a
 * reference number is wrong.
 */
const SAYS_PHONE = /\b(phone|telephone|tel|mobile|direct line|switchboard|secretary|number to call)\b/i;

export function tapActionFor(value: string, label = ''): TapAction {
  const v = value.trim();
  if (/^https?:\/\/\S+$/i.test(v)) return { kind: 'open', url: v, verb: 'Opens this page' };
  if (/^www\.\S+\.\S+$/i.test(v)) return { kind: 'open', url: `https://${v}`, verb: 'Opens this page' };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { kind: 'open', url: `mailto:${v}`, verb: 'Starts an email' };
  if (SAYS_PHONE.test(label) && /^\+?[\d][\d\s()-]{6,}\d$/.test(v) && v.replace(/\D/g, '').length >= 9) {
    return { kind: 'open', url: `tel:${v.replace(/[\s()-]/g, '')}`, verb: 'Calls this number' };
  }
  return { kind: 'copy' };
}
