// Does infer-then-confirm hold together at its edges?
//
// The failure that matters here is applying a change nobody agreed to, so most of
// these check that something does NOT happen. Pure functions, no API, free to run.
//
//   npx tsx scripts/probe-focus-capture.mjs

import {
  coerceFocus,
  focusAppliedNote,
  pendingFocusPrompt,
  readPending,
} from '../app/lib/focus-states.ts';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   (got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)})`}`);
};

const ago = (days) => new Date(Date.now() - days * 86_400_000).toISOString();

console.log('\n  THE VOCABULARY IS CLOSED\n');
check('reduce is a state', coerceFocus('reduce'), 'reduce');
check('cut is not', coerceFocus('cut'), null);
check('empty is not', coerceFocus(''), null);
check('undefined is not', coerceFocus(undefined), null);
// The original bug in one line: a bad value must not become 'maintain' silently.
check('a typo does not fall through to maintain', coerceFocus('mantain'), null);

console.log('\n  AN OFFER EXPIRES\n');
const fresh = { pending_fat_focus: 'reduce', pending_muscle_focus: null, pending_focus_asked_at: ago(1) };
const stale = { pending_fat_focus: 'reduce', pending_muscle_focus: null, pending_focus_asked_at: ago(9) };
check('yesterday: still live', readPending(fresh).fat, 'reduce');
check('nine days ago: expired', readPending(stale).fat, null);
check('  and reports no askedAt, so nothing can be applied', readPending(stale).askedAt, null);
check('no offer at all', readPending({}).fat, null);
check('null profile', readPending(null).fat, null);
check('garbage timestamp does not resurrect it', readPending({ pending_fat_focus: 'reduce', pending_focus_asked_at: 'not-a-date' }).fat, null);

console.log('\n  THE PROMPT ONLY APPEARS WHEN THERE IS SOMETHING TO ANSWER\n');
check('no offer: no prompt', pendingFocusPrompt(readPending({})), '');
check('expired offer: no prompt', pendingFocusPrompt(readPending(stale)), '');
const p = pendingFocusPrompt(readPending(fresh));
check('live offer: prompt appears', p.length > 0, true);
check('  it forbids re-raising', /do not raise it again/i.test(p), true);
check('  it forbids reading silence as yes', /never treat them moving on as agreement/i.test(p), true);
check('  it forbids inventing numbers', /do not describe targets or numbers you have not been given/i.test(p), true);

console.log('\n  THE NOTE IS WRITTEN BY THE APP, AND ONLY WHEN SOMETHING CHANGED\n');
check('nothing applied: no note', focusAppliedNote({ fat: null, muscle: null }), null);
const note = focusAppliedNote({ fat: 'reduce', muscle: null });
check('fat applied: a note', typeof note === 'string' && note.length > 0, true);
check('  it says targets shift FROM NOW, not retroactively', /from now on/i.test(note), true);
check('  it says how to undo it', /change it any time/i.test(note), true);
check('  it quotes no number', /\d/.test(note), false);
const both = focusAppliedNote({ fat: 'reduce', muscle: 'increase' });
check('both applied: one sentence, both named', /fat focus/.test(both) && /muscle focus/.test(both), true);

console.log('\n  NO DIET-CULTURE LANGUAGE (Part Eight: "cut/bulk, diet and similar are rejected")\n');
const allCopy = [p, note, both].join(' ');
check('no cut/bulk/diet/cheat/burn-off', /\b(cut|bulk|dieting|cheat|shred|torch)\b/i.test(allCopy), false);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
