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

import {
  claimsAWrite,
  disavowsTheApp,
  falseClaimNote,
  stripDisavowal,
  stripMachineOutput,
  stripSaveClaims,
  unescapeNewlines,
} from '../app/lib/claimed-write.ts';
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
  // Wording changed on 30 September: it used to say "nothing was saved to your
  // log", and a Me card is not a log. The assertion is about the meaning.
  assert.ok(/did not save/i.test(note), `the note must say it did not save, got: ${note}`);
  assert.ok(!/your log/i.test(note), 'it must not call her record a log');
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


// ------------------------------------------------- THE 1:12 CONVERSATION
//
// Replayed from chat_messages, verbatim. Ruth pasted her routine, the app
// proposed it, she said a plain "Yes", and nothing was written - and the
// correction arrived twice, once stapled to the PROPOSAL.

const PROPOSAL_1_12 = [
  '**Skincare Routine**',
  '',
  'Morning',
  '- Niacinamide (Vitamin B3) — strengthens barrier, reduces redness/inflammation, minimises pores, regulates oil. Calming and protective for morning. Also targeted at the rosacea-type redness on your cheeks.',
  '',
  'Evening (alternating)',
  '- Vitamin C (Ascorbyl Glucoside) — antioxidant, brightens, boosts collagen, fades hyperpigmentation and uneven freckle tone. Needs time to work, so used at night.',
  '',
  'Alternating vitamin C and retinol at night to give skin a break between actives. Together addressing fine lines around the eyes, under-eye laxity, enlarged pores, and the freckle merging noted back in June.',
  '',
  'Shall I save it this way?',
].join('\n');

check('THE PROPOSAL IS NOT A CLAIM - no correction is stapled to it', () => {
  const note = falseClaimNote({ reply: PROPOSAL_1_12, wrote: [] });
  assert.equal(note, null, `a question asking to save must never be corrected, got: ${note}`);
});

check('"noted back in June" is a date, not a confirmation', () => {
  assert.equal(claimsAWrite('the freckle merging noted back in June'), null);
});

check('", noted." at the end of a sentence still is a confirmation', () => {
  assert.ok(claimsAWrite('Two spoons of peanut butter added to the yoghurt bowl, noted.'));
});

check('the proposal survives the strip untouched', () => {
  assert.equal(stripSaveClaims(PROPOSAL_1_12), PROPOSAL_1_12);
});

check('THE YES TURN: the model claim is removed rather than argued with', () => {
  const claimed = "That's saved to your Me tab.";
  assert.equal(stripSaveClaims(claimed), '', 'the claim sentence must go');
});

check('a real reply keeps everything except the claim', () => {
  const mixed = "Retinol at night makes sense with the vitamin C. That's saved to your Me tab.";
  const out = stripSaveClaims(mixed);
  assert.ok(out.includes('Retinol at night makes sense'));
  assert.ok(!/saved/i.test(out));
});

check('the failure wording does not call her Me card a log', () => {
  const note = falseClaimNote({ reply: "I've saved that.", wrote: [] });
  assert.ok(note && !/your log/i.test(note), `got: ${note}`);
});


// ------------------------------------- THE 2:14 REPLY, AND THE SHAPE OF A LIST
//
// Her real reply, verbatim: the escapes arrived as text because the model was
// copying a leaked proposedSave content string still sitting in her history.
const ESCAPED =
  "Here is the update to your Skincare Routine card:\n\nMorning\n- Niacinamide - strengthens barrier.\n\nEvening (alternating)\n- Retinol - increases cell turnover.\n\nShall I save this version?";

check('the escaped newlines become real ones', () => {
  const out = unescapeNewlines(ESCAPED);
  assert.ok(!out.includes(String.fromCharCode(92) + 'n'), 'no backslash-n may reach her');
  assert.ok(out.split(String.fromCharCode(10)).length > 4, 'it must break into lines');
  assert.ok(out.includes('Morning') && out.includes('Evening (alternating)'));
});

const LF = String.fromCharCode(10);

check('a reply with real newlines is untouched', () => {
  const fine = ['Morning', '- Niacinamide', '', 'Evening', '- Retinol'].join(LF);
  assert.equal(unescapeNewlines(fine), fine);
});

// THE FLATTENING I INTRODUCED. stripSaveClaims split the whole reply into
// sentences and rejoined with a space, turning a grouped list into a paragraph,
// and it ran on every reply rather than only the ones claiming a save.
const GROUPED = [
  'Here is the update to your Skincare Routine card:',
  '',
  'Morning',
  '- Niacinamide (Vitamin B3) - barrier support, redness, pores',
  '',
  'Evening (alternating)',
  '- Vitamin C (Ascorbyl Glucoside) - brightening, pigmentation',
  '- Retinol (Vitamin A) - fine lines, texture',
  '',
  'Shall I save this version?',
].join(LF);

check('a grouped list keeps its shape', () => {
  assert.equal(stripSaveClaims(GROUPED), GROUPED, 'a proposal must not be flattened');
});

check('a reply that claims nothing is returned unchanged', () => {
  const plain = ['Retinol at night makes sense with the vitamin C.', '', 'Anything else?'].join(LF);
  assert.equal(stripSaveClaims(plain), plain);
});

check('a claim is removed WITHOUT flattening the lines around it', () => {
  const mixed = ['Morning', '- Niacinamide', '', 'That is saved to your Me tab.'].join(LF);
  const out = stripSaveClaims(mixed);
  assert.ok(out.includes('Morning'), 'the list survives');
  assert.ok(out.includes('- Niacinamide'), 'the list survives');
  assert.ok(!/saved/i.test(out), 'the claim goes');
  assert.ok(out.split(LF).length >= 2, 'the shape survives');
});

// ─── THE APP NEVER DISOWNS THE APP ──────────────────────────────────────────
//
// Her phone, 30 September, 2:27pm, the real reply in its real wording.

const DISOWNED =
  "That's on me for saying it would show up - I don't control that, only the app does. " +
  "If it's not appearing on your Me tab, worth trying the add once more or giving the app a moment; " +
  "I'm not able to check what's actually stored there.";

check('her 2:27 reply is caught', () => {
  const found = disavowsTheApp(DISOWNED);
  assert.ok(found, 'the sentence she objected to must be recognised');
});

check('every disowning sentence in it is removed', () => {
  const out = stripDisavowal(DISOWNED);
  assert.ok(!/only the app/i.test(out), '"only the app does" must go');
  assert.ok(!/don't control/i.test(out), '"I don\'t control that" must go');
  assert.ok(!/not able to check/i.test(out), '"I\'m not able to check" must go');
  assert.ok(!/giving the app a moment/i.test(out), 'the wait-and-retry answer must go');
});

check('a reply that was ONLY a disavowal still says something true', () => {
  const out = stripDisavowal(DISOWNED);
  assert.ok(out.trim().length > 0, 'she must not get an empty message');
  assert.ok(/record/i.test(out), 'what replaces it must point at the record it does have');
  assert.ok(!/\bapp\b/i.test(out), 'and must not name the app as somebody else');
});

// THE FALSE POSITIVES, which are the hard half. Every sentence below is an
// honest limit or an ordinary answer and must survive untouched.
const MUST_SURVIVE = [
  'I am not a clinician, so that one is worth taking to your GP.',
  'That did not save, so it is not in your record.',
  "I can't add an item to a meal that is already logged yet.",
  'I can see your Skincare Routine card, and retinol is on it.',
  "There's no waist reading in your record for this week.",
  "I can't see a change in your protein since Monday.",
  'The app store review is nothing to do with me.',
];

for (const sentence of MUST_SURVIVE) {
  check(`untouched: "${sentence.slice(0, 40)}..."`, () => {
    assert.equal(disavowsTheApp(sentence), null, 'this is an honest sentence, not a disavowal');
    assert.equal(stripDisavowal(sentence), sentence);
  });
}

check('a list around a disavowal keeps its shape', () => {
  const mixed = ['Morning', '- Niacinamide', '', "I'm not able to check what's stored there."].join(LF);
  const out = stripDisavowal(mixed);
  assert.ok(out.includes('Morning') && out.includes('- Niacinamide'), 'the list survives');
  assert.ok(!/not able to check/i.test(out), 'the disavowal goes');
});

// CAN THIS SET FAIL? Run the same assertions against a guard that does nothing.
// If they pass, they were testing the sentence rather than the behaviour.
const identity = (s) => s;
let disavowalCaught = false;
try {
  const out = identity(DISOWNED);
  assert.ok(!/only the app/i.test(out));
  assert.ok(!/not able to check/i.test(out));
} catch {
  disavowalCaught = true;
}
if (!disavowalCaught) {
  failures.push('USELESS: a do-nothing guard passed the disavowal checks');
}

for (const f of failures) console.error('  FAIL  ' + f);
console.log(`\n  ${pass} passed, ${failures.length} failed`);
console.log(`  Proof: a do-nothing disavowal guard is caught = ${disavowalCaught}`);
console.log(
  '  The 20:23 turn: old behaviour said nothing, new behaviour corrects it.\n' +
    '  Most of these checks are sentences that must NOT be touched - a guard that\n' +
    '  corrects a true sentence is worse than no guard.'
);
if (failures.length > 0) process.exit(1);

