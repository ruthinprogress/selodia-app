// When does a discussion about one entry end?
//
// Written 2026-09-16, after the tag Ruth started by tapping "Ask about this" on
// a 7 September pizza rode every message for the next two hours - including a
// bare "Hi" forty-eight minutes later and a message logging two new meals - and
// drew that pizza's card above her food catch-up.
//
// Pure decision function, no network, no database:
//
//   npx tsx scripts/probe-discuss-tag.mjs

import { countCarriedTurns, MAX_DISCUSS_TURNS, resolveDiscussTag } from '../app/lib/discuss-card.ts';

let pass = 0;
let fail = 0;

function check(name, got, want) {
  const g = got === null ? 'null' : got.entryId;
  const w = want === null ? 'null' : want.entryId;
  if (g === w) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}\n          got ${g}, wanted ${w}`);
  }
}

const PIZZA = { entryId: 'pizza-7-sept', entryType: 'food' };
const SESSION = { entryId: 'run-tuesday', entryType: 'activity' };

console.log('\n  POSTING A CARD OUTRANKS EVERYTHING\n');

check(
  'a fresh tap wins over a running discussion',
  resolveDiscussTag({ posted: SESSION, previous: PIZZA, topicEnded: false }),
  SESSION
);
check(
  'a fresh tap wins even while logging something new',
  resolveDiscussTag({
    posted: SESSION,
    previous: PIZZA,
    topicEnded: false,
    loggedSomethingNew: true,
  }),
  SESSION
);
check(
  'a fresh tap wins even after a long silence',
  resolveDiscussTag({
    posted: SESSION,
    previous: PIZZA,
    topicEnded: false,
    minutesSincePrevious: 600,
  }),
  SESSION
);

console.log('\n  LOGGING SOMETHING NEW ENDS IT\n');

check(
  'the catch-up that carried a pizza no longer does',
  resolveDiscussTag({
    posted: null,
    previous: PIZZA,
    topicEnded: false,
    loggedSomethingNew: true,
  }),
  null
);
check(
  'a turn that logs nothing keeps the discussion',
  resolveDiscussTag({
    posted: null,
    previous: PIZZA,
    topicEnded: false,
    loggedSomethingNew: false,
  }),
  PIZZA
);

console.log('\n  A LONG GAP ENDS IT, A PAUSE DOES NOT\n');

check(
  'the 48-minute "Hi" starts a new conversation',
  resolveDiscussTag({ posted: null, previous: PIZZA, topicEnded: false, minutesSincePrevious: 48 }),
  null
);
check(
  'twenty minutes is still the same conversation',
  resolveDiscussTag({ posted: null, previous: PIZZA, topicEnded: false, minutesSincePrevious: 20 }),
  PIZZA
);
check(
  'forty-five minutes exactly is still inside',
  resolveDiscussTag({ posted: null, previous: PIZZA, topicEnded: false, minutesSincePrevious: 45 }),
  PIZZA
);
check(
  'an unknown gap is not treated as a stale one',
  resolveDiscussTag({ posted: null, previous: PIZZA, topicEnded: false, minutesSincePrevious: null }),
  PIZZA
);
check(
  'an absent gap is not treated as a stale one',
  resolveDiscussTag({ posted: null, previous: PIZZA, topicEnded: false }),
  PIZZA
);

console.log('\n  THE MODEL CAN STILL END IT, AND CONTINUE-BY-DEFAULT HOLDS\n');

check(
  'the model says the subject changed',
  resolveDiscussTag({ posted: null, previous: PIZZA, topicEnded: true }),
  null
);
check(
  'silence from the model keeps the discussion',
  resolveDiscussTag({ posted: null, previous: PIZZA, topicEnded: false }),
  PIZZA
);
check(
  'nothing to carry, nothing carried',
  resolveDiscussTag({ posted: null, previous: null, topicEnded: false }),
  null
);

console.log('\n  A DISCUSSION HAS A LENGTH (2026-09-19)\n');
// 18 September: the oxtail dinner's tag rode 38 messages through a continuous
// conversation that had moved on long before. The silence rule never fired,
// because every carried message reset its clock.
const STEW = { entryId: 'oxtail-18-sept', entryType: 'food' };
const carrying = (n) =>
  resolveDiscussTag({ posted: null, previous: STEW, topicEnded: false, minutesSincePrevious: 1, turnsCarried: n });
check('the second question about the stew still carries it', carrying(1), STEW);
check('the fifth still carries it', carrying(MAX_DISCUSS_TURNS - 1), STEW);
check('at the limit, it lets go even mid-conversation', carrying(MAX_DISCUSS_TURNS), null);
check('the 38th message is certainly not about the stew', carrying(19), null);
check(
  'posting the card again starts it afresh, whatever came before',
  resolveDiscussTag({ posted: STEW, previous: STEW, topicEnded: false, turnsCarried: 19 }),
  STEW
);

console.log('\n  COUNTING WHERE IT STARTED\n');
const runOf = (rows) => countCarriedTurns(rows, 'oxtail-18-sept');
const tagged = (role) => ({ role, discuss_entry_id: 'oxtail-18-sept' });
const other = (role) => ({ role, discuss_entry_id: null });
const counted = runOf([tagged('assistant'), tagged('user'), tagged('assistant'), tagged('user'), other('user')]);
if (counted === 2) {
  pass += 1;
  console.log('  PASS  only their messages count, and only back to the start');
} else {
  fail += 1;
  console.log(`  FAIL  counted ${counted}, wanted 2`);
}
const none = runOf([other('assistant'), tagged('user')]);
if (none === 0) {
  pass += 1;
  console.log('  PASS  a break ends the run');
} else {
  fail += 1;
  console.log(`  FAIL  counted ${none}, wanted 0`);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
