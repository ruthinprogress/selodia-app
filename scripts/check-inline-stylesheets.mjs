// A BACKTICK INSIDE AN INLINE STYLESHEET ENDS IT MID-RULE.
//
//   node scripts/check-inline-stylesheets.mjs
//
// THIS IS A GUARD AT THE WRITE, not a note asking somebody to be careful.
//
// I made this mistake twice on 8 October 2026, in the same file, hours apart. A
// page component holds its CSS in a template literal, and writing a CSS comment
// that quotes a filename in backticks ends the literal at that backtick. The
// result is not a subtle bug: the build fails with "Expected '</', got 'ident'"
// pointing at a prose comment, which reads as nonsense until you see it.
//
// The first time, I fixed it and wrote a comment in the file saying not to do
// it again. The second time, I rewrote the file, dropped that comment, and
// immediately reintroduced it. Which is the whole argument for this file: a
// rule that lives in a comment protects only the person who happens to read
// that comment, and a rule that lives in a check protects everybody. Ruth's
// standing version of this is "a guard belongs at the write".
//
// IT ALSO CATCHES THE OTHER TWO WAYS TO END ONE EARLY: an unescaped `${` that
// opens an interpolation with no closing brace, and a stray `</style` inside
// the CSS, which the HTML parser would act on before JavaScript ever sees it.

import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOTS = ['app'];
const SKIP = new Set(['node_modules', '.next', 'api', 'v1']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/** Every `<style>{` ... `}</style>` block in a file, with the line it starts on. */
function stylesheets(src) {
  const out = [];
  const open = '<style>{`';
  const close = '`}</style>';
  let from = 0;
  for (;;) {
    const a = src.indexOf(open, from);
    if (a === -1) break;
    const b = src.indexOf(close, a + open.length);
    if (b === -1) {
      out.push({ unterminated: true, line: src.slice(0, a).split('\n').length, body: '' });
      break;
    }
    out.push({
      line: src.slice(0, a).split('\n').length,
      body: src.slice(a + open.length, b),
    });
    from = b + close.length;
  }
  return out;
}

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

const files = ROOTS.flatMap((r) => walk(r));
const found = files.flatMap((f) => stylesheets(readFileSync(f, 'utf8')).map((s) => ({ ...s, file: f })));

console.log('\n  INLINE STYLESHEETS\n');

check('there are some to check', () => {
  assert.ok(found.length > 0, 'no inline stylesheets found, so this check is watching nothing');
  return `${found.length} in ${new Set(found.map((s) => s.file)).size} files`;
});

check('none is left unterminated', () => {
  const bad = found.filter((s) => s.unterminated).map((s) => `${s.file}:${s.line}`);
  assert.deepStrictEqual(bad, [], `opened and never closed: ${bad.join(', ')}`);
  return 'every one is closed';
});

check('no backtick inside one', () => {
  // THE ONE THAT HAS ACTUALLY BITTEN, twice in a day, both times in a CSS
  // comment quoting a filename.
  const bad = found
    .filter((s) => s.body.includes('`'))
    .map((s) => {
      const upto = s.body.slice(0, s.body.indexOf('`'));
      return `${s.file}:${s.line + upto.split('\n').length - 1}`;
    });
  assert.deepStrictEqual(bad, [], `a backtick ends the stylesheet here: ${bad.join(', ')}`);
  return 'clean';
});

check('no accidental interpolation', () => {
  // A `${` with no matching brace is the same failure by another route.
  const bad = [];
  for (const s of found) {
    let i = s.body.indexOf('${');
    while (i !== -1) {
      if (s.body.indexOf('}', i) === -1) bad.push(`${s.file}:${s.line}`);
      i = s.body.indexOf('${', i + 2);
    }
  }
  assert.deepStrictEqual(bad, [], `unclosed interpolation: ${bad.join(', ')}`);
  return 'every interpolation closes';
});

check('no closing style tag inside one', () => {
  // The HTML parser acts on this before JavaScript ever sees the string.
  const bad = found.filter((s) => s.body.includes('</style')).map((s) => `${s.file}:${s.line}`);
  assert.deepStrictEqual(bad, [], `ends the element early: ${bad.join(', ')}`);
  return 'clean';
});

check('and this check can fail', () => {
  // The real shape of the mistake, not a nonsense fixture: a CSS comment
  // quoting a filename, which is what happened both times.
  const realMistake = '\n  .hero { color: red; }\n  /* see `scripts/thing.mjs` for why */\n';
  assert.ok(realMistake.includes('`'), 'the fixture does not contain the thing being detected');

  const clean = '\n  .hero { color: red; }\n  /* see scripts/thing.mjs for why */\n';
  assert.ok(!clean.includes('`'), 'a clean stylesheet is reported as dirty');

  // And the parser finds a block at all.
  const parsed = stylesheets('x<style>{`a{b:c}`}</style>y');
  assert.strictEqual(parsed.length, 1, 'the parser does not find a stylesheet');
  assert.strictEqual(parsed[0].body, 'a{b:c}', 'the parser returns the wrong body');

  const unterminated = stylesheets('x<style>{`a{b:c}');
  assert.ok(unterminated[0].unterminated, 'an unterminated stylesheet is not detected');
  return 'the real mistake, a clean one, and an unterminated one';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
