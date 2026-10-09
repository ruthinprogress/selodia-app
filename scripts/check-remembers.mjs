// A DURABLE FACT SHE CONFIRMED IS WRITTEN DOWN.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-remembers.mjs
//
// Ruth, 9 October 2026: "it also didn't add the high cholesterol comment to my
// Me section."
//
// WHAT SHE ACTUALLY SAID, from the call at 10:41. "I received a letter from the
// doctor saying that my cholesterol was ever so slightly high. Could you log
// that for me?" - then, asked whether she wanted it as a note on her Me tab,
// "Uh, yes, please." It answered "I'll add the figure to the same note when you
// do", which describes a note that did not exist. Nothing was written to
// user_context or health_context. Both are still empty for her.
//
// THE CODE THAT LOST IT READ CORRECTLY, and that is the whole reason this check
// exists rather than a careful re-read:
//
//     if (existingCategory && existingCategory.length > 0) { insert }
//     else { savedContext = { ..., autoSaved: false } }
//
// A gate on "is this category already in use" looks like caution. Run it on an
// empty category and the first fact of every kind is dropped - health, sleep,
// watching, all of them - while every later one in that category saves. Her
// only category was 'goal'.
//
// AND THE GUARD BUILT TO CATCH THIS WAS HANDED THE LIE. savedContext feeds
// wroteThisTurn as 'remembered detail', which falseClaimNote checks a reply's
// claims against - and it was set in BOTH branches. So the one mechanism whose
// job is to say "you claimed a save that did not happen" was told the save had
// happened. That is why she heard nothing was wrong.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { rememberDecision, worthRemembering } = await import(root + '/app/lib/remember-context.ts');

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

console.log('\n  WHAT SHE TOLD IT, KEPT\n');

check('the cholesterol note, which is the first of its kind, is written', () => {
  // Her table at the time: two rows, both category 'goal'. The lookup is by
  // person AND category AND content, so for a brand-new health note it comes
  // back empty - and empty has to mean write.
  assert.strictEqual(rememberDecision([]), 'write');
  assert.strictEqual(rememberDecision(null), 'write');
  assert.strictEqual(rememberDecision(undefined), 'write');
  return 'empty means write, not "no category so never mind"';
});

check('and this check can fail', () => {
  // The whole check turns on one word coming back, so prove the other word can
  // come back too - otherwise a function returning 'write' unconditionally
  // passes everything above and duplicates every fact she ever restates.
  assert.strictEqual(rememberDecision([{ id: 'a' }]), 'already-there');
  // And reproduce the gate that lost it, to show the two really differ.
  const asShipped = (existingInCategory) => (existingInCategory.length > 0 ? 'write' : 'dropped');
  assert.strictEqual(asShipped([]), 'dropped', 'the old gate is not being reproduced');
  assert.notStrictEqual(rememberDecision([]), 'dropped');
  return "'already-there' is reachable, and the old gate dropped it";
});

check('the same fact arriving twice is not stored twice', () => {
  // The slow turn that logged her yoga five times would have written this note
  // five times too. One row already holding this exact content, in this exact
  // category, is this same fact arriving again.
  assert.strictEqual(rememberDecision([{ id: 'x' }]), 'already-there');
  return 'a retry adds nothing';
});

check('a blank fact is not a fact', () => {
  for (const [c, t] of [
    ['health', '   '],
    ['', 'cholesterol slightly high'],
    ['health', ''],
    [null, 'x'],
    ['health', undefined],
  ]) {
    assert.strictEqual(worthRemembering(c, t), false, `stored a blank: ${JSON.stringify([c, t])}`);
  }
  assert.strictEqual(
    worthRemembering('health', 'Letter from GP: cholesterol slightly high, no number given'),
    true
  );
  return '5 blanks refused, a real note accepted';
});

check('the route no longer gates the write on the category existing', () => {
  // The one structural assertion here, and it is narrow on purpose: it looks
  // for the exact shape that lost her note, so the behaviour cannot be
  // reintroduced under a different name while the pure checks above still pass.
  const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8');
  const stripped = route.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(
    !/existingCategory\s*&&\s*existingCategory\.length\s*>\s*0/.test(stripped),
    'the category-existence gate is back'
  );
  assert.ok(
    /rememberDecision\(/.test(stripped),
    'the route is not using the decision this check tests'
  );
  return 'the gate is gone and the route uses this decision';
});

check('a remembered detail is only claimed when something was stored', () => {
  // savedContext is what tells falseClaimNote a detail was remembered. If it is
  // set on a failed insert, the honesty guard is fed the same lie that kept her
  // in the dark this morning.
  const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8');
  const at = route.indexOf('const { error: contextError }');
  assert.ok(at > 0, 'the insert no longer reports its error');
  const after = route.slice(at, at + 900);
  assert.ok(
    /savedContext\s*=\s*contextError\s*\?\s*null/.test(after),
    'savedContext is set regardless of whether the insert succeeded'
  );
  return 'a failed write claims nothing';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
