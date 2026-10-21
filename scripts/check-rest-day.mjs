// A REST DAY IS OFFERED, NEVER ASSUMED.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-rest-day.mjs
//
// Ruth, 21 October 2026: "If there's nothing that day, do we still have the
// section and actually register it as a rest day until an activity gets
// logged. This might solve the problem that Rest has no way of getting logged
// atm." Then, on the design: "tap to choose, never automatic - definitely."
//
// THE AUTOMATIC VERSION IS THE ONE THAT HAD TO BE REFUSED, and this is what
// guards it. A day with nothing planned is not a rest day; it is a day with
// nothing planned. An app that writes one on her behalf has invented a record
// she did not make - the single thing this app never does - and it would then
// have to delete its own row the moment she logged something real.
//
// AND IT HAS TO COUNT, or the tap is theatre. "rest day" is in the weighting
// table at 100% recovery, and a row written from the phone carried no cover_*
// columns at all until 21 October - so this would have logged something the
// Health Flower could not see, which is the whole reason for logging it.

import assert from 'node:assert';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { coverageColumns } = await import(here('mobile/src/lib/coverage-columns.ts'));
// NOT IMPORTED FROM log-rest-day.ts, which reaches the database and therefore
// pulls react-native in through the supabase client - the same wall that made
// week-reminder-time, calendar-time and me-archive-sort their own files. One
// constant is not worth a fourth split, so it is read out of the source and
// then used for real against coverageColumns, which has no such dependency.
const restSource = fs.readFileSync('mobile/src/lib/log-rest-day.ts', 'utf8');
const restMatch = restSource.match(/export const REST_DAY = '([^']+)'/);
if (!restMatch) throw new Error('REST_DAY is gone from log-rest-day.ts');
const REST_DAY = restMatch[1];

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

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const codeOnly = (src) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const logRest = read('mobile/src/lib/log-rest-day.ts');
const card = read('mobile/src/components/today-focus.tsx');
const panel = read('mobile/src/components/overview-panel.tsx');

console.log('\n  A REST DAY, OFFERED\n');

check('IT IS A TAP, AND NOTHING WRITES ONE ON HER BEHALF', () => {
  // The whole of her instruction, and the only version that holds up.
  const cardCode = codeOnly(card);
  assert.ok(/onPress=\{\(\) => void rest\(\)\}/.test(cardCode), 'the rest day is no longer tapped');
  // NOTHING IN AN EFFECT. An automatic write would arrive as a useEffect on
  // this card or on the panel that draws it, which is exactly the shape to
  // refuse.
  assert.ok(
    !/useEffect[\s\S]{0,400}logRestDay/.test(cardCode),
    'something logs a rest day without being asked'
  );
  assert.ok(
    !/logRestDay/.test(codeOnly(panel)),
    'the panel logs rest days itself, outside the one place that guards it'
  );
  return 'tapped, never assumed';
});

check('AND IT COUNTS TOWARDS THE FLOWER', () => {
  // A tap that logs something the drawing cannot see is theatre. Rest is in
  // the weighting table at 100% recovery, and a phone-written row carried no
  // coverage at all until 21 October.
  // FIFTEEN, NOT A HUNDRED, FROM 21 OCTOBER 2026. The app earns recovery three
  // ways and they have to agree. recovery.ts scores a night's sleep at up to 28
  // and an INFERRED rest day at 15, reasoned out loud: "resting is good,
  // sleeping is better, and three rest days in a row should not out-score a
  // week of proper nights." The weighting table said 100, reconciled with
  // nothing - so a tapped rest day was worth nearly seven of the same rest day
  // inferred, and two of them filled the petal on their own.
  //
  // CHECKED AGAINST recovery.ts RATHER THAN AGAINST 15, so the two cannot drift
  // apart again by somebody changing one of them.
  const recovery = read('mobile/src/lib/recovery.ts');
  const inferred = Number(recovery.match(/REST_DAY_POINTS = (\d+)/)?.[1]);
  assert.ok(Number.isFinite(inferred), 'REST_DAY_POINTS is gone from recovery.ts');
  const cover = coverageColumns(REST_DAY);
  assert.strictEqual(
    cover.cover_recovery,
    inferred,
    `a tapped rest day is worth ${cover.cover_recovery} and an inferred one ${inferred}`
  );
  for (const col of ['cover_strength', 'cover_cardio', 'cover_flexibility', 'cover_balance', 'cover_bone']) {
    assert.strictEqual(cover[col], 0, `${col} is not zero on a rest day`);
  }
  // ALL SIX OR NONE. health-flower.ts counts what it finds and reads the rest
  // as zero, so a half-filled row understates every dimension it misses.
  assert.strictEqual(Object.keys(cover).length, 6, 'a rest day writes some columns and not others');
  assert.ok(/coverageColumns\(REST_DAY\)/.test(logRest), 'the insert no longer carries its coverage');
  return 'recovery 100, and all six written';
});

check('ONE A DAY, GUARDED AT THE WRITE', () => {
  // The card hides the offer once something is logged, and that is a courtesy:
  // two taps in a row, a stale screen, a second device. This project's rule is
  // that a guard belongs where the row is created.
  assert.ok(/'already'/.test(logRest), 'a second rest day on one day is not refused');
  // ANY ACTIVITY BLOCKS IT, not just another rest day: a day she went to
  // ballet is not a rest day, and a row saying it was would quietly add a
  // hundred points of recovery to her week.
  const guard = logRest.slice(logRest.indexOf("from('activity_logs')"));
  assert.ok(
    !/activity_type/.test(guard.slice(0, guard.indexOf('.limit('))),
    'the guard only looks for other rest days, so a ballet day can also be a rest day'
  );
  // A READ THAT FAILED IS NOT AN EMPTY DAY.
  assert.ok(/readError\) return 'failed'/.test(logRest), 'a failed read is treated as a clear day');
  return 'any activity blocks it, and a failed read refuses';
});

check('AND THE CARD GOES QUIET WHEN THERE IS NOTHING TO SAY', () => {
  // Nothing planned and a session already logged needs nothing from this card.
  // An empty terracotta block is worse than no block.
  assert.ok(
    /if \(!planned && anythingLogged\) return null;/.test(codeOnly(card)),
    'the card is drawn on a day it has nothing to offer'
  );
  // ONE NOTHING. This used to say different things depending on whether she
  // had chosen "Guide me"; the two modes went on 21 October, everybody has a
  // Week, and there is one true sentence.
  assert.ok(/Nothing planned today/.test(card), 'the empty day lost its wording');
  assert.ok(!/guided/.test(card), 'the card asks which mode she is in again');
  return 'silent when it should be, and one true nothing';
});

check('A TAP THAT FAILED SAYS SO', () => {
  // The fault this app has fixed in four other places: a control that did
  // nothing and said nothing.
  assert.ok(/That did not save/.test(card), 'a failed rest day is silent');
  assert.ok(/themeColor="danger"/.test(card), 'the failure is not marked as one');
  return 'said out loud';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
