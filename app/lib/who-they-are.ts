// THE FACTS A FORM ASKS FOR FIRST.
//
// Found 15 October 2026, going back over the comparison run. The email draft
// written to her vein clinic ended like this:
//
//   Name: [your full name]
//   Date of birth: [your date of birth]
//   Address: [your address]
//   Telephone: [your phone number]
//
// with the reply explaining "I left those blank because I didn't have the
// details". Half of that was true. Her date of birth is in user_profile and so
// is her first name, and NEITHER reaches any prompt - the profile is read for
// working out an age and a metabolic rate and nothing passes the name or the
// date along. So the draft writer was being honest about something the app
// knew and had never told it.
//
// WHY IT MATTERS MORE THAN FOUR BLANKS LOOK. Ruth asked for drafts that land
// ready to send - "Write the draft email directly into an email client draft
// with header and email address populated". A letter that still needs four
// fields filled in before it can go is a letter she has to sit down with, and
// sitting down with it is the step where things stop happening. That is the
// same drop-off as the phone menu and the portal.
//
// WHAT IS NOT HERE, AND WHY. Her surname, address and telephone number are
// genuinely nowhere structured. They live in her care records, on the letters
// she has photographed, which is exactly what care_constants is for - so they
// arrive through the standing-details path rather than being guessed at here.
// A gap stays a gap; it is only the known facts that stop being blanks.

export type WhoTheyAre = {
  firstName: string | null;
  dateOfBirth: string | null;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * "3 March 1984" from "1984-03-03".
 *
 * WRITTEN OUT RATHER THAN LOCALISED, the same as the export page does it, so a
 * date reads identically whatever locale data the server happens to carry. A
 * date of birth read back to a receptionist in the American order is worse than
 * no date at all.
 */
function longDate(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month} ${m[1]}` : null;
}

/**
 * The block, or an empty string when nothing is known.
 *
 * SHORT ON PURPOSE. This is two facts, and dressing them up would push the
 * things that matter further down a prompt that is already long.
 */
export function whoTheyAreBlock(who: WhoTheyAre): string {
  const lines: string[] = [];
  const name = who.firstName?.trim();
  if (name) lines.push(`- First name: ${name}`);
  const dob = who.dateOfBirth ? longDate(who.dateOfBirth) : null;
  if (dob) lines.push(`- Date of birth: ${dob}`);
  if (lines.length === 0) return '';
  return [
    'WHO THEY ARE. The details a form or a reception desk asks for before anything else.',
    ...lines,
    'Use these when something is being written FOR them - a letter, an email, a form, a list to take to a desk - rather than leaving a blank for a fact already on file. Anything not listed here is genuinely not known, and a gap in square brackets saying what goes there is the honest answer for those.',
  ].join('\n');
}
