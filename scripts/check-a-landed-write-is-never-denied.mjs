// A WRITE THAT LANDED IS NEVER DENIED, AND A PLAN SAVE SAYS THAT IT LANDED.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-a-landed-write-is-never-denied.mjs
//
// WHY THIS EXISTS. Ruth, 23 October 2026, about the two evenings before it:
// "it did struggle to save things. It told me a few times, sometimes it took
// three goes for us to get the item saved."
//
// It had not struggled. The saves worked first time and the app said they had
// not, which is a different fault with the same symptom and a worse cost: she
// redid finished work, and the retries that did land made duplicates.
//
// THE RECORD, from almanac_entries and chat_messages rather than from memory:
//
//   22:10:58.957  almanac_entries  "Aspirational week (childcare pending)"
//   22:11:05.573  assistant        "The plan didn't save, and the quad rule
//                                   change didn't go through either. Nothing
//                                   changed on your Plans tab this time."
//   22:12:36      user             "Save it. And rope climbing is an adhoc thing"
//   22:13:15      assistant        "The plan is on your Plans tab..."
//   -- and NO second almanac row was ever written, because the first worked.
//
// The day before, she worked it out herself: "The calendar entry did save, all
// three times you asked."
//
// TWO FAULTS, ONE SYMPTOM, AND THIS CHECKS BOTH.
//
//   1. The plan save never called writes.record(). write-log.ts exists because
//      a hand-kept list had already forgotten three writers and "the app spent
//      weeks telling Ruth 'that did not save' about rows it had just written".
//      The plan save was the fourth and was never added.
//
//   2. The honesty guard only ever ran in one direction. It catches the app
//      claiming a write that did not happen and is blind to the app denying one
//      that did - which is the direction that makes her do the work again.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { deniesALandedWrite, stripFalseDenial, falseClaimNote } = await import(
  root + '/app/lib/claimed-write.ts'
);

// NORMALISED LINE ENDINGS, because the repository's TypeScript is CRLF and
// every anchor below is written with a bare newline. The first version of this
// did not normalise, so the block anchors silently matched nothing and one
// check passed by searching the whole rest of the file instead of the block it
// names - an anchor made of syntax, which is a pattern this repo has already
// written down once.
const ROUTE = readFileSync('app/api/ask-selodia/route.ts', 'utf8').split('\r\n').join('\n');

let pass = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    pass += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

// -- 1. THE WRITE REGISTERS ITSELF -----------------------------------------
//
// ANCHORED ON THE CALL SITE, not on a line number and not on the word "plan"
// appearing somewhere in the file. The rule write-log.ts states is that a
// writer records on the same lines that wrote it, so that is what is checked:
// between saveAlmanacEntry and the end of its block there must be a record.

// THE BLOCK, NOT A CHARACTER COUNT. The first version of this sliced 2000
// characters after the call and failed on a correct file, because the comment
// explaining the fix pushed the record to 2211. A window chosen by eye is an
// anchor made of nothing; the end of the enclosing block is a real one.
function blockAfter(needle) {
  const at = ROUTE.indexOf(needle);
  if (at < 0) return null;
  const end = ROUTE.indexOf('\n  }\n', at);
  // NO SILENT FALLBACK TO THE WHOLE FILE. That is how the first version passed:
  // the anchor matched nothing, it searched everything after the call site, and
  // found the record in an unrelated block.
  return end < 0 ? null : ROUTE.slice(at, end);
}

check('the almanac save records itself in the write log', () => {
  const block = blockAfter('const entry = await saveAlmanacEntry(');
  assert.ok(block, 'saveAlmanacEntry call site not found - this check is anchored on it');
  assert.match(
    block,
    /writes\.record\(\s*['"]plan['"]\s*\)/,
    'the plan save does not call writes.record("plan"), so nothing downstream can '
      + 'know it happened - this is the 22 October fault exactly'
  );
});

check('the recorded name is the one the subject map knows', () => {
  // A record under a name no prose-matcher knows would pass the test above and
  // still leave the denial uncorrected: the guard would find nothing to match.
  assert.ok(
    deniesALandedWrite("The plan didn't save.", ['plan']) !== null,
    'the write-log name used at the call site is not one stripFalseDenial can match'
  );
});

// -- 2. HER ACTUAL SENTENCES ------------------------------------------------

const HERS =
  "The plan didn't save, and the quad rule change didn't go through either. "
  + 'Nothing changed on your Plans tab this time.';

check('her 22:11 reply is recognised as denying a landed write', () => {
  assert.ok(deniesALandedWrite(HERS, ['plan']), 'not caught');
});

check('her 22:11 reply has both denials removed', () => {
  const out = stripFalseDenial(HERS, ['plan']);
  assert.doesNotMatch(out, /did ?n'?t save/i, 'the first denial survived');
  assert.doesNotMatch(out, /Nothing changed on your Plans tab/i, 'the second denial survived');
});

check('the 22:43 reply about two sessions is caught', () => {
  const r = "Yes, the leg-height work is in now. Both sessions didn't save, though, "
    + 'so nothing new is on your Plans tab yet.';
  assert.ok(deniesALandedWrite(r, ['plan']), 'not caught');
  const out = stripFalseDenial(r, ['plan']);
  assert.match(out, /leg-height work is in now/i, 'it took out the true half as well');
  assert.doesNotMatch(out, /did ?n'?t save/i, 'the denial survived');
});

// -- 3. THE THINGS IT MUST NOT TOUCH ---------------------------------------
//
// These are the whole risk. A guard that removes a TRUE denial hides a real
// loss, which is the failure this app cares most about. Each of these is a
// sentence that must survive.

check('a denial is kept when nothing landed', () => {
  assert.equal(deniesALandedWrite(HERS, []), null, 'corrected a true denial');
  assert.equal(stripFalseDenial(HERS, []), HERS, 'rewrote a reply it should not touch');
});

check('a denial about something else is kept', () => {
  // The plan landed; the sleep log genuinely did not. Her 21 October evening.
  const r = "That didn't save, so your sleep log is still empty.";
  assert.equal(deniesALandedWrite(r, ['plan']), null, 'removed a true denial about sleep');
  assert.equal(stripFalseDenial(r, ['plan']), r, 'rewrote it anyway');
});

check('a partial denial keeps the part that is true', () => {
  const r = 'The plan is saved. Your sleep log still did not save.';
  const out = stripFalseDenial(r, ['plan']);
  assert.match(out, /sleep log still did not save/i, 'took out the true half');
});

check('an offer to try again is not a denial', () => {
  const r = 'Shall I try saving the plan again?';
  assert.equal(deniesALandedWrite(r, ['plan']), null, 'treated an offer as a denial');
});

check('an ordinary reply is returned unchanged', () => {
  const r = 'Your week now has every session we planned.';
  assert.equal(stripFalseDenial(r, ['plan', 'week entry']), r, 'rewrote an innocent reply');
});

// -- 3b. THE RESCUE IS NOT TIGHTER THAN WHAT IT RESCUES --------------------
//
// The lead turn is redone on the ordinary model when the lead model runs out of
// room. That retry was capped at 2000 while the lead itself had 8000, so the
// one failure it most needed to fix was the one it could not: a reply that did
// not fit in eight thousand tokens was retried with two. 22 October, 22:08.

// ANCHORED ON THE REQUEST, NOT ON THE WINDOW. The first version of this
// searched 2500 characters after the log line and passed on a mutant, because
// the diagnostics block a few lines above records max_tokens as a DETAIL and
// the pattern found that instead of the one on the call. Two occurrences, and
// it matched the one that does not configure anything.
check('the lead-turn redo gets at least the room the lead had', () => {
  const at = ROUTE.indexOf('redoing the turn the usual way');
  assert.ok(at > 0, 'the redo branch was not found - this check is anchored on it');
  const block = ROUTE.slice(at, at + 3000);
  assert.match(
    block,
    /max_tokens:\s*LEAD_FIRST_MAX_TOKENS,\s*\n\s*system: firstSystem\.map/,
    'the redo uses a smaller ceiling than the call it is replacing, so a reply that '
      + 'overran the lead model can only overrun again'
  );
});

check('the redo records why it happened', () => {
  const at = ROUTE.indexOf('redoing the turn the usual way');
  const block = ROUTE.slice(at, at + 2500);
  assert.match(
    block,
    /recordRouteError/,
    'the fallback leaves no trace, so which reason fired can only be guessed at later'
  );
});

// -- 4. THE OTHER DIRECTION STILL WORKS ------------------------------------

check('a false success claim is still caught', () => {
  assert.ok(falseClaimNote({ reply: "Noted.", wrote: [] }), 'the original guard stopped working');
});

check('a true success claim is still left alone', () => {
  assert.equal(falseClaimNote({ reply: 'Noted.', wrote: ['plan'] }), null, 'fired on a real write');
});

// -- 5. EVERY CASE ABOVE MUST BE ABLE TO FAIL -------------------------------
//
// A check nobody has watched fail is a check nobody knows works. Each of these
// is the assertion above with its premise inverted; every one must throw.

const useless = [];
function mustFail(name, fn) {
  try {
    fn();
    useless.push(name);
  } catch {
    /* threw, which is the point */
  }
}

mustFail('denial detection', () =>
  assert.equal(deniesALandedWrite(HERS, ['plan']), null)
);
mustFail('denial removal', () =>
  assert.match(stripFalseDenial(HERS, ['plan']), /did ?n'?t save/i)
);
mustFail('true denial preserved', () =>
  assert.ok(deniesALandedWrite("That didn't save, so your sleep log is still empty.", ['plan']))
);
mustFail('write-log call site present', () =>
  assert.doesNotMatch(
    blockAfter('const entry = await saveAlmanacEntry(') ?? '',
    /writes\.record\(\s*['"]plan['"]\s*\)/
  )
);

for (const f of failures) console.log(`  FAIL  ${f}`);
for (const u of useless) console.log(`  USELESS  "${u}" passed with its premise inverted`);

const total = pass + failures.length;
console.log(`${pass}/${total} passed, ${failures.length} failed, ${useless.length} useless`);
process.exit(failures.length + useless.length > 0 ? 1 : 0);
