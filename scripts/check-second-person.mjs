// THE APP SPEAKS TO HER, NOT ABOUT HER.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-second-person.mjs
//
// Ruth, 5 October 2026, 20:38. She asked about her saturated fat and was told
// twice that the log does not hold it. The second refusal read:
//
//   "What I can see from HER log is calories and protein."
//
// Her saturated fat was in the database the whole time: 46 of her last 53 meals
// carry a figure, 309 g across the fortnight, the macro was switched on, and the
// block that holds those totals was built and shipped the day before. Her words:
// "It's never going to replace Claude if it can't replace Claude... this is basic
// stuff it's failing on."
//
// THE CAUSE WAS THE REGISTER, AND IT CAUSED BOTH HALVES. Every context block was
// written in the third person - "WHAT SHE TRACKS", "WHERE SHE IS WITH PERIODS",
// "HER LAST WEIGH-IN ON RECORD". The newest and most emphatic of them was the
// macro block, so the model took its voice from it and said "her log"; and
// having been handed a block about a third party, it had to work out on its own
// that the "she" in the context and the "I" in the message were one person. It
// did not. Getting that wrong looks exactly like not having the data.
//
// AN INSTRUCTION NOT TO COPY A REGISTER IS WEAKER THAN NOT SHOWING IT ONE. There
// is a rule at the top of the conduct block now, and this is the guard: a
// third-person pronoun in anything the model can see fails the build. The rule
// is for the edges; this is for the cause.
//
// WHAT COUNTS AS MODEL-VISIBLE. String and template literals in the files that
// build the prompt. Comments are stripped first, because this file's own
// explanation says "she" forty times and the prompt text is what matters.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

/** Every file that puts words in front of the model. */
const PROMPT_SOURCES = [
  'app/api/ask-selodia/route.ts',
  'app/lib/tracked-macro-summary.ts',
  'app/lib/weigh-in-facts.ts',
  'app/lib/life-stage-facts.ts',
  'app/lib/reply-prompt.ts',
  'app/lib/rules-gate.ts',
  'app/lib/food-parse-prompt.ts',
];

const THIRD_PERSON = /\b(she|her|hers|herself)\b/i;

/**
 * Strip comments, then take what is inside quotes.
 *
 * DELIBERATELY ROUGH. It cannot parse TypeScript, and it does not need to: it
 * finds quoted runs and tests those, which over-reports (a quoted word inside a
 * comment that survived) rather than under-reports. A guard that misses is worse
 * than a guard that is occasionally annoying, and ALLOWED below is where an
 * honest exception goes, in writing.
 */
function modelVisibleStrings(src) {
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const out = [];
  const pattern = /`(?:[^`\\]|\\.)*`|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g;
  let m;
  while ((m = pattern.exec(code)) !== null) out.push(m[0]);
  return out;
}

/**
 * Lines that may say "she", with the reason.
 *
 * ONE KIND OF EXCEPTION ONLY: text that is quoting Ruth, by name, about why
 * something was built. "Ruth said so when she asked for this" is a citation, not
 * the app talking about the person in front of it.
 */
const ALLOWED = [
  /Ruth[^'"`]{0,80}\bshe\b/i,
  // Named third parties in examples: a friend, a sister, a GP's receptionist.
  /\bher friend\b|\bher sister\b|\bher mother\b/i,
  // THE RULE ITSELF, which has to quote the wording it forbids. The bulk rewrite
  // that de-gendered the prompt ran over this line too and turned
  //   never "her log", "she has"
  // into
  //   never "their log", "they have"
  // a rule banning the exact wording it exists to require. A rule that quotes
  // what it forbids cannot be fed to a tool that rewrites what it forbids, and
  // this is the one string in the app where the third person is the point.
  /speaking TO the person[\s\S]*never in the third person/i,
];

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

console.log('\n  THE PROMPT ADDRESSES HER DIRECTLY\n');

let scanned = 0;
for (const rel of PROMPT_SOURCES) {
  check(`${rel} speaks to the person`, () => {
    let src;
    try {
      src = readFileSync(rel, 'utf8');
    } catch {
      // A source that has moved is not a pass. Name it rather than skipping it.
      throw new Error('this file is in the list and not on disk');
    }
    const offending = modelVisibleStrings(src)
      .filter((lit) => THIRD_PERSON.test(lit))
      .filter((lit) => !ALLOWED.some((a) => a.test(lit)));
    scanned += 1;
    assert.deepStrictEqual(
      offending.map((l) => l.slice(0, 90)),
      [],
      `${offending.length} model-visible string(s) refer to her in the third person`
    );
    return 'no third-person pronoun in anything the model sees';
  });
}

check('the conduct block says it out loud as well', () => {
  const src = readFileSync('app/api/ask-selodia/route.ts', 'utf8');
  const at = src.indexOf('const GENERAL_CONDUCT');
  assert.ok(at > 0, 'the conduct block is gone');
  const head = src.slice(at, at + 1200);
  assert.ok(/speaking TO the person/i.test(head), 'the rule is not in the conduct block');
  assert.ok(/third person/i.test(head), 'the rule does not name the fault');
  // AND IT SAYS THE SECOND HALF, which is the half that cost her the figure: a
  // block about "her" is still about the person typing.
  assert.ok(
    /still about the person you are talking to/i.test(head),
    'nothing tells the model that a third-party-sounding block is still about them'
  );
  return 'the rule is first in the block';
});

check('the macro block tells the model it HAS the figures', () => {
  // THE SENTENCE THAT WAS ALREADY THERE AND DID NOT WORK, kept and asserted. It
  // was not wrong; it was outvoted by its own register.
  const src = readFileSync('app/lib/tracked-macro-summary.ts', 'utf8');
  // THE SENTENCE MOVED WITH THE REGISTER. It read "when she asks about any of
  // them you HAVE the figures"; it now addresses her, so the assertion follows
  // the claim rather than the wording it happened to carry on 4 October.
  assert.ok(/I HAVE the figures/.test(src), 'the block no longer says it has them');
  assert.ok(
    /NEVER say your record does not track it/.test(src),
    'the block no longer forbids the refusal she was given'
  );
  assert.ok(
    /never send you to your GP/.test(src),
    'the block no longer forbids sending her to her GP for a figure it holds'
  );
  return 'and it forbids the exact refusal she got';
});

check('and this check can fail', () => {
  const sample = `const block = 'WHAT SHE TRACKS, BY DAY. She has switched these on.';`;
  const found = modelVisibleStrings(sample).filter((l) => THIRD_PERSON.test(l));
  assert.strictEqual(found.length, 1, 'the scanner does not see a third-person string');

  // And it must not fire on a comment, which is what makes it usable at all.
  const commented = `// WHAT SHE TRACKS, and why she asked for it.\nconst x = 'you have the figures';`;
  const none = modelVisibleStrings(commented).filter((l) => THIRD_PERSON.test(l));
  assert.deepStrictEqual(none, [], 'the scanner is reading comments');
  return 'the old block is caught, a comment is not';
});

console.log(`\n  ${pass} passed, ${failures.length} failed   (${scanned} prompt sources scanned)\n`);
if (failures.length > 0) process.exit(1);
