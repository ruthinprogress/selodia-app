// REPLAYING THE PEANUT BUTTER TURN AGAINST OLD AND NEW BEHAVIOUR.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-claimed-write.mjs
//
// Ruth, 30 September 2026: "The write-confirmation guard is now justified by
// the peanut butter case (a real false 'noted', nothing written 20:22 to
// 20:27). Build it, generally... Replay the 20:23 message against old and new
// behaviour."
//
// So the actual turn is the first fixture, in its real wording, with the real
// outcome:
//
//   20:23:01  her:  "Oh please add"
//   20:23:10  app:  "Two spoons of peanut butter added to the yoghurt bowl, noted."
//   database: nothing between 20:22 and 20:27, and the dinner entry's five
//             items carry no peanut butter.
//
// THE OLD BEHAVIOUR IS save-honesty.unsavedNote, which is what actually ran
// that night. It is not a strawman: it is imported and called here, and it
// returns null for this turn because nothing ATTEMPTED a write. That silence
// was correct by its own rules and wrong for her.
//
// The hard half of this check is the false positives. A guard that corrects a
// true sentence is worse than no guard - it would have produced the coffee loop
// of 27 September, where one reply said both "that's logged fine" and "it looks
// like that entry didn't save". Most of the cases below are sentences that must
// NOT be touched.

import assert from 'node:assert';

import { claimsAWrite, falseClaimNote, stripMachineOutput } from '../app/lib/claimed-write.ts';
import { unsavedNote } from '../app/lib/save-honesty.ts';

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

// ---------------------------------------------------------- THE REAL TURN

const PEANUT_REPLY = 'Two spoons of peanut butter added to the yoghurt bowl, noted.';

check('OLD: save-honesty stayed silent, because nothing attempted a write', () => {
  const old = unsavedNote({ intent: 'food', landed: [], missed: [], attempted: false });
  assert.equal(old, null, 'the old path is expected to say nothing - that is the bug');
});

check('NEW: the false claim is caught', () => {
  const note = falseClaimNote({ reply: PEANUT_REPLY, wrote: [] });
  assert.ok(note, 'the guard must speak when a write was claimed and none happened');
  assert.ok(/nothing was saved/i.test(note), `the note must say nothing was saved, got: ${note}`);
});

check('NEW: and it says what it cannot do, when the caller knows', () => {
  const note = falseClaimNote({
    reply: PEANUT_REPLY,
    wrote: [],
    cannot: 'add an item to a meal that is already logged',
  });
  assert.ok(/can't add an item to a meal that is already logged/i.test(note), note);
});

check('the claiming sentence can be quoted back', () => {
  assert.equal(claimsAWrite(PEANUT_REPLY), PEANUT_REPLY);
});

// ------------------------------------------------- the other half of that night

check('the waist reply is NOT corrected, because the waist really saved', () => {
  const note = falseClaimNote({
    reply: 'Got it - 70cm for the waist, noted.',
    wrote: ['waist'],
  });
  assert.equal(note, null, 'a true confirmation must be left alone');
});

// ------------------------------------------------------------ false positives

const MUST_NOT_FIRE = [
  // The coffee loop of 27 September. Both sentences are about an EARLIER log.
  ["that's logged fine, no need to repeat it", ['nothing this turn']],
  ['That is already in your log from this morning.', []],
  ['Those two coffees are already logged.', []],
  // Ordinary conversation that happens to contain a trigger word.
  ['Worth noting that protein tends to land lower on rest days.', []],
  ['I have added nothing yet - did you want that in your log?', []],
  // A question, not a claim.
  ['Shall I add that to your dinner?', []],
  // Talking about what SHE did.
  ['You logged that one yourself on Monday.', []],
];

for (const [reply, wrote] of MUST_NOT_FIRE) {
  check(`no false positive: "${reply.slice(0, 44)}..."`, () => {
    const note = falseClaimNote({ reply, wrote });
    assert.equal(note, null, `this sentence must not be corrected, got: ${note}`);
  });
}

// ----------------------------------------------------------- true positives

const MUST_FIRE = [
  'Two spoons of peanut butter added to the yoghurt bowl, noted.',
  "I've saved that to your log.",
  'Got that down.',
  "I've updated your dinner.",
  'Popped that in for you.',
  "I've logged the walk.",
  'Logged it.',
];

for (const reply of MUST_FIRE) {
  check(`caught: "${reply.slice(0, 44)}"`, () => {
    assert.ok(falseClaimNote({ reply, wrote: [] }), `expected a correction for: ${reply}`);
  });
}

// ------------------------------------------------------------------ silence

check('a successful write is never annotated', () => {
  for (const reply of MUST_FIRE) {
    assert.equal(falseClaimNote({ reply, wrote: ['dinner'] }), null, reply);
  }
});

check('a reply that claims nothing is never annotated', () => {
  assert.equal(
    falseClaimNote({ reply: 'Your protein is sitting around 70g most days this week.', wrote: [] }),
    null
  );
});

check('one true clause does not excuse a false one in the same reply', () => {
  // The dangerous shape: a sentence about an existing log, then a false claim.
  const reply = 'That dinner is already in your log. I have added the peanut butter to it.';
  assert.ok(falseClaimNote({ reply, wrote: [] }));
});

// ---------------------------------------------------------- MACHINE OUTPUT
//
// Her real replies of 30 September 2026, verbatim from chat_messages. Both
// opened with a proposedSave object because the writer had been handed a block
// telling it to emit one.


const LEAKED_SKINCARE =
  '{"proposedSave": {"type": "me", "title": "Skincare Routine", "content": "Morning\n- Niacinamide (Vitamin B3) — barrier support, redness, pore appearance\n\nEvening (alternating)\n- Vitamin C (Ascorbyl Glucoside) — brightening, pigmentation"}}\n\nThat\'s saved to your Me tab.';

const LEAKED_MAGNESIUM =
  '{"proposedSave": {"type": "me", "title": "Supplements", "content": "Evening\n- Magnesium glycinate — for sleep"}}\n\nThat\'s saved to your Me tab.';

check('the skincare leak is stripped, her sentence survives', () => {
  const out = stripMachineOutput(LEAKED_SKINCARE);
  assert.ok(!out.includes('proposedSave'), `JSON survived: ${out.slice(0, 80)}`);
  assert.ok(!out.includes('{'), 'no braces may reach her');
  assert.equal(out, "That's saved to your Me tab.");
});

check('the magnesium leak is stripped', () => {
  const out = stripMachineOutput(LEAKED_MAGNESIUM);
  assert.ok(!out.includes('proposedSave'));
  assert.equal(out, "That's saved to your Me tab.");
});

check('it fails against today\'s behaviour, which stripped nothing', () => {
  // The old behaviour was the identity function.
  assert.ok(LEAKED_SKINCARE.includes('proposedSave'), 'fixture must contain the leak');
});

check('an ordinary reply with braces in her own words is untouched', () => {
  const ordinary = 'You wrote {this} in your note, which I have left exactly as it is.';
  assert.equal(stripMachineOutput(ordinary), ordinary);
});

check('a fenced code block naming our fields goes', () => {
  const fenced = 'Here you go:\n```json\n{"meUpdate": {"title": "x"}}\n```\nAll set.';
  const out = stripMachineOutput(fenced);
  assert.ok(!out.includes('meUpdate'));
  assert.ok(out.includes('All set.'));
});

check('THE SKINCARE TURN: a claim with nothing written is caught', () => {
  // 11:32:17 - the reply said "That's saved" and no row was created.
  const stripped = stripMachineOutput(LEAKED_SKINCARE);
  assert.ok(falseClaimNote({ reply: stripped, wrote: [] }), 'this is the turn the guard exists for');
});

check('THE MAGNESIUM TURN: a claim with a real write is left alone', () => {
  // 11:35:17 - Magnesium Glycinate really was created, two seconds before.
  const stripped = stripMachineOutput(LEAKED_MAGNESIUM);
  assert.equal(falseClaimNote({ reply: stripped, wrote: ['me card'] }), null);
});

for (const f of failures) console.error('  FAIL  ' + f);
console.log(`\n  ${pass} passed, ${failures.length} failed`);
console.log(
  '  The 20:23 turn: old behaviour said nothing, new behaviour corrects it.\n' +
    '  Most of these checks are sentences that must NOT be touched - a guard that\n' +
    '  corrects a true sentence is worse than no guard.'
);
if (failures.length > 0) process.exit(1);

