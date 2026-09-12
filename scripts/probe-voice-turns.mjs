// Does the voice adapter tell a new turn from the same turn sent again?
//
// The failures that matter, all seen on a real phone on 2026-09-12: a call
// ended because a resent turn got an empty answer; a question added after a
// pause was never answered; a "yes, save it" nearly lost to a comma. Pure
// functions, no API, free to run. The sentences are invented, not Ruth's.
//
//   npx tsx scripts/probe-voice-turns.mjs

import { offeredTools, wasHeard, words } from '../app/lib/voice-turns.ts';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   (got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)})`}`);
};

console.log('\n  WORDS, NOT PUNCTUATION\n');
check('punctuation and case do not matter', words('My wrist, AGAIN!'), 'my wrist again');
check('the same words resent are the same', words('Okay. Log it.') === words('okay, log it'), true);
check('a longer sentence is not the same words', words('It aches.') === words('It aches, and it is swollen.'), false);
check('silence has no words', words('...'), '');

console.log('\n  WAS THE LAST ANSWER HEARD?\n');
const answer = 'That sounds like a lot of load on the wrist this week, so worth watching whether it settles.';
check('spoken as written: heard', wasHeard(answer, [answer]), true);
check('spoken after the holding line: heard', wasHeard(answer, [`Let me put that together for you. ${answer}`]), true);
check('spoken with different punctuation: heard', wasHeard(answer, ['That sounds like a lot of load on the wrist this week - so worth watching.']), true);
check('interrupted part way, but past the opening: heard', wasHeard(answer, ['That sounds like a lot of load on the wrist this']), true);
check('dropped because she kept talking: not heard', wasHeard(answer, ['Good to have you here.', 'Something else entirely.']), false);
check('nothing spoken yet: not heard', wasHeard(answer, []), false);
check('an empty answer is never "heard"', wasHeard('', ['anything']), false);
check('two replies that start alike but differ are told apart',
  wasHeard('Got it, 30 minutes of cycling logged. Nice steady one.', ['Got it, 45 minutes of swimming logged. That is a long one.']), false);

console.log('\n  WHICH TOOLS ELEVENLABS OFFERED\n');
const offered = offeredTools([
  { type: 'function', function: { name: 'end_call', parameters: {} } },
  { type: 'function', function: { name: 'skip_turn', parameters: {} } },
]);
check('end_call is offered', offered.has('end_call'), true);
check('skip_turn is offered', offered.has('skip_turn'), true);
check('nothing is invented', offered.has('transfer_to_agent'), false);
check('no tools array: nothing offered', offeredTools(undefined).size, 0);
check('garbage is ignored', offeredTools([null, 7, { function: {} }, 'x']).size, 0);
check('a bare name is read too', offeredTools([{ name: 'skip_turn' }]).has('skip_turn'), true);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
