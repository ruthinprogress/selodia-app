import type { ClinicalDocument } from './clinical-document';

const NL = String.fromCharCode(10);

/** The paragraphs of a block of text, however its breaks were written. */
function paragraphs(text: string): string[] {
  return text
    .split(new RegExp(`${NL}+`))
    .map((p) => p.trim())
    .filter(Boolean);
}

// TURNING A READ DOCUMENT INTO SOMETHING SHE CAN USE AT A DESK.
//
// Ruth's test for this feature, in her words: "You should be able to ask
// selodia: I've been having weird symptoms in x again, can you remind me how to
// get seen?" So the card is written to be READ ALOUD and acted on, not admired.
// The order below is the order of that phone call:
//
//   who and where  ->  what to quote  ->  what was found  ->  what it means
//   ->  what was agreed  ->  how to get back in
//
// The two halves stay labelled, the way the report's summary does: what the
// letter SAYS is in the letter's words, and what it MEANS is marked as an
// explanation. A person handing this to a clinician, or reading it back to
// themselves in six months, can always tell which is which.

/**
 * What goes in the card, written to be READ.
 *
 * Ruth, on the first real document: "Very hard to read, needs much better
 * formatting in chat, with Bold headings and spacing - clear and readable for a
 * human, especially since it's a lot of data."
 *
 * So each part gets a heading in bold and a blank line around it, and nothing
 * is crammed. The headings are `**like this**`, which the chat bubble now
 * renders as weight and the report prints as plain words - the same string
 * reads properly in both places.
 */
export function cardBody(doc: ClinicalDocument): string {
  const out: string[] = [];
  const section = (heading: string, lines: string[]) => {
    if (lines.length === 0) return;
    if (out.length > 0) out.push('');
    out.push(`**${heading}**`);
    for (const l of lines) out.push(l);
  };

  const who = [doc.clinician.name, doc.clinician.role, doc.clinician.department, doc.clinician.organisation]
    .filter(Boolean)
    .join(', ');
  section('Seen by', [who, doc.dated ? `Letter dated ${longish(doc.dated)}` : ''].filter(Boolean) as string[]);

  if (doc.about) section('About', [doc.about]);

  // THE NUMBERS FIRST AMONG THE FACTS, because this is the part that replaces
  // the paper. A mark now means the two readings disagreed about the digits,
  // and nothing else - so it appears rarely, and means something when it does.
  section(
    'To quote',
    doc.references.map((r) => `${r.label}: ${r.value}${r.confirmed ? '' : '  — check this one against the letter'}`)
  );

  section(
    'Contact',
    [
      doc.contact.phone && `Phone: ${doc.contact.phone}`,
      doc.contact.secretary && `Secretary: ${doc.contact.secretary}`,
      doc.contact.email && `Email: ${doc.contact.email}`,
      doc.contact.address && `Address: ${doc.contact.address}`,
    ].filter(Boolean) as string[]
  );

  section('What the letter says', doc.says);

  if (doc.plainWords) {
    // SAID TO BE AN EXPLANATION, every time. She asked for this feature because
    // she could not follow her own letter - and the moment an explanation stops
    // being labelled as one, it starts being mistaken for what the clinician
    // wrote.
    section('In ordinary words', [
      '_An explanation of the terms above, not a new opinion._',
      '',
      ...paragraphs(doc.plainWords).flatMap((para, n) => (n === 0 ? [para] : ['', para])),
    ]);
  }

  section('Medication named', doc.medications);
  section('What was agreed', doc.plan);
  if (doc.review) section('Review', [doc.review]);
  if (doc.routeBackIn) section('If it comes back', [doc.routeBackIn]);
  section('Could not be read', doc.unreadable);

  out.push('');
  out.push(
    '_Taken from a document you photographed. The document itself is not kept._'
  );

  return out.join(NL).trim();
}

/** "4 July 2026" from "2026-07-04", and the input back if it is not a date. */
function longish(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Which Me section a document belongs in. */
export function cardSection(doc: ClinicalDocument): string {
  switch (doc.kind) {
    case 'prescription':
      return 'Medication';
    case 'appointment letter':
    case 'referral':
      return 'Appointments';
    default:
      return 'Medical history';
  }
}

/**
 * What Selodía says when the card is offered. Short, because the card is long,
 * and honest about the two things she has to check.
 */
export function offerLine(doc: ClinicalDocument): string {
  const unconfirmed = doc.references.filter((r) => !r.confirmed).length;
  const parts: string[] = [];

  parts.push(`I have read it as ${indefinite(doc.kind)}${doc.dated ? ` dated ${longish(doc.dated)}` : ''}.`);

  // NOTHING IS SAID WHEN THERE IS NOTHING TO SAY.
  //
  // This used to report the score every time - "10 of the 14 reference numbers
  // came out differently on a second reading" - which on her real MRI report
  // was both alarming and untrue: the readings had not disagreed, they had
  // merely labelled things differently. Her verdict: "it needs to just get it
  // right ... or it's actually just useless and will not be trusted."
  //
  // A clean read now says nothing at all about reading twice, because a
  // process that worked is not news. Only a genuine contradiction speaks, and
  // it says exactly which line to look at.
  if (unconfirmed > 0) {
    const which = doc.references.filter((r) => !r.confirmed).map((r) => r.label);
    parts.push(
      unconfirmed === 1
        ? `I read it twice and got a different answer for ${which[0]}, so that one is marked to check.`
        : `I read it twice and got different answers for ${list(which)}, so those are marked to check.`
    );
  }

  if (doc.unreadable.length > 0) {
    parts.push('Some of it I could not make out, and I have said which rather than guessed.');
  }

  parts.push('Want me to keep this in your Me tab?');
  return parts.join(' ');
}

/** "a, b and c". */
function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function indefinite(kind: string): string {
  return /^[aeiou]/i.test(kind) ? `an ${kind}` : `a ${kind}`;
}
