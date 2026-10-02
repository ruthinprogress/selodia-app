// SEVEN QUESTIONS, AND NOTHING ABOUT HER DAYS IS SCORED.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-feel-and-flow.mjs
//
// Items 6 and 7, 2 October 2026, built from her approved preview canvas.
//
// WHAT THESE GUARD. Two things that would be easy to undo by accident and hard to
// notice:
//
//   THE FLOW. Seven questions, in her order, each reachable from the one before,
//   with the counter numerator and denominator agreeing. The last time this chain
//   was reshuffled, the whole second half of setup lost its Continue button and
//   Ruth was locked in twice over.
//
//   THE ABSENCE OF A SCORE. "No scores, streaks, counters or percentages." That
//   is a rule about what must NOT exist, and a rule like that is normally only
//   enforced by somebody remembering it. The look-back answers are words, nothing
//   maps them to numbers, and nothing counts how many times she has answered.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const cwd = process.cwd().replace(/\\/g, '/');
const PROGRESS = await import(`file://${cwd}/mobile/src/lib/onboarding-progress.ts`);
const FEEL = await import(`file://${cwd}/mobile/src/lib/feel-goals.ts`);
const STEP = await import(`file://${cwd}/mobile/src/lib/onboarding-step.ts`);
const PROMPT = await import(`file://${cwd}/app/lib/reply-prompt.ts`);
const FACTS = await import(`file://${cwd}/app/lib/feel-facts.ts`);

const read = (p) => readFileSync(p, 'utf8');

let pass = 0;
const failures = [];
async function check(name, fn) {
  try {
    const note = await fn();
    console.log(`  PASS  ${name}${note ? `   ${note}` : ''}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL  ${name}\n          ${e.message}`);
    failures.push(name);
  }
}

console.log('\n  SEVEN QUESTIONS, AND NOTHING SCORED\n');

// ------------------------------------------------------------------ the flow

/** Her order, from the canvas: 1 How days feel ... 7 First draft. */
const HER_ORDER = [
  'days',
  'goals',
  'skill',
  'activities',
  'allergies',
  'life-stage',
  'first-draft',
];

await check('seven questions, in her order', () => {
  const counted = PROGRESS.COUNTED_SCREENS.map((s) => s.route);
  assert.deepStrictEqual(counted, HER_ORDER, `got ${counted.join(' -> ')}`);
  assert.strictEqual(PROGRESS.ONBOARDING_TOTAL, 7);
  return counted.join(' > ');
});

await check('the counter reads "N of 7" and never "of 9"', () => {
  for (let i = 0; i < HER_ORDER.length; i += 1) {
    const g = PROGRESS.progressForPath(`/onboarding/${HER_ORDER[i]}`);
    assert.ok(g, `${HER_ORDER[i]} has no position`);
    assert.strictEqual(g.index, i + 1, `${HER_ORDER[i]} is ${g.index}, not ${i + 1}`);
    assert.strictEqual(g.total, 7, `${HER_ORDER[i]} says of ${g.total}`);
  }
  return '1 of 7 through 7 of 7';
});

await check('consent and account are not among the seven', () => {
  // They are not questions about her, they are not skippable, and counting them
  // made her first question look like the third.
  for (const route of ['consent', 'account']) {
    const g = PROGRESS.progressForPath(`/onboarding/${route}`);
    assert.ok(g, `${route} dropped out of the flow entirely`);
    assert.strictEqual(g.index, null, `${route} is numbered ${g.index}`);
  }
  return 'titled, not numbered';
});

await check('the four screens she asked to remove are out of the chain', () => {
  const counted = PROGRESS.COUNTED_SCREENS.map((s) => s.route);
  for (const gone of ['intro', 'equipment', 'first-log', 'steer-around']) {
    assert.ok(!counted.includes(gone), `${gone} is still one of the seven`);
  }
  return 'intro, equipment, first-log, steer-around';
});

await check('but the guard still leaves every one of them alone', () => {
  // THE EXACT BUG THIS SET WAS BUILT FOR. A screen off the chain is still
  // reachable - by URL, by RESUME_ROUTE from an older build, by the draft's
  // Manual link - and one the guard does not recognise throws a finished account
  // back to the app and drags an unfinished one into the flow.
  for (const route of [
    'intro',
    'equipment',
    'first-log',
    'steer-around',
    'medication',
    'guidance',
    'health-context',
    'technical',
    'nutrition',
    'activity',
  ]) {
    assert.ok(PROGRESS.FLOW_SCREENS.has(route), `the guard would police ${route}`);
  }
  return `${PROGRESS.FLOW_SCREENS.size} screens exempt`;
});

await check('the flow opens on question 1', () => {
  const src = read('mobile/src/lib/onboarding-step.ts');
  assert.ok(
    /const FIRST: Href = '\/onboarding\/days'/.test(src),
    'the flow does not open on how her days feel'
  );
  // AND "REDO MY SETUP" IS GONE (2 October 2026). This used to assert that the
  // redo started at question 1 - the fourth attempt to make replaying a wizard
  // safe. Ruth's answer was to stop replaying it: every answer lives on the Body
  // Manual, editable where it is, and nothing sends a finished account back
  // through onboarding. So the property worth asserting is the absence.
  const profile = read('mobile/src/app/settings/profile.tsx');
  assert.ok(
    !/label="Redo my setup"/.test(profile),
    'the redo is back. Every fault of 1 and 2 October came from replaying a wizard ' +
      'over answers that already existed; the Body Manual is what replaced it'
  );
  assert.ok(/<BodyManual \/>/.test(profile), 'the Body Manual is not on the profile');
  return 'and the redo is gone, replaced by the Body Manual';
});

await check('every step resolves to a route', () => {
  for (const step of STEP.ONBOARDING_STEPS) {
    const route = STEP.resumeRoute(step);
    assert.ok(route, `step "${step}" resolves to nothing`);
  }
  return `${STEP.ONBOARDING_STEPS.length} steps, all resolvable`;
});

// --------------------------------------------------------- no progress bar

await check('there is no progress bar', () => {
  const header = read('mobile/src/components/onboarding-header.tsx');
  assert.ok(!/<Segments/.test(header), 'the segmented bar is still rendered');
  assert.ok(!/function Segments/.test(header), 'the segmented bar component is still here');
  assert.ok(!/styles.segment\b/.test(header), 'the segment styles are still applied');
  // The COUNTER LINE stays: her own approved preview carries "1 of 7".
  assert.ok(
    /\{progress\.index\} of \{progress\.total\}/.test(header),
    'the "1 of 7" line went with the bar, and her preview has it'
  );
  return 'no bar, and her counter line kept';
});

// --------------------------------------------------- her wording, verbatim

await check("her six feel chips, in her order", () => {
  assert.deepStrictEqual(
    [...FEEL.FEEL_CHIPS],
    ['More energy', 'Less overwhelm', 'Less brain fog', 'Feel stronger', 'Sleep better', 'Calmer']
  );
  return FEEL.FEEL_CHIPS.join(', ');
});

await check('her four look-back answers, in her order and her words', () => {
  assert.deepStrictEqual(
    FEEL.LOOKBACK_ANSWERS.map((a) => a.key),
    ['further', 'same', 'a_bit_closer', 'closer']
  );
  assert.deepStrictEqual(
    FEEL.LOOKBACK_ANSWERS.map((a) => a.label),
    ['Further from how I wanted', 'About the same', 'A bit closer', 'Closer']
  );
  return 'four answers, no fifth';
});

await check('the screen says it cannot promise to fix any of it', () => {
  assert.ok(
    /cannot promise to fix/.test(FEEL.FEEL_HONEST_NOTE),
    'the honest line has gone from the feel screen'
  );
  const screen = read('mobile/src/app/onboarding/days.tsx');
  assert.ok(/FEEL_HONEST_NOTE/.test(screen), 'the screen no longer renders it');
  return 'said on the screen that collects them';
});

// ------------------------------------------------------- NOTHING IS SCORED

await check('HER RULE: no scores, streaks, counters or percentages', () => {
  // Read across every file that touches feel goals. The forbidden thing is a
  // NUMBER derived from how she feels: a count of look-backs, a score, a
  // percentage, a streak, or a mapping from an answer to a value.
  const files = [
    'mobile/src/lib/feel-goals.ts',
    'mobile/src/app/onboarding/days.tsx',
    'mobile/src/app/look-back.tsx',
    'mobile/src/components/goals-block.tsx',
    'app/lib/feel-facts.ts',
  ];
  // THE BAN IS ON CODE, NOT ON COPY, and the first version of this check got that
  // wrong: it failed on her own approved sentence "nothing here is a score",
  // which is the line that DENIES a score. Comments and string literals are
  // stripped, so what is tested is identifiers and expressions - a `score`
  // variable, a `streak` counter, a percentage calculation. Saying there is no
  // score is the point; computing one is the thing forbidden.
  for (const file of files) {
    const code = read(file)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
    for (const banned of [/streak/i, /percent/i, /\bscore\b/i, /\btrend\b/i]) {
      assert.ok(!banned.test(code), `${file} has ${banned} in its CODE, not just its copy`);
    }
  }
  // AND NOTHING COUNTS HER LOOK-BACKS. A total is the shape a streak arrives in.
  for (const file of files) {
    const code = read(file).replace(/^\s*\/\/.*$/gm, '');
    assert.ok(
      !/feel_lookbacks'\)[\s\S]{0,200}count:/.test(code),
      `${file} counts her look-backs`
    );
  }
  // And no answer carries a numeric weight.
  for (const a of FEEL.LOOKBACK_ANSWERS) {
    assert.deepStrictEqual(Object.keys(a).sort(), ['key', 'label'], `${a.key} carries extra fields`);
  }
  return `${files.length} files, no number derived from how she feels`;
});

await check('the model is told never to promise to fix any of it', () => {
  const prompt = PROMPT.replyPrompt();
  assert.ok(/NEVER PROMISE TO FIX ANY OF IT/.test(prompt), 'the rule is not in the live prompt');
  assert.ok(
    /guiding source for your tone/i.test(prompt),
    'the prompt does not say what the feel goals are for'
  );
  assert.ok(
    /NOT SOMETHING TO READ BACK/.test(prompt),
    'nothing stops the model listing her answers back at her'
  );
  return 'in the assembled prompt, not just in a constant';
});

await check('and it does not speak of "the app" in the third person', () => {
  // The rule that caused "I don't control that, only the app does".
  const part = PROMPT.REPLY_PROMPT_PARTS.HER_DAYS;
  assert.ok(part, 'HER_DAYS is not in REPLY_PROMPT_PARTS, so check-live-prompt cannot see it');
  assert.ok(!/\bthe app\b/i.test(part), 'HER_DAYS hands the model a second party to point at');
  return 'no second party';
});

// ------------------------------------------------------------- the facts block

await check('an empty record produces no block at all', () => {
  assert.strictEqual(FACTS.feelFacts([], null), '');
  assert.strictEqual(FACTS.feelFacts(null, null), '');
  return 'silence, rather than a line saying she has not answered';
});

await check('her chips, her sentence and her last answer all reach the model', () => {
  const block = FACTS.feelFacts(
    [
      { label: 'More energy', source: 'chip', started_at: '2026-10-02T09:00:00Z' },
      { label: 'Less brain fog', source: 'chip', started_at: '2026-10-02T09:00:00Z' },
      { label: 'Some days I am wiped by three', source: 'her words', started_at: '2026-10-02T09:00:00Z' },
    ],
    { answer: 'a_bit_closer', note: 'the walking helps', created_at: '2026-10-16T09:00:00Z' }
  );
  assert.ok(/More energy, Less brain fog/.test(block), 'the chips are missing');
  assert.ok(/2 October 2026/.test(block), 'when she said it is missing');
  assert.ok(/"Some days I am wiped by three"/.test(block), 'her own sentence is missing');
  assert.ok(/a bit closer/.test(block), 'her last answer is missing');
  assert.ok(/"the walking helps"/.test(block), 'her note is missing');
  assert.ok(/NOT something to read back/i.test(block), 'the block does not say what it is for');
  return 'chips, her words, last answer and note';
});

await check('a look-back with no feel goals says nothing', () => {
  // Order matters: a stray lookback row must not produce a block on its own.
  const block = FACTS.feelFacts([], { answer: 'closer', created_at: '2026-10-16T09:00:00Z' });
  assert.strictEqual(block, '', 'a look-back with nothing behind it produced a block');
  return 'no snapshot, no block';
});

// ----------------------------------------------------------------- the nudge

await check('the nudge is gated on Guide me, and the tap is always there', () => {
  const block = read('mobile/src/components/goals-block.tsx');
  assert.ok(
    /guidance === 'guide_me' && dueForLookback/.test(block),
    'the nudge is not gated on Guide me'
  );
  // The LINK must not be gated: her instruction is that it is always reachable by
  // tap in Plans.
  const linkAt = block.indexOf("router.push('/look-back')");
  assert.ok(linkAt > 0, 'there is no tap to the look-back at all');
  const before = block.slice(Math.max(0, linkAt - 400), linkAt);
  assert.ok(
    !/guidance === 'guide_me'[^}]*$/.test(before),
    'the look-back link itself is gated on Guide me, so Let me lead cannot reach it'
  );
  return 'nudged only for Guide me, tappable for everyone';
});

await check('an unset pace is never nudged', async () => {
  const { dueForLookback } = await import(
    `file://${cwd}/mobile/src/components/goals-block.tsx`
  ).catch(() => ({ dueForLookback: null }));
  // The component cannot be imported without a renderer, so the gate is read as
  // text above. What IS checkable here is the interval helper's behaviour, which
  // is exported from the same file and is pure.
  if (typeof dueForLookback === 'function') {
    assert.strictEqual(dueForLookback(null), true, 'never looked back is not due');
    assert.strictEqual(dueForLookback(new Date().toISOString()), false, 'just looked back is due');
    return 'and the interval is a fortnight';
  }
  // Not importable: assert the shape instead, so this never silently passes.
  const src = read('mobile/src/components/goals-block.tsx');
  assert.ok(/14 \* 24 \* 60 \* 60 \* 1000/.test(src), 'the fortnight interval has gone');
  assert.ok(/if \(!lastAt\) return true;/.test(src), 'never having looked back is not treated as due');
  return 'a fortnight, read from source (the component needs a renderer to import)';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
