// A CONDITION SHE IS MANAGING CAN BE KEPT, AND KEEPING IT DOES TWO THINGS.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-condition-capture.mjs
//
// THE GAP. health_context has carried four condition columns for weeks, and each
// one has a food rule written against it: PCOS prioritises lower-GI carbohydrates
// and warns that cutting total carbs is usually not the lever; IBS flags
// high-FODMAP foods rather than recommending them as protein sources.
//
// Not one of those rules has ever fired for anybody. The columns were written by
// exactly one onboarding screen, and that screen became unreachable on 6 October
// when the first draft was removed. So the lens existed, the rules existed, and
// nothing could ever get into it.
//
// Ruth, 7 October 2026, asking whether chat says "taking into account your IBS
// it's best to avoid high FODMAP foods": it does say that, when there is an IBS
// to take into account. There never has been.
//
// ONE YES, TWO WRITES. Her decision on whether a condition card should quietly
// change her food advice: "YES, but offered, same as the markers, because a
// wrong one changes what you're told to eat." So the save writes the
// health_context column AND the card, and the offer says both out loud.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const SAVE = await import(root + '/app/lib/pending-save.ts');
const HC = await import(root + '/app/lib/health-context.ts');
const CLIENT = await import(root + '/mobile/src/lib/insights.ts');

const save = readFileSync('app/lib/pending-save.ts', 'utf8');
const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8');

const EMPTY = {
  ldl_status: null, hdl_status: null, cholesterol_status: null, glucose_status: null,
  ferritin_status: null, thyroid_status: null, condition_pcos: false, condition_ibs: false,
  condition_hypothyroid: false, condition_t2d: false, conditions_other: null,
};

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

console.log('\n  SOMETHING SHE IS MANAGING\n');

check('every column the rules read can be written', () => {
  // TWO LISTS OF THE SAME THING. The columns the save can set and the columns
  // the food rules key off have to be the same four, or a condition is either
  // unkeepable or kept somewhere nothing reads.
  const writable = Object.values(SAVE.CONDITION_COLUMNS).sort();
  const readable = ['condition_hypothyroid', 'condition_ibs', 'condition_pcos', 'condition_t2d'];
  assert.deepStrictEqual(writable, readable, 'the writable columns and the rule columns have drifted');
  for (const key of Object.keys(SAVE.CONDITION_COLUMNS)) {
    const prompt = HC.buildHealthContextPrompt({ ...EMPTY, [SAVE.CONDITION_COLUMNS[key]]: true });
    assert.ok(prompt.length > 0, `${key} produces no health context block at all`);
  }
  return Object.keys(SAVE.CONDITION_COLUMNS).join(', ');
});

check('the two with food rules still carry them', () => {
  // THE CARD IS WORTH LITTLE WITHOUT THE RULE IT TURNS ON. If a rule is ever
  // dropped, this save becomes a card that claims to change the advice and does
  // not.
  assert.ok(/FODMAP/.test(HC.buildHealthContextPrompt({ ...EMPTY, condition_ibs: true })), 'IBS lost its rule');
  assert.ok(/lower-GI/.test(HC.buildHealthContextPrompt({ ...EMPTY, condition_pcos: true })), 'PCOS lost its rule');
  return 'IBS and PCOS';
});

check('a condition with no column is still kept, with no invented rule', () => {
  // Pelvic congestion, endometriosis, a knee. health-context.ts states the rule
  // for these in its own header: surfaced as context only, never as an invented
  // dietary rule.
  const other = HC.buildHealthContextPrompt({ ...EMPTY, conditions_other: 'pelvic congestion' });
  assert.ok(/pelvic congestion/.test(other), 'a condition with no column is not surfaced at all');
  assert.ok(
    !/Apply these protective adjustments/.test(other),
    'a condition with no spec rule is generating food adjustments anyway'
  );
  const branch = save.slice(save.indexOf("if (proposal.type === 'condition')"), save.indexOf("if (proposal.type === 'skill')"));
  assert.ok(/conditions_other/.test(branch), 'an unrecognised condition is dropped rather than kept as text');
  return 'kept as context, no rule invented';
});

check('one yes writes the lens AND the card', () => {
  const branch = save.slice(save.indexOf("if (proposal.type === 'condition')"), save.indexOf("if (proposal.type === 'skill')"));
  assert.ok(/from\('health_context'\)/.test(branch), 'the condition never reaches health_context');
  assert.ok(/onConflict: 'user_id'/.test(branch), 'the upsert has no conflict target, so it would duplicate');
  // THE FALL-THROUGH IS THE POINT and is easy to break with a stray return.
  assert.ok(
    !/return \{ kind: 'condition'/.test(branch),
    'the branch returns early, so no card is ever written and she sees nothing'
  );
  assert.ok(SAVE.CARD_TYPES.includes('condition'), 'a condition is not a card type, so it gets no section');
  return 'health_context, then the card';
});

check('a failed lens write produces no card', () => {
  // She must never be looking at a record of a thing the advice has never heard
  // of.
  const branch = save.slice(save.indexOf("if (proposal.type === 'condition')"), save.indexOf("if (proposal.type === 'skill')"));
  const at = branch.indexOf('if (error)');
  assert.ok(at > 0, 'the health_context write is not error-checked');
  assert.ok(/return null/.test(branch.slice(at, at + 220)), 'a failed write still falls through to the card');
  return 'both or neither';
});

check('the status is what she is doing, and is never invented', () => {
  assert.deepStrictEqual(
    SAVE.CONDITION_STATUSES,
    ['Active', 'Paused', 'Getting seen about it'],
    'the statuses are no longer hers'
  );
  const branch = save.slice(save.indexOf("if (proposal.type === 'condition')"), save.indexOf("if (proposal.type === 'skill')"));
  assert.ok(
    /CONDITION_STATUSES.includes\(status\) \? status : 'Active'/.test(branch),
    'a status the model made up would be stored as a state she never chose'
  );
  // AND IT MUST NOT REACH THE FOOD RULE. A condition on Paused is still a
  // condition; what paused is her engagement with it.
  const hcSrc = readFileSync('app/lib/health-context.ts', 'utf8');
  assert.ok(!/Paused|Getting seen/.test(hcSrc), 'the food lens is reading her care status, which is not what it means');
  return SAVE.CONDITION_STATUSES.join(' / ');
});

check('it is filed under her name for it, on the tab that renders sections', () => {
  assert.strictEqual(SAVE.CONDITION_SECTION, 'Managed Conditions');
  assert.ok(
    !/'Health conditions'/.test(save),
    'the section is named Health conditions, which is the diagnosis thread she fenced out'
  );
  assert.strictEqual(
    CLIENT.tabFor({ kind: 'condition', content: null }),
    'me',
    'a condition lands in Insights, where nothing groups by section'
  );
  return `"${SAVE.CONDITION_SECTION}", on the Me tab`;
});

check('the offer says both things agreeing to it does', () => {
  assert.ok(/Me tab/.test(SAVE.CONDITION_OFFER_QUESTION), 'the offer does not mention the card');
  assert.ok(
    /take it into account in what I suggest/.test(SAVE.CONDITION_OFFER_QUESTION),
    'the offer does not say it changes her food guidance, which is the half she cannot see'
  );
  return `"${SAVE.CONDITION_OFFER_QUESTION}"`;
});

check('the classifier can offer one and the closing rule allows it', () => {
  assert.ok(/"condition"/.test(route), 'the tool cannot emit a condition');
  assert.ok(/pcos \| ibs \| hypothyroid \| t2d/.test(route), 'the four columns are not named for the model');
  assert.ok(/IT IS NOT A SYMPTOM\./.test(route), 'nothing tells it a condition is not a symptom');
  const closing = route.slice(route.indexOf('The app stores the offer and saves it only if they say yes'));
  assert.ok(/condition/i.test(closing), 'the closing rule sweeps conditions up, so the offer never happens');
  return 'offered, bounded, and not forbidden by the last line';
});

check('and this check can fail', () => {
  assert.ok(!('endometriosis' in SAVE.CONDITION_COLUMNS), 'a condition with no column has acquired one');
  const invented = 'Managing it myself';
  assert.ok(!SAVE.CONDITION_STATUSES.includes(invented), 'a free-text status would be accepted');
  const noRule = HC.buildHealthContextPrompt({ ...EMPTY, conditions_other: 'a sore knee' });
  assert.ok(!/Apply these protective adjustments/.test(noRule), 'a knee is generating dietary advice');
  return 'an invented column, status and rule are all rejected';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
