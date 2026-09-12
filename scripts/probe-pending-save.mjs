// Does the conversational save hold together at its edges?
//
// The failure that matters is keeping something nobody agreed to keep, or
// keeping something other than what was offered. So most of these check that
// something does NOT happen. Pure functions, no API, free to run.
//
//   npx tsx scripts/probe-pending-save.mjs

import {
  SAVE_OFFER_QUESTION,
  coerceProposal,
  coerceSaveType,
  offerQuestion,
  pendingSavePrompt,
  prepareNote,
  readPendingSave,
  saveAppliedNote,
} from '../app/lib/pending-save.ts';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   (got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)})`}`);
};

const hoursAgo = (h) => new Date(Date.now() - h * 3_600_000).toISOString();

console.log('\n  THE TYPES ARE CLOSED\n');
check('symptom is a type', coerceSaveType('symptom'), 'symptom');
check('case and spaces do not matter', coerceSaveType(' Note '), 'note');
check('roundup is never offered', coerceSaveType('roundup'), null);
check('a plan is not this path', coerceSaveType('movement plan'), null);
check('undefined is not a type', coerceSaveType(undefined), null);

console.log('\n  AN OFFER HAS TO BE A REAL ONE\n');
const symptom = { type: 'symptom', title: 'Sore hips after ballet', content: { summary: 'Hips sore the morning after ballet' } };
check('a symptom with its words is accepted', coerceProposal(symptom)?.type, 'symptom');
check('no title: refused', coerceProposal({ ...symptom, title: '  ' }), null);
check('no words: refused', coerceProposal({ ...symptom, content: {} }), null);
check('a bare string becomes the summary', coerceProposal({ ...symptom, content: 'hips sore' })?.content.summary, 'hips sore');
check('an insight needs both halves', coerceProposal({ type: 'insight', title: 'x', content: { condition: 'before a period' } }), null);
check('  and is accepted with both', coerceProposal({ type: 'insight', title: 'x', content: { condition: 'a', expectation: 'b' } })?.type, 'insight');
check('an array is not content', coerceProposal({ ...symptom, content: ['a'] }), null);
check('a long title is cut to 80', coerceProposal({ ...symptom, title: 'x'.repeat(200) })?.title.length, 80);

console.log('\n  A NOTE SHE ASKED FOR KEEPS HER WORDS\n');
check('empty: nothing to keep', prepareNote('   '), null);
const n = prepareNote('I feel really good today. Slept well too.');
check('her words kept exactly', n?.content.summary, 'I feel really good today. Slept well too.');
check('the title is the first sentence', n?.title, 'I feel really good today.');
check('a long first sentence is cut with an ellipsis', prepareNote('a'.repeat(90))?.title.endsWith('…'), true);

console.log('\n  AN OFFER EXPIRES AFTER TWO DAYS\n');
const live = { pending_save: symptom, pending_save_asked_at: hoursAgo(3) };
const old = { pending_save: symptom, pending_save_asked_at: hoursAgo(49) };
check('three hours ago: still live', readPendingSave(live).proposal?.title, 'Sore hips after ballet');
check('forty-nine hours ago: expired', readPendingSave(old).proposal, null);
check('  and reports no askedAt, so nothing can be saved', readPendingSave(old).askedAt, null);
check('no offer at all', readPendingSave({}).proposal, null);
check('null profile', readPendingSave(null).proposal, null);
check('garbage timestamp does not resurrect it', readPendingSave({ pending_save: symptom, pending_save_asked_at: 'nope' }).proposal, null);
check('a stored offer that is no longer valid is not live', readPendingSave({ pending_save: { type: 'plan' }, pending_save_asked_at: hoursAgo(1) }).askedAt, null);

console.log('\n  THE PROMPT ONLY APPEARS WHEN THERE IS SOMETHING TO ANSWER\n');
check('no offer: no prompt', pendingSavePrompt(readPendingSave({})), '');
check('expired offer: no prompt', pendingSavePrompt(readPendingSave(old)), '');
const p = pendingSavePrompt(readPendingSave(live));
check('live offer: prompt appears', p.length > 0, true);
check('  it names what was offered', p.includes('Sore hips after ballet'), true);
check('  it forbids re-raising', /do not raise it again/i.test(p), true);
check('  it forbids a second offer while one waits', /do not make a new offer while this one is waiting/i.test(p), true);
check('  it forbids reading silence as yes', /never treat them moving on as agreement/i.test(p), true);
check('  it forbids claiming the save', /never say you have saved anything/i.test(p), true);

console.log('\n  THE CONFIRMATION IS WRITTEN BY THE APP, AND TELLS THE TRUTH\n');
check('nothing attempted: nothing said', saveAppliedNote(null, false), null);
const ok = saveAppliedNote({ kind: 'symptom', title: 'x' }, true);
check('saved: says where it went', /Almanac, under Insights/.test(ok), true);
check('  names the type', /as a symptom/.test(ok), true);
check('failed: says so, never claims it', /didn't save/.test(saveAppliedNote(null, true)), true);
check('no em dashes in anything she reads', [ok, saveAppliedNote(null, true), SAVE_OFFER_QUESTION].some((s) => s.includes('—')), false);

console.log('\n  THE APP ASKS THE OFFER, ONCE\n');
check('a plain reply gets the question', offerQuestion('Ballet asks a lot of your hips.'), SAVE_OFFER_QUESTION);
check('  and it is a question', SAVE_OFFER_QUESTION.endsWith('?'), true);
check('the model already asked: not asked twice', offerQuestion('That tracks. Want me to keep that in your Almanac?'), null);
check('  whatever its wording', offerQuestion('Shall I save this to your almanac for you?'), null);
check('the Almanac named, but not asked: still asked', offerQuestion('Your plan is in your Almanac. How did it go?'), SAVE_OFFER_QUESTION);
check('an unrelated question does not suppress it', offerQuestion('Is it easing within a day or two?'), SAVE_OFFER_QUESTION);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
