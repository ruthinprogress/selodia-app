// WHAT THE APP DID ARRIVES BEFORE THE WORDS ABOUT IT.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-the-first-half-arrives-first.mjs
//
// Ruth, 15 October 2026, choosing how to spend the latency work: "two-stage
// reply". And closing off the cheap option in the same sentence - skipping the
// second model call "is not an option as the majority of app usage will need it
// to demonstrate premium price and also because it's literally what's building
// what I want."
//
// So the turn is not shortened. It is split. A led turn is two model calls,
// 13.6s on average and 28.5s at worst, and everything the app DOES is decided
// and written about seven seconds in - the rest is prose about it. The server
// publishes that half as soon as it is true and the phone shows it, which is
// what she asked for on 14 October: "it's quite disconcerting if it says
// nothing for a log, it's history. i like it best when it does a little table
// confirming what i told it."
//
// WHY THIS FILE IS MOSTLY ABOUT FAILING SAFELY. The turn she depends on is
// untouched by design: the existing response still carries every one of these
// fields a few seconds later, and the phone still builds the thread from it.
// This is an optimisation layered on top, so the thing to prove is not that it
// works but that nothing breaks when it does not - no new endpoint, no held
// request, no timer outliving its turn, and a malformed id that misses rather
// than doing something strange.

import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { usableTurnId, worthPublishing } = await import(root + '/app/lib/turn-stage.ts');

// READ WITHOUT CARRIAGE RETURNS. The working tree is CRLF on this machine, so
// every pattern below that spans a line break would fail against the file and
// pass against the same file on a colleague's. Two checks did exactly that
// before this line existed, and both were reporting a bug that was not there.
const read = (path) => readFileSync(path, 'utf8').split(String.fromCharCode(13)).join('');

const route = read('app/api/ask-selodia/route.ts');
const screen = read('mobile/src/app/(tabs)/index.tsx');
const progress = read('mobile/src/components/turn-progress.tsx');
const client = read('mobile/src/lib/turn-stage.ts');

let pass = 0;
const failures = [];
function check(name, fn) {
  try {
    const note = fn();
    console.log(`  PASS  ${name}${note ? `   ${note}` : ''}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL  ${name}\n          ${e.message}`);
    failures.push(name);
  }
}

console.log('\n  THE FIRST HALF ARRIVES FIRST\n');

check('a turn id invented by a client is checked before it is used', () => {
  assert.ok(usableTurnId('m2x9k1-ab12cd34ef'), 'a normal id was rejected');
  assert.ok(usableTurnId('A'.repeat(64)), 'a 64 character id was rejected');
  for (const bad of [
    null,
    undefined,
    42,
    '',
    'short',
    'A'.repeat(65),
    "'; drop table turn_stage; --",
    'has spaces in it',
    'has/a/slash',
    '../../etc/passwd',
  ]) {
    assert.ok(!usableTurnId(bad), `${JSON.stringify(bad)} was accepted as a turn id`);
  }
  return '10 bad ids refused, 2 good ones accepted';
});

check('an empty turn publishes nothing', () => {
  // Most turns are conversation and do nothing at all. A row saying so would
  // put an empty confirmation on her screen.
  assert.strictEqual(worthPublishing({}), false);
  assert.strictEqual(worthPublishing({ summary: null, almanacTitle: null, foodLogId: null, reminder: null }), false);
  assert.strictEqual(worthPublishing({ summary: 'Breakfast · 420 kcal' }), true);
  assert.strictEqual(worthPublishing({ foodLogId: 'abc' }), true);
  return 'only a turn that did something';
});

check('the publish never throws', () => {
  // A turn must not fail because its progress note did. Proved by reading the
  // one thing that makes it true, because a thrown error here reaches her as a
  // message that did not send.
  const lib = read('app/lib/turn-stage.ts');
  assert.ok(/} catch \(err\) \{/.test(lib), 'the insert is not wrapped');
  assert.ok(/return false;\n  \}\n\}/.test(lib), 'the catch does not swallow and return');
  assert.ok(/if \(error\) \{/.test(lib), 'a returned error is not handled');
  return 'throw and returned-error both swallowed';
});

console.log('\n  THE SERVER PUBLISHES IT AT THE RIGHT MOMENT\n');

check('the route takes the id the phone invented', () => {
  assert.ok(/^\s+clientTurnId,$/m.test(route), 'clientTurnId is not read off the request');
  assert.ok(/publishStage\(\{/.test(route), 'the stage is never published');
  return 'read and used';
});

check('IT IS PUBLISHED BEFORE THE REPLY IS WRITTEN', () => {
  // The entire point. Published after the reply call and it is not a first
  // half, it is a duplicate of the answer she already has.
  const published = route.indexOf('await publishStage({');
  const replyCall = route.indexOf('const lead = await writeLeadReply({');
  assert.ok(published > 0, 'publishStage is not called');
  assert.ok(replyCall > 0, 'the lead reply call has moved or been renamed');
  assert.ok(published < replyCall, 'the first half is published AFTER the reply is written');
  return 'ahead of the second model call';
});

check('and before the unsafe-goal rewrite, which is a whole extra call', () => {
  const published = route.indexOf('await publishStage({');
  const goal = route.indexOf("if (goalAssessment.verdict === 'unsafe')");
  assert.ok(goal > 0, 'the goal branch has moved');
  assert.ok(published < goal, 'the confirmation waits behind the goal rewrite');
  return 'a rare extra call does not delay it';
});

check('after everything it reports is known', () => {
  // Published before any of these is assigned and it reports a turn that has
  // not happened yet.
  const published = route.indexOf('await publishStage({');
  for (const [what, marker] of [
    ['the save', 'let saved: {'],
    ['the reminder', 'let reminderResult:'],
    ['the food breakdown', 'let breakdownFoodLogId: string | null = null;'],
    ['the Almanac entry', 'let savedAlmanac: { kind: string; title: string } | null = null;'],
  ]) {
    const at = route.indexOf(marker);
    assert.ok(at > 0, `could not find ${what}`);
    assert.ok(at < published, `${what} is decided after the stage is published`);
  }
  return 'save, reminder, food and Almanac all settled first';
});

check('not on a spoken turn, which has no screen', () => {
  assert.ok(
    /if \(!isVoice\) \{\n\s+await publishStage\(\{/.test(route),
    'a voice turn publishes a stage nobody can look at'
  );
  return 'typed turns only';
});

check('the response still carries everything, so nothing depends on this', () => {
  // THE PROPERTY THAT MAKES THE WHOLE THING SAFE. Every field published early
  // arrives again in the ordinary response, which is what the thread is built
  // from, so a stage that never lands costs only the early confirmation.
  for (const field of ['saved,', 'savedAlmanac,', 'foodLogId: breakdownFoodLogId,', 'reminder: reminderResult,']) {
    assert.ok(route.includes(field), `the final response no longer returns ${field}`);
  }
  return 'all four still in the final response';
});

console.log('\n  AND THE PHONE GIVES UP CLEANLY\n');

check('the phone names the turn before it sends it', () => {
  assert.ok(/const turnId = newTurnId\(\);/.test(screen), 'the turn is not named');
  assert.ok(/clientTurnId: turnId,/.test(screen), 'the name is not sent');
  const named = screen.indexOf('const turnId = newTurnId();');
  const sent = screen.indexOf('clientTurnId: turnId,');
  assert.ok(named < sent, 'the turn is named after it is sent, which cannot work');
  return 'named, then sent';
});

check('THE WATCH IS ALWAYS STOPPED', () => {
  // A timer per message, left running, is the kind of leak that shows up a
  // week later as an app that gets slower the longer it is open.
  assert.ok(/\} finally \{\n(.*\n)*?\s+stopWatching\(\);/.test(screen), 'the watch is not stopped in a finally');
  const started = screen.indexOf('const stopWatching = watchForStage(');
  const stopped = screen.indexOf('stopWatching();');
  assert.ok(started > 0 && stopped > started, 'the watch is stopped before it starts');
  return 'stopped in finally, so a failed turn stops it too';
});

check('and it gives up on its own even if nobody stops it', () => {
  assert.ok(/forMs = 25000/.test(client), 'the watch has no deadline of its own');
  assert.ok(/clearInterval\(timer\);/.test(client), 'the timer is never cleared');
  return 'a 25 second deadline inside the watch';
});

check('a failed read is silent, because the turn is still fine', () => {
  assert.ok(/\} catch \{/.test(client), 'a failed poll is not caught');
  assert.ok(!/throw /.test(client), 'the watch can throw at the caller');
  return 'no error about a message that is on its way';
});

check('it reads through the ordinary client, so there is no new endpoint', () => {
  assert.ok(/from '@\/lib\/supabase'/.test(client), 'it does not use the app client');
  assert.ok(!/api\//.test(client), 'it calls an endpoint of its own');
  const endpoints = readdirSync('app/api');
  assert.ok(!endpoints.includes('turn-stage'), 'an endpoint was added after all');
  return 'row-level security does the authorising';
});

check('the progress line shows what happened, not a guess, once it knows', () => {
  assert.ok(/export function TurnProgress\(\{ acted = null \}/.test(progress), 'the component does not take a stage');
  assert.ok(/\{sending && <TurnProgress acted=\{acted\} \/>\}/.test(screen), 'the stage is not passed in');
  assert.ok(/Writing back…/.test(progress), 'it does not say what is still running');
  return 'the estimate is replaced by the fact';
});

console.log('\n  AND THE TABLE IS WHAT IT SAYS IT IS\n');

check('the migration exists, with row-level security on it', () => {
  const file = readdirSync('supabase/migrations').find((f) => f.includes('the_app_says_what_it_did'));
  assert.ok(file, 'no migration file for turn_stage');
  const sql = read(`supabase/migrations/${file}`);
  assert.ok(/create table if not exists public\.turn_stage/.test(sql), 'the table is not created');
  assert.ok(/alter table public\.turn_stage enable row level security/.test(sql), 'RLS is not enabled');
  assert.ok(/auth\.uid\(\) = user_id/.test(sql), 'the policy does not limit rows to their owner');
  assert.ok(/create unique index if not exists turn_stage_one_per_turn/.test(sql), 'a turn could write two rows');
  return file;
});

check('and this check can fail', () => {
  // The weak version: "publishStage is called somewhere". That passes with the
  // call sitting after the reply, which is the one arrangement that makes the
  // whole feature pointless.
  const published = route.indexOf('await publishStage({');
  const replyCall = route.indexOf('const lead = await writeLeadReply({');
  assert.ok(route.includes('publishStage'), 'the route does not publish at all');
  assert.notStrictEqual(
    published > replyCall,
    true,
    'publishing after the reply would satisfy a weaker check and buy nothing'
  );
  return 'presence proves nothing; the ordering is the feature';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
