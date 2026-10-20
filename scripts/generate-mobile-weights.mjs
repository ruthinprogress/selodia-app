// COPY THE WEIGHTING TABLE ONTO THE PHONE, rather than typing it there.
//
//   node scripts/generate-mobile-weights.mjs
//
// Ruth, 20 October 2026: "Would it be useful to have a health flower in Week so
// the design could help you build a weekly plan that covers what you need?"
//
// WHY A COPY EXISTS AT ALL. The weighting table lives in app/lib, which is the
// server. The Week screen reads Supabase directly from the phone, and the
// phone's tsconfig cannot see outside mobile/ - so working out what a planned
// week covers needs the table on the phone or a round trip to ask for it.
//
// A round trip would mean an API call every time the Week tab opens, to compute
// something from rows the phone already has in its hand. So: a copy.
//
// AND A COPY IS THE THING THIS PROJECT KEEPS GETTING WRONG, which is why it is
// generated rather than maintained. The precedent is CARE_SECTION, which exists
// in both halves with the comment "Must equal the server's" - and a check that
// compares them, added the same week after a mutation test proved the check
// read only one of the two.
//
// So this writes the phone's file from the server's, the header says so, and
// check-week-flower.mjs fails if the two ever differ. Edit the server's table;
// run this; never edit the generated one.

import fs from 'node:fs';

const SOURCE = 'app/lib/activity-weights.ts';
const TARGET = 'mobile/src/lib/activity-weights.ts';

const src = fs.readFileSync(SOURCE, 'utf8');

/** Everything from the Coverage type to the end of coverageFor. */
function carve(text) {
  const from = text.indexOf('export type Coverage = {');
  const fn = text.indexOf('export function coverageFor');
  if (from === -1 || fn === -1) {
    throw new Error(`${SOURCE} no longer has the shape this generator expects`);
  }
  const end = text.indexOf('\n}', fn) + 2;
  return text.slice(from, end);
}

const body = carve(src);

const header = `// GENERATED FILE. DO NOT EDIT.
//
//   node scripts/generate-mobile-weights.mjs
//
// Copied verbatim from ${SOURCE}, which is itself generated from
// SELODIA_SPEC.md Part Eight. Three places hold these numbers now and none of
// them is typed by hand: the spec is the source, the server is parsed from it,
// and this is copied from the server.
//
// The phone needs them because the Week screen works out what a PLANNED week
// covers, and it reads its rows from Supabase directly - so asking the server
// would be an API call to compute something from data already in hand.
//
// check-week-flower.mjs fails if this file and the server's stop matching.
// Change the spec, regenerate the server's table, then run the command above.

`;

fs.writeFileSync(TARGET, header + body + '\n', 'utf8');
console.log(`\n  wrote ${TARGET} from ${SOURCE} (${body.length} chars)\n`);
