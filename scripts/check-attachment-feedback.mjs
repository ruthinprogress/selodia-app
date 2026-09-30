// A REJECTED ATTACHMENT ALWAYS SAYS SO, AND THE VOTE NEVER TOUCHES THE PHOTO.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-attachment-feedback.mjs
//
// Ruth, 30 September 2026. The camera opened, she took the shot, the app
// thought for about a second, and nothing appeared and nothing was said. She
// had no way to tell that from a bug.
//
// THE CAUSE WAS ONE MISSING ELSE. The server returns 422 not_a_document for a
// photograph - her own decision of 21 September, and still the rule - and the
// client did `if (res.attachment)` with nothing after it, so the refusal was
// thrown away. A refusal that says nothing is worse than a refusal.
//
// Photographs stay parked until after wave zero. What changed is honesty: the
// screen says what it takes before she reaches for the camera, a refusal is
// spoken, and there is a way to ask for photos rather than a dead end.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// COMMENTS ARE NOT COPY. These files quote her briefs at length - "I'm seeing
// my vascular consultant", "no screenshot", "no photos in the app" - and the
// first run of this check reported all three as faults in the interface. A
// check that is wrong about the cases you can read by eye is a check nobody
// runs twice. check-founder-not-named carries the same lesson and the same fix.
const stripComments = (src) =>
  src
    .split('\r\n')
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');

const read = (f) => stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));

const screen = read('mobile/src/app/settings/report.tsx');
const vote = read('mobile/src/lib/feature-vote.ts');

let pass = 0;
const failures = [];
const check = (name, fn) => {
  try {
    fn();
    pass += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
};

// ------------------------------------------------------- the silence is over

check('a response with no attachment shows a message', () => {
  // The exact shape of the bug: an if with no else.
  const bare = /if \(res\.attachment\) setAttachments/.test(screen);
  assert.ok(!bare, 'the bare `if (res.attachment) setAttachments` is back - a 422 would be swallowed');
  assert.ok(
    /} else \{[\s\S]{0,600}setFailed\(NOT_A_DOCUMENT\)/.test(screen),
    'there must be an else that says why nothing was added'
  );
});

check('the photo refusal names photos and does not promise them', () => {
  assert.ok(/looks like a photo rather than a document/i.test(screen));
  assert.ok(/aren't supported yet/i.test(screen));
  assert.ok(!/coming soon|will be supported|shortly/i.test(screen), 'nothing may promise photos');
});

check('any other failure says something too', () => {
  assert.ok(/That couldn't be added\. Try again\./.test(screen));
});

check('the section says what it takes, before she reaches for the camera', () => {
  assert.ok(/Add letters, results and other documents\. No photos yet\./.test(screen));
});

check('the camera option says what it is for', () => {
  assert.ok(/Photograph a letter or document/.test(screen));
  assert.ok(!/label: 'Photograph one'/.test(screen), 'the old ambiguous label is back');
});

// ------------------------------------------------------------------- the vote

check('the vote button reads as a vote, never as an upload', () => {
  assert.ok(/Tap here to vote for adding photos to reports\./.test(screen));
  assert.ok(!/upload a photo|add a photo here/i.test(screen));
});

check('the wording after a tap is hers', () => {
  assert.ok(/Thanks, your vote is counted\./.test(vote));
  assert.ok(/You've already voted\./.test(vote));
});

check('screens stay impersonal and free of em dashes', () => {
  for (const [what, src] of [['the vote strings', vote], ['the screen strings', screen]]) {
    const strings = [...src.matchAll(/'([^'\\]{12,})'|"([^"\\]{12,})"/g)]
      .map((m) => m[1] ?? m[2])
      // Only the sentences shown to somebody; identifiers and paths are not copy.
      .filter((t) => /[.!?]$/.test(t) && / /.test(t));
    for (const t of strings) {
      assert.ok(!/\u2014/.test(t), `${what}: em dash in "${t}"`);
      assert.ok(!/\bI\b|\bwe\b|\bWe\b/.test(t), `${what}: a screen said I or we in "${t}"`);
    }
  }
});

check('the vote stores nothing but the fact of it', () => {
  const insert = vote.slice(vote.indexOf('.insert('), vote.indexOf('if (!error)'));
  assert.ok(/user_id/.test(insert) && /feature/.test(insert), 'it must record who and which feature');
  for (const forbidden of ['base64', 'screenshot', 'image', 'caption', 'uri', 'photo']) {
    assert.ok(
      !new RegExp(forbidden, 'i').test(insert),
      `the vote row must never carry ${forbidden}`
    );
  }
});

check('one vote per person is enforced by the database, not by the app', () => {
  assert.ok(/23505/.test(vote), 'a duplicate must be recognised as an outcome, not an error');
});

check('the feature is a parameter so it can be reused', () => {
  assert.ok(/VotableFeature/.test(vote));
  assert.ok(/voteForFeature\(feature: VotableFeature\)/.test(vote));
});

// --------------------------------------------------------------------- MUTATION

const silentAgain = screen.replace(
  /} else \{[\s\S]*?setFailed\(NOT_A_DOCUMENT\);[\s\S]*?\}/,
  '}'
);
const caught = !/setFailed\(NOT_A_DOCUMENT\)/.test(silentAgain);
if (!caught) failures.push('USELESS: removing the else did not fail the check');

for (const f of failures) console.error('  FAIL  ' + f);
console.log(`\n  ${pass} passed, ${failures.length} failed`);
console.log(`  Proof: restoring the silent failure is caught = ${caught}`);
if (failures.length > 0) process.exit(1);
