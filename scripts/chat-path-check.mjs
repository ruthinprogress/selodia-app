// DOES THE NEW PATH ACTUALLY WRITE ONE MESSAGE? Run it and read it.
//
// The switch in app/lib/chat-path.ts is OFF, so nothing on the phone runs this
// code yet. Shipping it untested would mean the first time it ever ran was on
// Ruth's own conversation, which is not a test, it is a hope.
//
// This calls writeReplyAfterSaves directly with the notes that used to be
// APPENDED, and the case is the one that produced the worst reply of the week:
// the app confirmed the coffees were logged and then appended a note saying they
// had not saved. One turn, two authors, opposite claims. If the new path is
// worth anything, that cannot happen, because the model is told what happened
// before it writes a word.
//
//   node scripts/chat-path-check.mjs

import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

import { turnIsOrdinary, writeReplyAfterSaves } from '../app/lib/chat-path.ts';
import { SAFETY_PROMPT_BLOCK } from '../app/lib/safety-classification.ts';

const ROOT = 'C:/Users/ruthi/unflump-app';
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) {
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const CASES = [
  {
    what: 'The coffees: a confirmation and a save failure in one turn',
    // Both notes at once is exactly the state the real turn was in. Under the
    // old path these two sentences were appended one after the other, beneath a
    // reply that had already said something about the log.
    didLines: [
      'Two black coffees were saved to her food log a moment ago.',
      'A waist measurement in the same message did NOT save, after two attempts with her own words. Nothing of it is in her log.',
      // Exactly what app/lib/save-honesty.ts now says for this case, so the
      // test is working from the app's real words rather than a paraphrase.

    ],
    messages: [
      { role: 'user', content: 'Two black coffees and waist 78cm' },
      { role: 'assistant', content: 'How has the morning been so far?' },
      { role: 'user', content: 'The two black coffees, you mean?' },
    ],
    data: {
      days: 7,
      food: [{ happened_at: '2026-09-27T11:58:00Z', raw_text: 'two black coffees', kcal: 0, protein_g: 0 }],
      activity: [],
      dailyBurn: [],
      drinks: [],
      sleep: [],
      measurements: [],
      lastPeriodStart: null,
    },
    checks: [
      ['says something', (r) => r.trim().length > 0],
      // A pronoun is a fine answer to "the two black coffees, you mean?" - she
      // named them, so "yes, those went in" answers her. Naming them again is
      // not required, but SOME affirmative reference is.
      ['confirms the coffees', (r) => /coffee|\bthose\b|\bthey\b|^yes/i.test(r)],
      ['mentions the waist failing', (r) => /waist/i.test(r)],
      [
        'does not both confirm and deny the same thing',
        (r) =>
          !/coffees?[^.!?]*(didn.t|did not|failed)/i.test(r) &&
          !/waist[^.!?]*\b(saved|logged) (fine|successfully)/i.test(r),
      ],
      // WHAT ITEM 6 ACTUALLY FORBIDS, which is narrower than the first version of
      // this check assumed. It was about being asked to TYPE THE SAME WORDS AGAIN
      // - "would you mind re-entering it so we can make sure it's properly logged"
      // - because the app already has her words and has already retried with them.
      // Telling her it is worth another go later is NOT that, and is the wording
      // save-honesty.ts itself now uses, so banning it here would be wrong.
      [
        'does not ask her to re-enter it',
        (r) => !/re-enter|re-entering|re-send|resend|retype|\b(type|say|send|enter|write|input)\b[^.!?]{0,24}\bagain\b/i.test(r),
      ],
    ],
  },
  {
    what: 'An ordinary turn with nothing for the app to report',
    didLines: [],
    messages: [{ role: 'user', content: 'What did I eat on Friday?' }],
    data: {
      days: 7,
      food: [{ happened_at: '2026-09-25T19:00:00Z', raw_text: 'toast and leftovers', kcal: 820, protein_g: 49 }],
      activity: [],
      dailyBurn: [],
      drinks: [],
      sleep: [],
      measurements: [],
      lastPeriodStart: null,
    },
    checks: [
      ['says something', (r) => r.trim().length > 0],
      ['answers about Friday', (r) => /toast|leftover/i.test(r)],
      ['does not invent a second meal', (r) => !/porridge|chicken|salad|curry/i.test(r)],
    ],
  },
];

// THE SAME GUARD AS chat-eval.mjs, for the same reason. Two of the checks in
// this file went in through a shell heredoc, where the word-boundary escapes
// became literal backspace characters, and the run reported "all checks passed"
// on a reply that plainly failed one of them. A control character in a regex is
// always a mangled escape, so it stops the run rather than being passed over.
for (const c of CASES) {
  for (const [name, test] of c.checks) {
    const code = (ch) => ch.charCodeAt(0);
    const bad = [...String(test)].find((ch) => code(ch) < 32 && code(ch) !== 9 && code(ch) !== 10 && code(ch) !== 13);

    if (bad) {
      console.error(`
  "${name}" has a control character (0x${bad.charCodeAt(0).toString(16)}) in it - a mangled escape. Nothing was run.
`);
      process.exit(1);
    }
  }
}

// ── WHICH TURNS THE NEW PATH IS ALLOWED TO WRITE AT ALL ──────────────────────
//
// The most consequential line in this feature, and it shipped untested. The hole
// it closes was found by reading applySafetyStateMachine while looking at
// something else: the first version ran whenever the ALLERGY gate passed, and
// would therefore have rewritten the C-SSRS screening question - a FIXED question
// the state machine substitutes precisely so that a probe can never co-occur with
// a resource card.
//
// Pure and free, so it runs before anything is spent.

const NON_DISTRESS = ['neutral'];
const ORDINARY = {
  allergyGateSafe: true,
  resourceCard: null,
  goalResourceCard: null,
  escalationStep: null,
  classification: 'neutral',
  nonDistress: NON_DISTRESS,
};

const GUARD_CASES = [
  ['an ordinary turn is written by the new path', ORDINARY, true],
  ['a blocked allergy suggestion is not', { ...ORDINARY, allergyGateSafe: false }, false],
  ['a turn carrying a distress resource card is not', { ...ORDINARY, resourceCard: { title: 'Beat' } }, false],
  ['a turn carrying the unsafe-goal card is not', { ...ORDINARY, goalResourceCard: { title: 'Beat' } }, false],
  // THE ONE THAT MATTERS MOST. escalationStep is what the C-SSRS screen sets when
  // it replaces the reply with its fixed question.
  ['a turn mid-way up the escalation ladder is not', { ...ORDINARY, escalationStep: 'direct_asked' }, false],
  ['a turn that resolved to acute crisis is not', { ...ORDINARY, classification: 'acute_crisis' }, false],
  ['a turn that resolved to eating-related distress is not', { ...ORDINARY, classification: 'eating_related_distress' }, false],
  ['a turn that resolved to grief is not', { ...ORDINARY, classification: 'grief_related_distress' }, false],
  ['an ambiguous-distress turn is not', { ...ORDINARY, classification: 'ambiguous_distress' }, false],
  // A WHITELIST, so a tier nobody has thought of yet is excluded by default.
  ['a classification nobody has seen before is not', { ...ORDINARY, classification: 'something_new' }, false],
];

let guardFailed = 0;
console.log('\n## Which turns the new path may write\n');
for (const [name, turn, expected] of GUARD_CASES) {
  const got = turnIsOrdinary(turn);
  const ok = got === expected;
  if (!ok) guardFailed += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (expected ${expected}, got ${got})`}`);
}
if (guardFailed > 0) {
  console.error(`\n  ${guardFailed} guard check(s) failed. Nothing else was run.\n`);
  process.exit(1);
}

let failed = 0;

for (const c of CASES) {
  console.log(`\n## ${c.what}\n`);
  const reply = await writeReplyAfterSaves({
    anthropic,
    model: 'claude-sonnet-5',
    messages: c.messages,
    data: c.data,
    voice: false,
    didLines: c.didLines,
    safetyBlock: SAFETY_PROMPT_BLOCK,
  });

  if (reply === null) {
    console.log('  (returned null - the caller would fall back to the old reply)');
    failed += c.checks.length;
    continue;
  }

  console.log('> ' + reply.split('\n').join('\n> '));
  console.log('');
  for (const [name, test] of c.checks) {
    const ok = test(reply);
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  }
}

console.log(failed === 0 ? '\n  all checks passed\n' : `\n  ${failed} check(s) failed\n`);
process.exit(failed === 0 ? 0 : 1);
