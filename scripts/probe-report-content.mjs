// Almanac content is JSONB. Does the report turn it into something readable?
//
//   npx tsx scripts/probe-report-content.mjs

import { readableContent } from '../app/lib/report.ts';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   (got ${JSON.stringify(got)})`}`);
};

console.log('\n  THE SHAPES THE ALMANAC ACTUALLY STORES\n');
check('a symptom', readableContent({ summary: 'Right knee sore after running' }), 'Right knee sore after running');
check('a Me card', readableContent({ why: 'Keeping skin even', detail: 'Retinol at night' }), 'Keeping skin even\n\nRetinol at night');
check(
  'a plan',
  readableContent({ goal: 'inner thigh strength', exercises: [{ name: 'Sumo Squat', sets: 3, reps: '12-15' }, { name: 'Cossack Squat' }] }),
  'inner thigh strength\n\n• Sumo Squat - 3 sets, 12-15 reps\n• Cossack Squat'
);
check('plain text', readableContent('Just a line'), 'Just a line');

console.log('\n  WHAT MUST NEVER HAPPEN\n');
check('an unknown shape is listed, not dropped', readableContent({ dose: '1000 iu', taken: 'mornings' }), 'dose: 1000 iu\n\ntaken: mornings');
check('internal keys stay out', readableContent({ __theme: 'x', summary: 'Kept' }), 'Kept');
check('null', readableContent(null), '');
check('a number', readableContent(42), '');

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
