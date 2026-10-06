// THE HEALTH SECTION PROMISES ONLY WHAT EXISTS, AND SAYS NOTHING IN AN EMERGENCY.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-health-support.mjs
//
// Two things this holds, and the second is the serious one.
//
// 1. ONLY THE CAPABILITIES THAT EXIST. Ruth's own instruction: "Only enable the
//    capability lines that exist... or the app will promise things it can't do."
//    Diary, web lookup, holding her details and the forms help are all written
//    and switched off. A boolean turning true is what releases its line.
//
// 2. NO MEDICINE NAMED IN AN EMERGENCY, which came out of a probe and a thing
//    she saw that I did not. Asked about crushing chest pain with a weak left
//    arm, the model said heart attack, said call 999, and told her to chew an
//    aspirin. I read that as a medication instruction, which it was, and stopped
//    there. Her reading went further: ARM WEAKNESS IS ALSO A STROKE SIGN, and
//    aspirin can do harm in a bleed on the brain. Two emergencies, one sentence,
//    and nothing in it can tell them apart.
//
//    The 999 operator asks the questions that do. The app's only job is to get
//    her there, and the rule now forbids the word outright rather than hedging
//    it - because the first version, which said "I do not name a medicine", was
//    obeyed three times in four and the fourth still printed "aspirin" inside a
//    sentence that was itself perfectly safe. Safe wording is not the test. The
//    word appearing at all is the risk, because somebody skimming acts on it.

import assert from 'node:assert';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const H = await import(root + '/app/lib/health-support.ts');

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

console.log('\n  THE HEALTH SECTION\n');

check('the emergency rule forbids naming a medicine', () => {
  assert.ok(/ASPIRIN/i.test(H.HEALTH), 'the rule no longer names the word it forbids');
  assert.ok(
    /does not appear in an emergency reply/i.test(H.HEALTH),
    'the prohibition is gone or softened'
  );
  // THE REASON HAS TO TRAVEL WITH THE RULE. A bare prohibition gets softened by
  // the next person who finds it unhelpful; the reason is what stops that.
  assert.ok(
    /stroke/i.test(H.HEALTH) && /heart attack/i.test(H.HEALTH),
    'the rule no longer says WHY, so it reads as caution rather than as a hazard'
  );
  return 'named, forbidden, and the reason attached';
});

check('it says what to do, not only what not to do', () => {
  assert.ok(/999/.test(H.HEALTH), 'the emergency block names no number');
  assert.ok(/111/.test(H.HEALTH), '111 is not offered');
  assert.ok(/A&E/.test(H.HEALTH), 'A&E is not offered');
  return '999, 111, A&E';
});

check('only the capabilities that exist are promised', () => {
  const c = H.HEALTH_CAPABILITIES;
  // THE FOUR THAT ARE NOT BUILT. Each must be false AND absent from the prompt.
  const notBuilt = {
    diary: /put it in your diary|I put it in your diary/i,
    currentGuidance: /check current guidance|current guidance for numbers/i,
    holdYourDetails: /Insurance references, contacts, appointment history/i,
    forms: /one box at a time/i,
  };
  for (const [key, pattern] of Object.entries(notBuilt)) {
    if (c[key]) continue; // if it has shipped, its line is allowed
    assert.ok(
      !pattern.test(H.HEALTH),
      `the prompt promises "${key}" and HEALTH_CAPABILITIES says it is not built`
    );
  }
  return Object.entries(c).filter(([, on]) => on).length + ' on, ' +
    Object.entries(c).filter(([, on]) => !on).length + ' held back';
});

check('a capability switched on releases its line', () => {
  // THE MECHANISM, PROVEN. Without this the booleans could be decorative and the
  // prompt a hand-maintained copy of them, which is the fault that produced the
  // two taglines and the two macro lists.
  const withDiary = H.healthSupportPrompt({ ...H.HEALTH_CAPABILITIES, diary: true });
  assert.ok(/diary/i.test(withDiary), 'turning diary on changed nothing in the prompt');
  assert.ok(!/diary/i.test(H.HEALTH), 'the diary line is in the prompt while it is off');
  return 'the boolean is what releases it';
});

check('it aims at the explanation and not the clinician', () => {
  assert.ok(
    /never at the person who gave it/i.test(H.HEALTH),
    'the rule about not judging her clinician is gone'
  );
  assert.ok(/shrug/i.test(H.HEALTH), 'the phrasings it forbids are no longer named');
  return 'she still has to walk back into that room';
});

check('the deflection rule is kept as an exhibit and used nowhere', () => {
  const { DEFLECTION_RULE_UNTIL_6_OCTOBER_2026: old } = H;
  assert.ok(/suggest they take it to their GP/.test(old), 'the exhibit has been edited');
  assert.ok(!H.HEALTH.includes(old), 'the old deflection rule is back in the live prompt');
  return 'readable, and not in the prompt';
});

check('and this check can fail', () => {
  const softened = H.HEALTH.replace(/THE WORD "ASPIRIN"[^]*?delay\./, 'I keep it short.');
  assert.notStrictEqual(softened, H.HEALTH, 'the fixture changed nothing');
  assert.ok(!/ASPIRIN/i.test(softened), 'the fixture still carries the rule');
  return 'a softened emergency rule is detected';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
