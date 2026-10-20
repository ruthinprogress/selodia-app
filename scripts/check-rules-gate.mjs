// DOES A RULE ACTUALLY STOP A MOVEMENT REACHING A PLAN?
//
// SELODIA_SPEC.md says My Rules must be enforced in code before a plan is
// shown, not only asked for in the prompt, because a contraindicated movement
// is an injury risk. This is the file that decides whether that sentence is
// true.
//
// EVERY CHECK RUNS AGAINST TWO BROKEN GATES AS WELL AS THE REAL ONE, and has to
// fail against at least one of them or it is not testing anything.
//
// TWO, BECAUSE THIS GATE CAN BE WRONG IN TWO DIRECTIONS and a single stand-in
// only catches one. The first version of this file used only the prompt-only
// gate, which removes nothing, and three checks came back WEAK - correctly. They
// were the checks about NOT over-removing, and a gate that removes nothing
// passes those trivially. The allergy gate's whole failure was over-removal, so
// leaving that side untested would have been testing the easy half.
//
//   promptOnly  - removes nothing. This is what "we asked the model nicely"
//                 amounts to on a turn where the model does it anyway.
//   overEager   - removes anything that shares a substring with any rule term,
//                 including the always-OK ones. This is the nickel failure,
//                 ported to movement.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-rules-gate.mjs

import { applyRules, flagNote, normaliseKind, rulesPrompt } from '../app/lib/rules-gate.ts';

const promptOnly = (exercises) => ({ kept: exercises, removed: [] });

const overEager = (exercises, rules) => {
  const terms = rules.flatMap((r) => r.matchTerms.map((t) => t.toLowerCase()));
  const kept = [];
  const removed = [];
  for (const e of exercises) {
    const hay = `${e.name ?? ''} ${e.group ?? ''}`.toLowerCase();
    if (terms.some((t) => hay.includes(t))) removed.push({ exercise: String(e.name), rule: 'something' });
    else kept.push(e);
  }
  return { kept, removed };
};

const RULES = [
  {
    id: '1',
    kind: 'never',
    phrase: 'Heavy deadlifts or loaded squats',
    matchTerms: ['deadlift', 'loaded squat', 'back squat', 'front squat'],
    confirmedAt: '2026-09-28T00:00:00Z',
  },
  {
    id: '2',
    kind: 'never',
    phrase: 'Quad-dominant work',
    matchTerms: ['leg extension', 'quad'],
    // NOT CONFIRMED, and it must still bite. The cautious side of the
    // ambiguity: a rule heard and not yet confirmed is not a rule to ignore
    // while somebody trains.
    confirmedAt: null,
  },
  {
    id: '3',
    kind: 'always',
    phrase: 'Glute max and hamstring focus',
    matchTerms: ['glute', 'hamstring'],
    confirmedAt: '2026-09-28T00:00:00Z',
  },
];

const CHECKS = [
  [
    'a movement under a rule is FLAGGED, and both stay in the plan',
    (gate) => {
      const { kept, flagged } = gate(
        [{ name: 'Barbell deadlift', group: 'posterior chain' }, { name: 'Pull-up', group: 'back' }],
        RULES
      );
      return (
        kept.length === 2 &&
        flagged.length === 1 &&
        flagged[0].exercise === 'Barbell deadlift'
      );
    },
  ],
  [
    'an UNCONFIRMED rule still flags',
    (gate) => {
      // A rule heard and not yet confirmed is still worth saying out loud. It
      // no longer costs her the movement, so the cautious reading is cheap.
      const { flagged } = gate([{ name: 'Leg extension', group: 'legs' }], RULES);
      return flagged.length === 1;
    },
  ],
  [
    'the GROUP is checked, not only the name',
    (gate) => {
      // "Step-up" breaks no name rule. Its group does.
      const { flagged } = gate([{ name: 'Step-up', group: 'quads' }], RULES);
      return flagged.length === 1;
    },
  ],
  [
    'an always-OK rule flags nothing',
    (gate) => {
      const { kept, flagged } = gate([{ name: 'Hamstring curl', group: 'hamstrings' }], RULES);
      return kept.length === 1 && flagged.length === 0;
    },
  ],
  [
    'NOTHING IS TAKEN OUT OF THE PLAN',
    (gate) => {
      // Ruth, 20 October 2026: "An app that decided what a user can and cannot
      // do is not helpful, it's inflexible." Three movements vanished out of a
      // ballet plan into a rule she had set months earlier, and neither chat
      // nor the Rules screen could remove the rule.
      const { kept } = gate(
        [
          { name: 'Barbell deadlift', group: 'posterior chain' },
          { name: 'Glute bridge', group: 'glutes' },
          { name: 'Pull-up', group: 'back' },
        ],
        RULES
      );
      // All three. The plan she asked for is the plan she gets.
      return kept.length === 3;
    },
  ],
  [
    'what falls under a rule is named, with the rule, and she is asked',
    (gate) => {
      const { flagged } = gate([{ name: 'Barbell deadlift', group: 'posterior chain' }], RULES);
      if (flagged.length !== 1) return false;
      const note = flagNote(flagged);
      return (
        typeof note === 'string' &&
        note.includes('Barbell deadlift') &&
        note.includes('Heavy deadlifts or loaded squats') &&
        // IT ENDS BY ASKING. A warning with no way to answer it is the removal
        // again in softer words, which is the thing she objected to.
        /say if you would rather/i.test(note) &&
        // And it must not claim the movement is absent, which is what the old
        // sentence said.
        !/not in this/i.test(note)
      );
    },
  ],
  [
    'a term does not fire inside a longer word',
    (gate) => {
      // The real trap: a rule term that is a substring of an unrelated word.
      // 'row' inside 'Narrow'. Substring matching removes a calf raise because
      // of a rule about rowing, which is the movement version of the nickel
      // failure.
      const narrow = [
        { id: 'x', kind: 'never', phrase: 'No rows', matchTerms: ['row'], confirmedAt: null },
      ];
      // Matching is unchanged - it was never the matching that was wrong - so
      // this still checks that 'row' does not fire inside 'Narrow'. It reads
      // `flagged` now, because nothing is removed to count.
      const { flagged } = gate([{ name: 'Narrow-stance calf raise', group: 'calves' }], narrow);
      return flagged.length === 0;
    },
  ],
  [
    'a plural in the plan is caught by a singular rule term',
    (gate) => {
      const { kept, flagged } = gate([{ name: 'Romanian deadlifts', group: 'posterior chain' }], RULES);
      // Caught by the rule AND still in the plan: both halves matter now.
      return flagged.length === 1 && kept.length === 1;
    },
  ],
];

// SANITY CHECKS, kept separate and honestly labelled. Neither broken gate can
// fail these, because with no rules there is nothing for any gate to do. They
// still earn a place - a crash on the empty case would be a real bug - but
// counting them as enforcement would be exactly the self-flattery this file
// exists to prevent.
const SANITY = [
  [
    'no rules means nothing is touched',
    () => {
      const plan = [{ name: 'Barbell deadlift', group: 'posterior chain' }];
      const { kept, flagged } = applyRules(plan, []);
      return kept.length === 1 && flagged.length === 0;
    },
  ],
  ['nothing flagged means no note', () => flagNote([]) === null],

  // A TECHNIQUE CUE MUST NEVER REMOVE ANYTHING (1 October 2026).
  //
  // Ruth found "Heavy Valsalva or bearing down" under "Staying out of your
  // sessions". She means breathe through it, not never do it - guidance on HOW
  // to do a move, which rules nothing out. It was stored as kind 'never' because
  // until that evening those were the only two kinds a rule could have, so the
  // shape of the table decided the meaning of her instruction.
  //
  // THE LINE THAT MADE IT DANGEROUS was in the gate itself:
  //
  //   kind: r.kind === 'always' ? 'always' : 'never'
  //
  // Anything not 'always' became an exclusion, so adding a third kind to the
  // database would have changed nothing at all - a technique note would have
  // gone on silently stripping movements out of her sessions while the column
  // said otherwise. These two checks exist because that coercion looked
  // harmless and was the whole bug.
  [
    'a technique rule flags nothing, even when its words match an exercise',
    () => {
      const plan = [
        { name: 'Barbell deadlift', group: 'posterior chain' },
        { name: 'Valsalva breathing drill', group: 'core' },
      ];
      const { kept, flagged } = applyRules(plan, [
        { kind: 'technique', phrase: 'Heavy Valsalva or bearing down', matchTerms: ['valsalva', 'deadlift'] },
      ]);
      // Not even a warning. A technique cue is guidance on HOW, so there is
      // nothing for her to be asked about - which is still the whole point of
      // the kind existing. See the note above.
      return kept.length === 2 && flagged.length === 0;
    },
  ],
  [
    'the kinds are read as themselves, and an unknown one fails CLOSED',
    () => {
      // Tested here rather than through applyRules, because the coercion lives
      // at LOAD - which is why the bug was unreachable from a test for so long.
      // Failing closed is right for a safety filter; the point is that the fall
      // is deliberate rather than an accident of an else-branch.
      return (
        normaliseKind('never') === 'never' &&
        normaliseKind('always') === 'always' &&
        normaliseKind('technique') === 'technique' &&
        normaliseKind('something-new') === 'never' &&
        normaliseKind(null) === 'never'
      );
    },
  ],
];

// The prompt block is layer 1 and is checked separately: it is not enforcement,
// so running it against the broken gate proves nothing.
const PROMPT_CHECKS = [
  [
    'a technique cue is told to the model as guidance, never as an exclusion',
    () => {
      const out = rulesPrompt([
        { kind: 'technique', phrase: 'Heavy Valsalva or bearing down', matchTerms: ['valsalva'] },
      ]);
      // It must say the cue, and must NOT appear under the never wording - the
      // model reading "movements this person never does: Valsalva" is the same
      // wrong answer arriving by a different route.
      return (
        /Valsalva/.test(out) &&
        /rules nothing out|not exclusions/i.test(out) &&
        !/never does/i.test(out)
      );
    },
  ],
  [
    'THE PROMPT ASKS RATHER THAN FORBIDS, AND NEVER SAYS HIDE IT',
    () => {
      // Changed 20 October 2026 with the gate below it. Layer 1 used to say the
      // never list "must never appear in anything you suggest or build", which
      // made the model refuse before the gate was ever reached - so a plan came
      // back short twice over, once from the model and once from the code.
      const text = rulesPrompt(RULES);
      return (
        text.includes('Heavy deadlifts') &&
        // It must TELL her when it includes one. Silence is the old behaviour
        // with the enforcement moved into the model, which is worse because
        // nothing downstream can see it happen.
        /say so in one sentence/i.test(text) &&
        /ask whether they still want it/i.test(text) &&
        /do not quietly leave it out/i.test(text) &&
        // And it must not have kept the sentence that forbade it outright.
        !/must never appear/i.test(text)
      );
    },
  ],
  [
    'the prompt tells the model NOT to refuse the whole plan',
    // Written as a presence rather than an absence after the first version
    // matched its own instruction - "do not refuse to build the plan" contains
    // the word refuse. See DECISION_PATTERNS, 18 October: assert the property.
    () => /do not .{0,40}refuse to build the plan/i.test(rulesPrompt(RULES)),
  ],
  ['no rules means no prompt block at all', () => rulesPrompt([]) === ''],
];

let failed = 0;
let useless = 0;

const attempt = (run, gate) => {
  try {
    return run(gate) === true;
  } catch {
    return false;
  }
};

for (const [name, run] of CHECKS) {
  let real = false;
  try {
    real = run(applyRules) === true;
  } catch (err) {
    console.log(`  threw: ${err.message}`);
  }

  // Meaningful means: at least one of the two broken gates gets this wrong.
  const survives = [
    ['prompt-only', attempt(run, promptOnly)],
    ['over-eager', attempt(run, overEager)],
  ];
  const caught = survives.filter(([, passed]) => !passed).map(([label]) => label);

  if (!real) failed += 1;
  else if (caught.length === 0) useless += 1;

  const mark = real ? (caught.length ? 'ok  ' : 'WEAK') : 'FAIL';
  const catches = caught.length ? `   (catches ${caught.join(' + ')})` : '';
  console.log(`  ${mark}  ${name}${catches}`);
}

console.log();
for (const [name, run] of [...PROMPT_CHECKS, ...SANITY]) {
  const ok = run() === true;
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
}

console.log();
if (failed) console.log(`  ${failed} FAILED.`);
if (useless) console.log(`  ${useless} WEAK: both broken gates pass these, so they test nothing.`);
if (!failed && !useless) {
  console.log(
    `  ${CHECKS.length} enforcement checks, each caught by a broken gate. ` +
      `${PROMPT_CHECKS.length + SANITY.length} prompt and sanity checks.`
  );
}
process.exitCode = failed || useless ? 1 : 0;

// ---------------------------------------------------------------------------
// AND A RULE CAN BE TAKEN OFF THE LIST (Ruth, 20 October 2026).
//
//   "There is no way to remove anything from the Rules page. That needs
//    changing. An app that decided what a user can and cannot do is not
//    helpful, it's inflexible."
//
// The gate above no longer removes movements, which is half the answer. The
// other half is that a rule which has outlived the body it was written about
// has to be removable - hers was set months before the ballet plan it was
// quietly editing, and neither chat nor the Rules screen could take it off.
//
// Source checks rather than behaviour: the delete is one line of Supabase, and
// the risk is not that it computes wrongly but that a later edit removes the
// door again, or loses the second tap on a screen about constraints on a body.

import fs from 'node:fs';

const rulesView = fs.readFileSync('mobile/src/components/rules-view.tsx', 'utf8');

const UI = [
  [
    'THE RULES SCREEN CAN REMOVE A RULE',
    () => /from\('user_rules'\)\s*\.delete\(\)/.test(rulesView) && /onRemoved/.test(rulesView),
  ],
  [
    'and it asks twice before it does',
    () =>
      /Tap again to remove it/.test(rulesView) &&
      /confirm \? void remove\(\) : setConfirm\(true\)/.test(rulesView),
  ],
  [
    'a failed removal is said out loud, never swallowed',
    // A delete that silently fails leaves the rule still shaping her plans
    // while she believes it is gone - the same fault as the gate removing
    // movements she could not see.
    () => /That did not remove/.test(rulesView),
  ],
  [
    'and the screen no longer claims rules are applied by removal',
    () =>
      !/applied to everything Selodía builds for you/.test(rulesView) &&
      /rather than leaving it out/.test(rulesView),
  ],
];

let uiFailed = 0;
console.log('');
for (const [name, run] of UI) {
  let ok = false;
  try {
    ok = run() === true;
  } catch {
    ok = false;
  }
  if (!ok) uiFailed += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
}
console.log('');
if (uiFailed > 0) process.exit(1);
