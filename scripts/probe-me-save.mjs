// What may become a card in somebody's personal protocol?
//
// Me is the reference somebody returns to when they have drifted, so the bar for
// writing into it is higher than for a note: a name with no reason is a
// checklist item, and the brief is explicit that Me is not a checklist. Pure
// functions, no API, free to run.
//
//   npx tsx scripts/probe-me-save.mjs

import { coerceProposal } from '../app/lib/pending-save.ts';
import { coerceStatus, normaliseSection, readMeCard } from '../app/lib/me-card.ts';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else fail++;
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   (got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)})`}`
  );
};

const me = (content, title = 'Vitamin D3') => coerceProposal({ type: 'me', title, content });

console.log('\n  A REAL DECISION MOMENT\n');
const vitaminD = me({
  section: 'Supplements',
  why: 'Decided after talking about winter mood dips. 1000iu daily through the darker months.',
  status: 'Taking',
});
check('it is accepted', vitaminD?.type, 'me');
check('the section is kept', vitaminD?.content.section, 'Supplements');
check('the status is kept', vitaminD?.content.status, 'Taking');

console.log('\n  WHAT IS REFUSED, AND WHY IT MATTERS\n');
// The whole value of the card is the reason. Without one there was no decision
// moment, only a mention.
check('no why at all', me({ section: 'Supplements', status: 'Taking' }), null);
check('an empty why', me({ section: 'Supplements', why: '   ' }), null);
// A SECTION IS NOT REQUIRED, AND THIS CHECK WAS STALE FROM THE DAY IT STOPPED
// BEING. The requirement was removed on 30 September - see the long note in
// coerceProposal - because when the model returns `content` as prose it has no
// section, and that is what lost her skincare card. The probe kept asserting the
// old rule and has been failing ever since, which is its own small lesson: a red
// line nobody acts on is indistinguishable from no test.
check('no section is fine - the Almanac has never needed one', me({ why: 'Because it helps.' })?.type, 'me');
check('and the section comes through as null rather than invented', me({ why: 'Because it helps.' })?.content.section, null);

// A LIST CARRIES ITS REASON IN ITS ITEMS (1 October 2026). The why stays
// required for a card that is one decision; a medication list is four decisions
// with their own timings, and demanding one sentence explaining all four asks
// for a line nobody would write and only a model could invent. The live probe
// found this: a perfectly formed Medications card was refused, her yes answered
// nothing, and the app told her "that did not save".
const meds = coerceProposal({
  type: 'me',
  title: 'Medications',
  content: {
    section: 'Medication',
    items: [
      { name: 'Levothyroxine', when: '75mcg, each morning' },
      { name: 'Vitamin D', when: '1000iu, through the winter' },
    ],
  },
});
check('a card of items needs no card-level why', meds?.type, 'me');
check('and its items survive', meds?.content.items?.length, 2);
check('but a single decision with no why is still refused', me({ section: 'Supplements', status: 'Taking' }), null);

console.log('\n  STATUS IS A CLOSED LIST\n');
// One of the few in this app. An invented seventh would be the model deciding
// how she relates to her own decision.
check('Taking', coerceStatus('Taking'), 'Taking');
check('case does not matter', coerceStatus('as needed'), 'As needed');
check('Paused is kept, because a paused item stays visible', coerceStatus('Paused'), 'Paused');
check('an invented status', coerceStatus('Considering'), null);
check('a tick', coerceStatus('Taking ✓'), null);
// A status is optional: a weekly call has none, and that must not block the save.
const call = me({ section: 'Relationships', why: 'Standing Sunday call with Fee.' }, 'Weekly call with Fee');
check('a card with no status still saves', call?.content.status, null);

console.log('\n  SECTIONS ARE OPEN, BUT NOT DUPLICATED\n');
check('a known section, however it was typed', normaliseSection('skincare'), 'Skincare');
check('a new section emerges', normaliseSection('physiotherapy'), 'Physiotherapy');
check('whitespace collapses', normaliseSection('  Wellbeing  '), 'Wellbeing');
check('nothing at all', normaliseSection(''), null);

console.log('\n  READING ONE BACK\n');
check(
  'a stored card',
  readMeCard({ section: 'Supplements', why: 'Winter mood.', status: 'Taking', detail: '1000iu' }),
  { why: 'Winter mood.', status: 'Taking', detail: '1000iu' }
);
// Saved through the older shape, before `why` had a name.
check('an older card using summary', readMeCard({ summary: 'Winter mood.' })?.why, 'Winter mood.');
check('not a card at all', readMeCard({ condition: 'x', expectation: 'y' }), null);

console.log('\n  THE OTHER TYPES STILL BEHAVE\n');
check(
  'an insight still needs both halves',
  coerceProposal({ type: 'insight', title: 'x', content: { condition: 'a' } }),
  null
);
check(
  'a symptom still needs its words',
  coerceProposal({ type: 'symptom', title: 'x', content: { summary: 'sore knee' } })?.type,
  'symptom'
);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
