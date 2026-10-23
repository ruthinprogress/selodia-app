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
    /never how a night felt/i,
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

check('the grant is read back, not assumed from the request', () => {
  const at = SYNC.indexOf('export async function connectSleep');
  const block = SYNC.slice(at, at + 1400);
  assert.match(
    block,
    /await hasSleepPermission\(\)/,
    'it trusts what requestPermission returned instead of reading the grant back'
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

for (const f of failures) console.log(`  FAIL  ${f}`);
for (const u of useless) console.log(`  USELESS  "${u}" passed with its premise inverted`);

const total = pass + failures.length;
console.log(`${pass}/${total} passed, ${failures.length} failed, ${useless.length} useless`);
process.exit(failures.length + useless.length > 0 ? 1 : 0);
