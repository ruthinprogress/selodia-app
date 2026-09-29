// DOES ONBOARDING PROMISE ANYTHING IT CANNOT DO, OR SPEAK IN THE WRONG VOICE?
//
// Two standing rules, both easy to break by accident in a screen written months
// from now, and neither visible in a typecheck.
//
// ONE: NO OFFER TO UPLOAD A LETTER. Ruth, 29 September 2026. Accepting clinical
// letters needs the Play Data Safety form and the privacy policy changed first -
// both currently say files are not collected - and letters carry NHS numbers,
// addresses and clinicians' names.
//
// The harm is specific rather than tidy-minded: a woman who reads "or upload the
// letter" puts her phone down believing the app has her surgeon's instructions.
// It does not, and it then builds her a session that breaks them. **An offer
// that opens nothing is worse than no offer at all.**
//
// TWO: SCREENS ARE IMPERSONAL. Only chat says "I". Her session brief. A screen
// that says "I'll keep that in mind" is the app claiming a memory it may not
// have, in a voice that belongs to the conversation.
//
//   node scripts/check-onboarding-copy.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'mobile', 'src', 'app', 'onboarding');

// THE TAP SPINE ONLY. The conversational screens this replaced are still in the
// repository, are still routes, and legitimately speak in the first person -
// they ARE chat. Checking them would produce a wall of false positives, which
// is how a check stops being run.
const SPINE = [
  'goals.tsx',
  'skill.tsx',
  'life-stage.tsx',
  'activities.tsx',
  'steer-around.tsx',
  'allergies.tsx',
  'guidance.tsx',
  'first-draft.tsx',
];

// Strings a screen displays. Comments are not copy, and stripping them matters:
// steer-around.tsx explains at length WHY there is no upload, and a check that
// could not tell an explanation from an offer would fail on the very file that
// gets this right.
function copyOf(text) {
  const withoutBlocks = text.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const withoutLines = withoutBlocks
    .split('\n')
    .map((l) => l.replace(/(^|\s)\/\/.*$/, ''))
    .join('\n');
  // Single- and double-quoted strings, and template literals.
  const strings = [...withoutLines.matchAll(/'([^'\\]*(\\.[^'\\]*)*)'|"([^"\\]*(\\.[^"\\]*)*)"|`([^`\\]*(\\.[^`\\]*)*)`/g)]
    .map((m) => m[1] ?? m[3] ?? m[5] ?? '')
    // Import paths, style keys and enum values are strings and are not copy.
    // Anything with a space and a lowercase letter is a sentence; anything
    // without is an identifier.
    .filter((s) => /\s/.test(s) && /[a-z]/.test(s) && !s.startsWith('@/') && !s.includes('/'));
  // JSX text between tags, which is where most copy actually lives.
  const jsx = [...withoutLines.matchAll(/>\s*([A-Z][^<>{}]{10,})\s*</g)].map((m) => m[1]);
  return [...strings, ...jsx].join('\n');
}

const UPLOAD = /\bupload(ing|ed|s)?\b|\battach(ing|ed|ment)?\b|\bphotograph the letter\b|\bsend (me |us )?(the |your )?letter\b/i;

// "I", "I'll", "I've", "my" where the app is the speaker. `I'm` and `I'll` are
// the giveaways; a bare "I" inside a quoted user sentence is not, which is why
// the prefill lines on steer-around are excluded below.
const FIRST_PERSON = /\b(I'll|I've|I'd|I'm)\b|\bI \b/;

// Copy that quotes what SHE would say is allowed to be first person - it is her
// voice, not the app's. steer-around prefills chat with her own sentence.
const HER_WORDS = [
  "There's something a clinician has told me to avoid.",
  "There's something I need to steer around.",
  "There's something I can't eat.",
];

let problems = 0;

// THE CHECK ON THE CHECK. If a deliberately bad line is not caught, the
// extraction is broken and every clean result below means nothing.
const FIXTURE = `
  const SUB = 'Tell chat, or upload the letter.';
  const NOTE = "I'll keep that in mind for you.";
`;
const fixtureCopy = copyOf(FIXTURE);
if (!UPLOAD.test(fixtureCopy) || !FIRST_PERSON.test(fixtureCopy)) {
  console.error('  SELF-TEST FAILED: the extractor cannot see copy it should catch.');
  process.exit(2);
}

// And the opposite: an explanation in a comment must NOT be read as copy.
const COMMENT_FIXTURE = `
  // THE LETTER UPLOAD IS NOT MENTIONED. Accepting an upload needs the privacy
  // policy changed first, so nothing here offers one.
  const SUB = 'Tell chat. Anything you name stays out of your sessions.';
`;
if (UPLOAD.test(copyOf(COMMENT_FIXTURE))) {
  console.error('  SELF-TEST FAILED: a comment about uploads is being read as an offer.');
  process.exit(2);
}

console.log(`  ONBOARDING COPY, the ${SPINE.length} tap screens\n`);

for (const file of SPINE) {
  const full = path.join(DIR, file);
  if (!fs.existsSync(full)) {
    problems += 1;
    console.log(`  MISSING  ${file}`);
    continue;
  }
  let copy = copyOf(fs.readFileSync(full, 'utf8'));
  for (const hers of HER_WORDS) copy = copy.split(hers).join(' ');

  const upload = copy.match(UPLOAD);
  const person = copy.match(FIRST_PERSON);

  if (upload) {
    problems += 1;
    console.log(`  OFFERS AN UPLOAD  ${file}  -> "${upload[0]}"`);
  }
  if (person) {
    problems += 1;
    console.log(`  SAYS "I"          ${file}  -> "${person[0].trim()}"`);
  }
  if (!upload && !person) console.log(`  ok  ${file}`);
}

console.log();
if (problems > 0) {
  console.log(`  ${problems} problem(s).`);
  console.log('  An offer that opens nothing is worse than no offer at all.');
} else {
  console.log(`  ${SPINE.length} screens: nothing promises an upload, and none of them says "I".`);
}
process.exitCode = problems > 0 ? 1 : 0;
