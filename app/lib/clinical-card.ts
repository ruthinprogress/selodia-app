import type { ClinicalDocument } from './clinical-document';

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

/** What goes in the Me card's body, as readable text. */
export function cardBody(doc: ClinicalDocument): string {
  const out: string[] = [];

  const who = [
    doc.clinician.name,
    doc.clinician.role,
    doc.clinician.department,
    doc.clinician.organisation,
  ]
    .filter(Boolean)
    .join(', ');
  if (who) out.push(`Seen by: ${who}`);
  if (doc.dated) out.push(`Letter dated: ${doc.dated}`);
  if (doc.about) out.push(`About: ${doc.about}`);

  // THE NUMBERS FIRST, because this is the part that replaces the paper. An
  // unconfirmed one is marked rather than hidden: she can check it against the
  // letter while she still has it, which is exactly when the mark is useful.
  if (doc.references.length > 0) {
    out.push('');
    out.push('To quote:');
    for (const ref of doc.references) {
      out.push(`  ${ref.label}: ${ref.value}${ref.confirmed ? '' : '  (check this against the letter)'}`);
    }
  }

  const contact = [
    doc.contact.phone && `Phone: ${doc.contact.phone}`,
    doc.contact.secretary && `Secretary: ${doc.contact.secretary}`,
    doc.contact.email && `Email: ${doc.contact.email}`,
    doc.contact.address && `Address: ${doc.contact.address}`,
  ].filter(Boolean) as string[];
  if (contact.length > 0) {
    out.push('');
    out.push('Contact:');
    for (const line of contact) out.push(`  ${line}`);
  }

  if (doc.says.length > 0) {
    out.push('');
    out.push('What the letter says:');
    for (const line of doc.says) out.push(`  ${line}`);
  }

  if (doc.plainWords) {
    out.push('');
    // SAID TO BE AN EXPLANATION, every time. She asked for this feature because
    // she could not follow her own letter - and the moment an explanation stops
    // being labelled as one, it starts being mistaken for what the clinician
    // wrote.
    out.push('In ordinary words (an explanation of the terms above, not a new opinion):');
    out.push(`  ${doc.plainWords}`);
  }

  if (doc.medications.length > 0) {
    out.push('');
    out.push('Medication named:');
    for (const line of doc.medications) out.push(`  ${line}`);
  }

  if (doc.plan.length > 0) {
    out.push('');
    out.push('What was agreed:');
    for (const line of doc.plan) out.push(`  ${line}`);
  }

  if (doc.review) {
    out.push('');
    out.push(`Review: ${doc.review}`);
  }

  if (doc.routeBackIn) {
    out.push('');
    out.push(`If it comes back: ${doc.routeBackIn}`);
  }

  if (doc.unreadable.length > 0) {
    out.push('');
    out.push('Could not be read from the photo:');
    for (const line of doc.unreadable) out.push(`  ${line}`);
  }

  out.push('');
  out.push(
    'Taken from a document you photographed. The document itself is not kept, so check anything marked before you rely on it.'
  );

  return out.join('\n').trim();
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

  parts.push(`I have read it as ${indefinite(doc.kind)}${doc.dated ? ` dated ${doc.dated}` : ''}.`);

  if (doc.references.length > 0) {
    parts.push(
      unconfirmed === 0
        ? `I read the reference numbers twice and got the same answer both times.`
        : unconfirmed === doc.references.length
          ? `I could not get the same reading twice on the reference numbers, so check them against the letter before you quote them.`
          : `${unconfirmed} of the ${doc.references.length} reference numbers came out differently on a second reading, and ${unconfirmed === 1 ? 'is' : 'are'} marked to check.`
    );
  }

  if (doc.unreadable.length > 0) {
    parts.push(`Some of it I could not make out, and I have said which rather than guessed.`);
  }

  parts.push('Want me to keep this in your Me tab?');
  return parts.join(' ');
}

function indefinite(kind: string): string {
  return /^[aeiou]/i.test(kind) ? `an ${kind}` : `a ${kind}`;
}
