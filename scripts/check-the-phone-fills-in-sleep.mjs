// A HEALTH PERMISSION IS EITHER READ OR NOT ASKED FOR.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-the-phone-fills-in-sleep.mjs
//
// Ruth, 23 October 2026: "we need any data that comes from the phone as it will
// be build into the app since the whole idea is to reduce friction, so a run
// logged on samsung health flows in automatically from the phone or the
// wearable. if it doesn't do that people with wearables will think selodia is
// junk, simple as that."
//
// WHAT WAS TRUE BEFORE SHE ASKED. app.json requested TWELVE Android health
// permissions and the app read exactly one data type - steps. Sleep, weight,
// body fat, menstruation, exercise and six others were asked for and never
// touched. Her own privacy screen said "Selodía asks for steps alone", which
// contradicted the manifest; the screen was the honest one.
//
// I recommended stripping the eleven. She overruled it, and she was right: the
// permissions are not a mistake, they are the product. Reducing them would have
// locked in the friction instead of removing it. So the code grows to meet the
// manifest, one data type at a time, and this check follows that progress.
//
// WHAT IT GUARDS, which is the part that rots quietly:
//   - the reader exists and is wired to a control, not just written
//   - the quality of a night is NEVER taken from a watch
//   - what she typed is never overwritten by what the phone says
//   - the privacy screen matches what the app actually reads

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { nightFromSession, nightOfFor, mergeNights } = await import(
  root + '/mobile/src/lib/sleep-night.ts'
);

const read = (p) => readFileSync(p, 'utf8').split('\r\n').join('\n');
const SYNC = read('mobile/src/lib/sleep-sync.ts');
const NIGHT = read('mobile/src/lib/sleep-night.ts');
const PRIVACY = read('mobile/src/app/health-data.tsx');
const SCREEN = read('mobile/src/app/(tabs)/log/sleep.tsx');
const NOW = read('mobile/src/components/overview-panel.tsx');

let pass = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    pass += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

// -- reading a night -------------------------------------------------------

const AWAKE = 1, LIGHT = 4, DEEP = 5, REM = 6;

check('a night with stages counts time ASLEEP, not time in bed', () => {
  // Eight hours in bed, six and a half asleep. Both are facts; only one of
  // them is the one she is shown.
  const n = nightFromSession({
    startTime: '2026-10-22T22:00:00.000Z',
    endTime: '2026-10-23T06:00:00.000Z',
    stages: [
      { startTime: '2026-10-22T22:00:00.000Z', endTime: '2026-10-22T22:30:00.000Z', stage: AWAKE },
      { startTime: '2026-10-22T22:30:00.000Z', endTime: '2026-10-23T02:00:00.000Z', stage: DEEP },
      { startTime: '2026-10-23T02:00:00.000Z', endTime: '2026-10-23T02:30:00.000Z', stage: AWAKE },
      { startTime: '2026-10-23T02:30:00.000Z', endTime: '2026-10-23T06:00:00.000Z', stage: REM },
    ],
  });
  assert.equal(n.minutes, 420, 'it counted the whole session instead of the sleeping stages');
});

check('a night with no stages uses the session, undiscounted', () => {
  const n = nightFromSession({
    startTime: '2026-10-22T23:00:00.000Z',
    endTime: '2026-10-23T07:00:00.000Z',
  });
  assert.equal(n.minutes, 480, 'a phone-only record should be taken at its word');
  assert.equal(n.awakenings, null, 'it invented an awakening count from nothing');
});

check('waking in the middle is counted; getting into bed is not', () => {
  const n = nightFromSession({
    startTime: '2026-10-22T22:00:00.000Z',
    endTime: '2026-10-23T06:00:00.000Z',
    stages: [
      // Awake at the start - settling down, not a broken night.
      { startTime: '2026-10-22T22:00:00.000Z', endTime: '2026-10-22T22:20:00.000Z', stage: AWAKE },
      { startTime: '2026-10-22T22:20:00.000Z', endTime: '2026-10-23T01:00:00.000Z', stage: LIGHT },
      { startTime: '2026-10-23T01:00:00.000Z', endTime: '2026-10-23T01:20:00.000Z', stage: AWAKE },
      { startTime: '2026-10-23T01:20:00.000Z', endTime: '2026-10-23T05:40:00.000Z', stage: DEEP },
      // Awake at the end - getting up.
      { startTime: '2026-10-23T05:40:00.000Z', endTime: '2026-10-23T06:00:00.000Z', stage: AWAKE },
    ],
  });
  assert.equal(n.awakenings, 1, 'the settling-down and getting-up stages were counted as waking');
});

check('a night is keyed on the evening it began', () => {
  // Both of these are Tuesday night, which is how sleep_logs keys them.
  assert.equal(nightOfFor('2026-10-20T23:40:00'), '2026-10-20');
  assert.equal(nightOfFor('2026-10-21T00:20:00'), '2026-10-20');
});

check('two sessions in one night become one night', () => {
  const merged = mergeNights([
    { nightOf: '2026-10-20', minutes: 200, wentToBed: '2026-10-20T23:00:00', wokeAt: '2026-10-21T02:20:00', awakenings: 1 },
    { nightOf: '2026-10-20', minutes: 180, wentToBed: '2026-10-21T03:00:00', wokeAt: '2026-10-21T06:00:00', awakenings: 0 },
  ]);
  assert.equal(merged.length, 1, 'one night came out as two');
  assert.equal(merged[0].minutes, 380);
  assert.equal(merged[0].wentToBed, '2026-10-20T23:00:00', 'it did not take the earliest bedtime');
  assert.equal(merged[0].wokeAt, '2026-10-21T06:00:00', 'it did not take the latest waking');
});

// -- the lines that must not move -----------------------------------------

check('a watch never says how a night felt', () => {
  assert.doesNotMatch(
    SYNC.replace(/\/\/[^\n]*/g, ''),
    /quality:\s*[^n]/,
    'something is writing a sleep quality from the phone. A watch can time a '
      + 'night; it cannot know whether it was restful, and guessing puts words in '
      + 'her mouth about the one thing only she can report.'
  );
});

check('what she typed is never overwritten', () => {
  assert.match(
    SYNC,
    /row\.source !== SLEEP_SOURCE/,
    'the sync no longer protects rows she wrote herself, so a night she described '
      + 'in her own words can be replaced by the watch that did not hear her'
  );
});

check('the reader is wired to something, not just written', () => {
  assert.match(
    SCREEN,
    /SleepFromPhone/,
    'sleep-sync is imported by nobody - a reader nothing calls is a document'
  );
  assert.match(
    read('mobile/src/components/sleep-from-phone.tsx'),
    /syncSleepFromPhone/,
    'the control does not actually run the sync'
  );
});

check('permission is asked from a tap, never on load', () => {
  const file = read('mobile/src/components/sleep-from-phone.tsx');
  const onLoad = file.slice(file.indexOf('useEffect('), file.indexOf('useEffect(') + 200);
  assert.doesNotMatch(
    onLoad,
    /requestSleepPermission/,
    "the Android dialog would open because a screen rendered, which is how people "
      + 'decline something they would have agreed to'
  );
});

check('the sleep row is on Today whether or not anything is logged', () => {
  assert.doesNotMatch(
    NOW,
    /\{data\.sleep && \(data\.sleep\.minutes != null \|\| data\.sleep\.quality\) \? \(/,
    'the sleep row is conditional again. A day with no movement is a real day; a '
      + 'night with no sleep is not, so an empty row means "not logged" and must '
      + 'still be the door to the Sleep screen'
  );
  assert.match(NOW, /Not logged/, 'the empty state has no words in it');
});

check('the privacy screen matches what is actually read', () => {
  assert.doesNotMatch(
    PRIVACY,
    /asks for steps alone/i,
    'the screen still says steps alone while the app now reads sleep as well'
  );
  assert.match(PRIVACY, /sleep/i, 'the screen does not mention sleep at all');
  assert.match(
    PRIVACY,
    // TOLERANT OF THE WORDING, STRICT ABOUT THE PROMISE. This was
    // /never how a night felt/i and broke the moment the sentence was widened
    // from sleep to every reading - a check testing one phrasing rather than
    // the commitment behind it, which is the fault this repository keeps
    // finding in its own checks. What must survive is a plain statement that
    // the subjective part is never taken from a device.
    /never how [a-z ]{0,20}felt/i,
    'the screen does not say the one thing it will not take from a watch'
  );
});

// -- a blocked setting is never just named ---------------------------------
//
// Ruth, 23 October 2026: "users shouldn't be coming up against this, the app
// needs to facilitate the settings required." The first version answered every
// failure with "Not connected", which is the app reporting its own
// disappointment and handing the problem back - the one thing this product
// exists not to do.

const CONTROL = read('mobile/src/components/sleep-from-phone.tsx');

check('every failure has a way out beside it', () => {
  for (const state of ['granted-no-data', 'refused', 'needs-update', 'no-health-connect']) {
    const at = CONTROL.indexOf(`case '${state}'`);
    assert.ok(at > 0, `${state} is not handled at all`);
    const block = CONTROL.slice(at, at + 900);
    assert.match(
      block,
      /action:\s*\{/,
      `${state} tells her what is wrong and offers nothing to do about it`
    );
  }
});

check('a refusal does not offer a button Android will ignore', () => {
  const at = CONTROL.indexOf("case 'refused'");
  const block = CONTROL.slice(at, at + 900);
  assert.match(
    block,
    /openHealthConnect[^A-Za-z]/,
    'after a refusal Android stops showing its dialog, so the only working route '
      + 'is Health Connect itself - offering Connect again would be a dead button'
  );
});

// -- "NOTHING NEW" WAS THE APP GIVING UP IN TWO WORDS ----------------------
//
// Ruth, 23 October 2026, with the screenshot: the card reads "Your phone is
// filling these in" - so the permission is granted and the app knows it - she
// taps "Check for new nights", gets "Nothing new.", and that is all. "Thats all
// it shows and the bitton does nothing."
//
// The button WAS working. syncSleepFromPhone returns a count, and 0 carries two
// unrelated meanings: we already hold every night the phone has, or the phone
// holds no sleep at all. The second was what was happening and is the only one
// with a next step - the same granted-no-data case the FIRST connect already
// diagnoses and offers a way out of. Once connected, that branch was
// unreachable, so the person who most needs the next step was the only one who
// could not reach it.

/** The body of one function in the control, so a second copy cannot be read. */
function functionBody(source, name) {
  const at = source.indexOf(`function ${name}(`);
  assert.ok(at > 0, `${name} is not in the control at all`);
  // To the next top-level declaration, rather than a guessed number of
  // characters - a fixed slice in this file already failed once on correct
  // code, because the line it wanted started 16 characters past the end.
  const next = source.indexOf('\nfunction ', at + 1);
  const exported = source.indexOf('\nexport ', at + 1);
  const ends = [next, exported].filter((n) => n > 0);
  return source.slice(at, ends.length > 0 ? Math.min(...ends) : source.length);
}

check('a check for new nights reports a reason, not a count', () => {
  // The card must not call the counting function directly any more: a number
  // cannot say which kind of nothing it found.
  assert.match(CONTROL, /checkForNights\(\)/);
  assert.ok(
    !/await syncSleepFromPhone\(\)/.test(CONTROL),
    'the card is back on the bare count, which cannot tell "already have it" '
      + 'from "nothing is sharing"'
  );
  assert.match(SYNC, /export async function checkForNights\(\)/);
});

check('only a genuinely up-to-date phone is told nothing is new', () => {
  const body = functionBody(CONTROL, 'stepForCheck');
  const at = body.indexOf("case 'up-to-date'");
  assert.ok(at > 0, 'up-to-date is not handled');
  assert.match(body.slice(at, body.indexOf('case', at + 10)), /Nothing new/);
  // And the empty-phone case must NOT be one of them.
  const empty = body.indexOf("case 'nothing-on-phone'");
  assert.ok(empty > 0, 'nothing-on-phone is not handled');
  assert.doesNotMatch(body.slice(empty, body.indexOf('case', empty + 10)), /Nothing new/);
});

check('every outcome of a check has a way out, bar the one that needs none', () => {
  const body = functionBody(CONTROL, 'stepForCheck');
  for (const state of ['nothing-on-phone', 'refused', 'no-health-connect']) {
    const at = body.indexOf(`case '${state}'`);
    assert.ok(at > 0, `${state} is not handled at all`);
    const block = body.slice(at, body.indexOf('case', at + 10) + 1 || body.length);
    assert.match(block, /action:\s*\{/, `${state} offers nothing to do about it`);
  }
});

check('it names the switch, in the app the switch lives in', () => {
  // Ruth: "I won't switch it on, I want selodia to do it. Some users won't
  // manage. I didnt even know where it was to turn on either. Might lose them."
  //
  // Selodía genuinely cannot flip this one - no app may change another app's
  // sharing settings. Everything short of that is still owed: which app, which
  // screen, which switch, and why it is hers to tap.
  // Read with the source's own line joins undone, because this sentence is
  // long enough to be split across three quoted fragments and the words that
  // matter land either side of a join.
  const copy = CONTROL.replace(/'\s*\n\s*\+ '/g, '');
  assert.match(copy, /Samsung Health/);
  assert.match(copy, /Settings, then Health Connect, then turn on Sleep/);
  assert.match(CONTROL, /not allowed to change another app/);
  assert.match(CONTROL, /only has to be done once/);
});

check('the two routes to the same dead end say the same thing', () => {
  // The first connect and a later check arrive at "nothing is sharing" from
  // opposite ends, and had drifted into two descriptions of it - one naming the
  // switch and one not. One constant, used twice.
  assert.match(CONTROL, /const NOTHING_SHARING =/);
  const uses = CONTROL.split('NOTHING_SHARING').length - 1;
  assert.ok(uses >= 3, `NOTHING_SHARING is declared and used ${uses - 1} time(s)`);
});

check('a check re-reads the permission before blaming the sharing', () => {
  const body = functionBody(SYNC, 'checkForNights');
  const perm = body.indexOf('hasSleepPermission');
  const read = body.indexOf('readNightsFromPhone');
  assert.ok(perm > 0 && read > perm, 'it decides nothing is sharing without checking it may still read');
});

check('"has anything ever shared sleep" looks back further than a week', () => {
  // A week of not wearing a watch is not a broken setting, and telling somebody
  // their sharing is off when they simply did not wear it is worse than silence.
  assert.match(SYNC, /const EVER_DAYS = 30;/);
  assert.match(SYNC, /readNightsFromPhone\(EVER_DAYS\)/);
});

check('the grant comes from the request, not from a second query', () => {
  // REVERSED ON 23 OCTOBER, and the reversal is the point. This used to require
  // the opposite - that connectSleep ignore what requestPermission returned and
  // re-query getGrantedPermissions - on the principle that the record decides
  // rather than the call that was meant to change it.
  //
  // That principle is right for OUR writes and wrong for this one.
  // requestPermission does not claim anything: it RETURNS the granted set, and
  // re-querying immediately afterwards reads a cache Android has not finished
  // committing. Ruth granted sleep, Health Connect recorded it - "Sleep, 1 of 1
  // selected", Selodia under Allowed access - and the app told her she had
  // refused it, then offered to take her to Settings to fix something already
  // fixed. Her screenshots are what proved it.
  // THE WINDOW IS THE FUNCTION, NOT A GUESSED NUMBER OF CHARACTERS. The first
  // version of this took 1800 characters, and the line it was looking for
  // started at 1784 - so the check failed on correct code, and the failure
  // message blamed the app. A fixed-length slice is a check that breaks when a
  // comment above the code grows.
  const at = SYNC.indexOf('export async function connectSleep');
  const next = SYNC.indexOf('\nexport ', at + 1);
  const block = SYNC.slice(at, next === -1 ? SYNC.length : next);
  assert.match(
    block,
    /const granted = await hc\.requestPermission\(/,
    'the request result is being discarded again, which is what made a granted '
      + 'permission read as a refusal'
  );
  assert.match(
    block,
    /!inAnswer && !\(await hasSleepPermission\(\)\)/,
    'it gives up on one answer. A grant can also arrive a moment AFTER the dialog '
      + 'closes, so only when both the request and a re-read say no is it a no.'
  );
});
// -- every case above must be able to fail ---------------------------------

const useless = [];
function mustFail(name, fn) {
  try {
    fn();
    useless.push(name);
  } catch {
    /* threw, which is the point */
  }
}

mustFail('stages decide duration', () =>
  assert.equal(
    nightFromSession({
      startTime: '2026-10-22T22:00:00.000Z',
      endTime: '2026-10-23T06:00:00.000Z',
      stages: [{ startTime: '2026-10-22T22:30:00.000Z', endTime: '2026-10-23T02:00:00.000Z', stage: DEEP }],
    }).minutes,
    480
  )
);
mustFail('edge awakenings ignored', () =>
  assert.equal(
    nightFromSession({
      startTime: '2026-10-22T22:00:00.000Z',
      endTime: '2026-10-23T06:00:00.000Z',
      stages: [
        { startTime: '2026-10-22T22:00:00.000Z', endTime: '2026-10-22T22:20:00.000Z', stage: AWAKE },
        { startTime: '2026-10-22T22:20:00.000Z', endTime: '2026-10-23T06:00:00.000Z', stage: DEEP },
      ],
    }).awakenings,
    1
  )
);
mustFail('night keyed on the evening', () => assert.equal(nightOfFor('2026-10-21T00:20:00'), '2026-10-21'));
mustFail('privacy copy checked', () => assert.match(PRIVACY, /asks for steps alone/i));
mustFail('hers is protected', () => assert.doesNotMatch(SYNC, /row\.source !== SLEEP_SOURCE/));

// The "Nothing new" bug, as it was actually written: the card calling the bare
// count. Each of these must throw, or the check above could never have caught it.
mustFail('the bare count accepted', () =>
  assert.ok(
    !/await syncSleepFromPhone\(\)/.test('const written = await syncSleepFromPhone();'),
    'the card back on the count'
  )
);
mustFail('an empty phone told nothing is new', () =>
  assert.doesNotMatch("case 'nothing-on-phone':\n return { body: 'Nothing new.' };", /Nothing new/)
);
mustFail('a dead end with no way out', () =>
  assert.match("case 'nothing-on-phone':\n return { body: 'Nothing new.' };", /action:\s*\{/)
);
mustFail('the switch named only as "your settings"', () =>
  assert.match('it needs to be set to share sleep with Health Connect', /Settings, then Health Connect, then turn on Sleep/)
);
mustFail('blaming the sharing without re-reading the permission', () => {
  const body = 'async function checkForNights() { const onPhone = await readNightsFromPhone(EVER_DAYS); }';
  const perm = body.indexOf('hasSleepPermission');
  const read = body.indexOf('readNightsFromPhone');
  assert.ok(perm > 0 && read > perm);
});
mustFail('a week taken as evidence that nothing shares', () =>
  assert.match('const EVER_DAYS = 7;', /const EVER_DAYS = 30;/)
);

for (const f of failures) console.log(`  FAIL  ${f}`);
for (const u of useless) console.log(`  USELESS  "${u}" passed with its premise inverted`);

const total = pass + failures.length;
console.log(`${pass}/${total} passed, ${failures.length} failed, ${useless.length} useless`);
process.exit(failures.length + useless.length > 0 ? 1 : 0);
