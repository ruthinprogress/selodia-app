// A PLAN IN A REPORT READS AS A PLAN, NOT A PARAGRAPH.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-a-plan-reads-as-a-plan.mjs
//
// Ruth, 15 October 2026, having built an exercise plan in chat to support her
// knee and taken a report of it to be signed off by her specialist: "the
// layout and formatting on the Report for the exercise plan needs fixing,
// unreadable."
//
// WHAT SHE WAS LOOKING AT. Five movements with their sets and reps, printed as
// one run-on sentence with bullet characters sitting inside it:
//
//   "...starting light * Lying dumbbell hamstring curl - 3 sets, 8-12 reps *
//    Single-leg glute bridge (bodyweight) - 3 sets, 10 per side reps * ..."
//
// THE STRUCTURE WAS ALREADY THERE. readableContent builds a line per movement
// and marks each one. panel() then wrapped the whole string in a single <p>,
// and HTML collapses every newline into a space. The same failure as the chat
// wall that morning, at the other end of the app: something laid out carefully
// and then flattened by the last function to touch it.
//
// IT MATTERS MORE HERE THAN IN CHAT. A reply she cannot skim is irritating. A
// report is the thing she hands to a consultant to sign off, and a consultant
// reading one paragraph of five exercises is a consultant who does not read it.
//
// Every value below is invented.

import assert from 'node:assert';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { readableContent } = await import(root + '/app/lib/report.ts');
const { renderReport } = await import(root + '/app/lib/report-render.ts');

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

/** A plan shaped like the one she built, with invented movements. */
const PLAN = {
  summary: 'Build leg strength around the back of the legs, glutes and hips, using home dumbbells, twice a week, starting light.',
  exercises: [
    { name: 'Lying dumbbell hamstring curl', sets: 3, reps: '8-12' },
    { name: 'Single-leg glute bridge (bodyweight)', sets: 3, reps: '10 per side' },
    { name: 'Side-lying leg lift', sets: 3, reps: '12-15 per side' },
    { name: 'Clamshell', sets: 3, reps: 15 },
    { name: 'Slow standing calf raise holding a dumbbell', sets: 3, reps: '12-15, 3 seconds down' },
  ],
};

console.log('\n  A PLAN READS AS A PLAN\n');

check('the content keeps one line per movement', () => {
  const text = readableContent(PLAN);
  const lines = text.split('\n').filter((l) => l.trim().startsWith('•'));
  assert.strictEqual(lines.length, 5, `got ${lines.length} movement lines, not five`);
  return 'five movements, five lines';
});

check('"reps" is not added to something that already says it', () => {
  // "10 per side reps" and "12-15, 3 seconds down reps" both reached her.
  const text = readableContent(PLAN);
  assert.ok(!/per side reps/.test(text), '"10 per side reps" is still produced');
  assert.ok(!/seconds down reps/.test(text), '"3 seconds down reps" is still produced');
  return 'a phrase is printed as written';
});

check('and a bare count still gets the word', () => {
  // The opposite mistake: dropping it everywhere and leaving "3 sets, 15".
  const text = readableContent(PLAN);
  assert.ok(/8-12 reps/.test(text), 'a plain range lost the word "reps"');
  assert.ok(/15 reps/.test(text), 'a plain number lost the word "reps"');
  return '8-12 reps and 15 reps';
});

console.log('\n  AND THE REPORT DRAWS IT THAT WAY\n');

/** Everything a report needs and this check is not about. */
const EMPTY = {
  // The fields the renderer reads directly rather than through a guard.
  profile: [],
  periodLabel: 'Last 3 months',
  reportId: 'TESTTEST',
  summary: '',
  glance: [],
  goals: [],
  weights: [],
  metrics: [],
  symptoms: [],
  food: [],
  foodGrain: 'weekly',
  foodEntries: [],
  water: [],
  sleep: [],
  activity: [],
  activityPeriods: [],
  activityKinds: [],
  activityGrain: 'weekly',
  insights: [],
  cards: [],
  attachments: [],
};

/** The smallest report that contains the plan. */
function reportHtml() {
  return renderReport({
    name: 'Someone',
    reference: 'TESTTEST',
    generated: '2026-10-15T12:00:00.000Z',
    plans: [{ title: 'Knee Support Leg Strength (Dumbbells)', content: readableContent(PLAN) }],
    ...EMPTY,
  });
}

check('THE MOVEMENTS ARE LIST ITEMS, NOT ONE PARAGRAPH', () => {
  // The whole bug, in one assertion.
  const html = reportHtml();
  const items = html.match(/<li>/g) ?? [];
  assert.ok(items.length >= 5, `the plan drew ${items.length} list items, not five`);
  return `${items.length} list items`;
});

check('and the bullet characters are gone from the text', () => {
  // They were the marker; drawn as a list they are the list's job, and a
  // literal one left in the sentence is what made it look broken.
  const html = reportHtml();
  const body = html.slice(html.indexOf('Knee Support Leg Strength'));
  const panelEnd = body.indexOf('</div>', body.indexOf('<ul>'));
  assert.ok(!body.slice(0, panelEnd).includes('•'), 'a literal bullet character survives in the panel');
  return 'the list draws its own markers';
});

check('the summary stays a paragraph above the movements', () => {
  const html = reportHtml();
  const at = html.indexOf('Build leg strength');
  const list = html.indexOf('<ul>', at);
  assert.ok(at > 0, 'the summary is missing');
  assert.ok(list > at, 'the movements are drawn above the summary');
  assert.ok(html.slice(at - 60, at).includes('<p>'), 'the summary is not a paragraph');
  return 'prose above, list below, in that order';
});

check('a plan with no movements still renders', () => {
  const html = renderReport({
    name: 'Someone',
    reference: 'TESTTEST',
    generated: '2026-10-15T12:00:00.000Z',
    plans: [{ title: 'Walking', content: 'Twenty minutes most days, after lunch.' }],
    ...EMPTY,
  });
  assert.ok(html.includes('Twenty minutes most days'), 'plain content was dropped');
  assert.ok(html.includes('<p>Twenty minutes most days, after lunch.</p>'), 'plain content is not a paragraph');
  return 'prose-only plans are untouched';
});

check('and this check can fail', () => {
  // THE OLD RENDERER: the whole body in one <p>. It contains every word, so
  // any check that looks for the text passes against it - which is why the
  // assertions above are about <li> and not about content.
  const old = `<p>${readableContent(PLAN).replace(/\n/g, ' ')}</p>`;
  assert.ok(old.includes('Lying dumbbell hamstring curl'), 'the old shape lost the words');
  assert.ok(!old.includes('<li>'), 'the old shape already had list items');
  assert.ok((reportHtml().match(/<li>/g) ?? []).length > 0, 'the new shape has none either');
  return 'the words were never the problem; the shape was';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
