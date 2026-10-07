// EVERY KIND THE APP WRITES HAS A TAB AND A LABEL OF ITS OWN.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-almanac-kinds.mjs
//
// THE FALL-THROUGH IS A SAFETY NET AND IT HAD BECOME A CLASSIFIER. insights.ts
// ends `return 'insight'`, and the comment beside it is honest about why:
// "Anything that is neither a plan nor one of the named types falls to Insight
// and is never dropped: an entry saved before the types existed still has
// somewhere to live."
//
// That is right for a row written by a version of the app that no longer exists.
// It is wrong for a kind THIS version writes on purpose, because then the net is
// doing the sorting and nothing ever reports it. Ruth, 7 October 2026: "Archived
// goals are showing in the Almanac's Insights tab, tagged Insights. They're Goal
// History, not insights."
//
// THREE KINDS WERE IN THE NET, and she only saw one of them.
//
//   goal                   - four rows since 2 October, tagged "Insight".
//   body_manual_snapshot   - written by a trigger the moment somebody finishes
//                            setup. Nobody has one yet, so nobody has seen it.
//                            The fresh account she is about to walk for
//                            onboarding sign-off would have been the first.
//   care                   - a parsed letter. tabFor read `kind === 'me'`, so
//                            every care record would have gone to the INSIGHTS
//                            tab and the How I Access Care group shipped that
//                            same morning would have stayed empty.
//
// SO THE LISTS ARE READ FROM WHERE THEY ARE WRITTEN, not maintained here. The
// save types come from the server module; the trigger kinds come from the
// migrations that create the triggers. A hand-kept list in this file would be
// the sixth copy of the fault it exists to catch.

import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const SAVE = await import(root + '/app/lib/pending-save.ts');
const { tabFor, insightTypeFor, INSIGHT_TYPES, INSIGHT_TYPE_LABEL, INSIGHT_PILL_LABEL } =
  await import(root + '/mobile/src/lib/insights.ts');

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

/** The kinds inserted into almanac_entries by a database trigger. */
function triggerKinds() {
  const dir = 'supabase/migrations';
  const found = new Set();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.sql')) continue;
    const sql = readFileSync(`${dir}/${f}`, 'utf8');
    if (!/insert\s+into\s+almanac_entries/i.test(sql)) continue;
    // The kind is the second column of the values list: (user_id, kind, ...).
    for (const m of sql.matchAll(/insert\s+into\s+almanac_entries[\s\S]{0,400}?values\s*\(\s*[^,]+,\s*'([a-z_]+)'/gi)) {
      found.add(m[1]);
    }
  }
  return [...found];
}

console.log('\n  NOTHING SORTED BY THE SAFETY NET\n');

check('the migrations really do write kinds of their own', () => {
  const kinds = triggerKinds();
  assert.ok(kinds.length > 0, 'no trigger-written kinds found, so this check is reading nothing');
  assert.ok(kinds.includes('goal'), 'the goal trigger is no longer found by this scan');
  return kinds.join(', ');
});

check('every kind the app writes is classified explicitly', () => {
  // A kind that reaches the fall-through is a kind nobody chose a home for.
  const written = [...new Set([...triggerKinds(), ...SAVE.SAVE_TYPES, 'roundup'])];
  const stranded = written.filter((kind) => {
    // Types that never become an almanac row at all are not this check's
    // business: a rule goes to user_rules, a week entry to user_week, a skill to
    // user_skills, a marker to health_context.
    if (['rule', 'week', 'skill', 'marker'].includes(kind)) return false;
    const tab = tabFor({ kind, content: null });
    if (tab === 'me') return false;
    return insightTypeFor({ kind }) === 'insight' && kind !== 'insight';
  });
  assert.deepStrictEqual(
    stranded,
    [],
    `${stranded.join(', ')} land in Insights tagged "Insight" by the fall-through, which means ` +
      'nobody decided where they go - the net sorted them'
  );
  return `${written.length} kinds, none in the net`;
});

check('a care record goes to the Me tab, not to Insights', () => {
  // THE ONE I SHIPPED THIS MORNING. CARD_TYPES is the server's list of kinds
  // that are a card with a section, and both of them have to reach the tab that
  // renders sections.
  for (const kind of SAVE.CARD_TYPES) {
    assert.strictEqual(
      tabFor({ kind, content: null }),
      'me',
      `a ${kind} card lands in the ${tabFor({ kind, content: null })} tab, where nothing groups by section`
    );
  }
  return SAVE.CARD_TYPES.join(' and ') + ' both reach the Me tab';
});

check('an archived goal is Goal history, in her words', () => {
  assert.strictEqual(insightTypeFor({ kind: 'goal' }), 'goal');
  assert.strictEqual(INSIGHT_TYPE_LABEL.goal, 'Goal history');
  assert.strictEqual(INSIGHT_PILL_LABEL.goal, 'Goal history');
  // AND NOT MERGED BACK IN. Her instruction was explicit about that.
  assert.notStrictEqual(insightTypeFor({ kind: 'goal' }), 'insight');
  return 'tag and pill both say Goal history';
});

check('every type has both labels, so no tag can render undefined', () => {
  for (const t of INSIGHT_TYPES) {
    assert.ok(INSIGHT_TYPE_LABEL[t], `${t} has no card tag`);
    assert.ok(INSIGHT_PILL_LABEL[t], `${t} has no pill`);
  }
  assert.strictEqual(
    Object.keys(INSIGHT_TYPE_LABEL).length,
    INSIGHT_TYPES.length,
    'a label exists for a type that is not in the list, so its pill can never appear'
  );
  return `${INSIGHT_TYPES.length} types, both labels each`;
});

check('an unknown kind still falls to Insight rather than vanishing', () => {
  // THE NET STILL EXISTS AND STILL MATTERS. Removing it would drop rows written
  // by versions of the app nobody is running any more.
  assert.strictEqual(insightTypeFor({ kind: 'something_from_august' }), 'insight');
  assert.strictEqual(tabFor({ kind: 'something_from_august', content: null }), 'insights');
  return 'an old row still has somewhere to live';
});

check('and this check can fail', () => {
  // The fixture is the shipped behaviour: before today, 'goal' hit the net.
  const asShipped = (k) => (['roundup', 'symptom', 'note'].includes(k) ? k : 'insight');
  assert.strictEqual(asShipped('goal'), 'insight', 'the fixture is not the old behaviour');
  assert.notStrictEqual(
    insightTypeFor({ kind: 'goal' }),
    asShipped('goal'),
    'the fix is indistinguishable from the bug'
  );
  return 'the version she reported is detected';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
