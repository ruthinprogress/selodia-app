// What does a sentence about sleep actually say? Pure, no API, free to run.
//
//   npx tsx scripts/probe-sleep.mjs

import { parseSleep, sleepSaveSummary } from '../app/lib/sleep-logging.ts';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   (got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)})`}`);
};

// A Saturday morning.
const NOW = new Date('2026-09-19T08:30:00Z');
const p = (text) => parseSleep(text, NOW);

console.log('\n  HOW LONG\n');
check('plain hours', p('I slept 7 hours')?.durationMin, 420);
check('and a half', p('got 6 and a half hours')?.durationMin, 390);
check('decimal', p('7.5 hours last night')?.durationMin, 450);
check('worded', p('about eight hours')?.durationMin, 480);
check('minutes', p('only 90 minutes, awful')?.durationMin, 90);
check('a window, crossing midnight', p('bed at 11, woke at 6')?.durationMin, 420);
check('half past, with till', p('half eleven till half six')?.durationMin, 420);
check('the window is kept', p('11pm to 6am')?.wentToBed, '23:00');

console.log('\n  HOW IT WENT\n');
check('badly', p('slept badly')?.quality, 'poor');
check('broken', p('kept waking all night')?.quality, 'broken');
check('well', p('slept like a log')?.quality, 'good');
check('fine', p('slept ok')?.quality, 'ok');
check('woke twice implies broken', p('woke twice')?.quality, 'broken');
check('and counts them', p('woke 3 times')?.awakenings, 3);

console.log('\n  WHICH NIGHT\n');
check('last night is the night just gone', p('slept badly')?.nightOf, '2026-09-18');
check('a named day goes back to it', p('slept badly on Wednesday')?.nightOf, '2026-09-16');
check('the night before last', p('the night before last was rough')?.nightOf, '2026-09-17');

console.log('\n  NOT A SLEEP MESSAGE\n');
check('no sleep content at all', p('I had porridge'), null);
check('empty', p(''), null);

console.log('\n  WHAT IT SAYS BACK\n');
check('hours and a word', sleepSaveSummary(p('7 hours, slept badly')), 'Sleep · 7h · a rough night');
check('just the feeling', sleepSaveSummary(p('slept badly')), 'Sleep · a rough night');

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
