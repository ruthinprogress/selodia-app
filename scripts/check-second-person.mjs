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
import { globSync, readFileSync } from 'node:fs';

/**
 * EVERY FILE UNDER app/, NOT A LIST SOMEBODY MAINTAINS (6 October 2026).
 *
 * This was seven hand-written paths, and Ruth asked the question that found the
 * hole in it: "You've switched to her and she, is that in the prompts?"
 *
 * It was not - but app/lib/health-support.ts, the entire healthcare section
 * written today, was not on the list and had never been scanned. Nor were the
 * five blocks wired to the writer an hour ago. A hand-maintained list of the
 * files that matter is the same shape as every other fault this week: it is
 * correct on the day it is written and silently incomplete afterwards.
 *
 * SCANNING EVERYTHING COSTS NOTHING. A file with no model-visible "she" passes
 * without a word, so 120 files of ordinary code are free, and a new prompt is
 * covered the moment it exists rather than when somebody remembers.
 */
const PROMPT_SOURCES = globSync('app/**/*.ts').sort();

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
    // `[ \t]` AND NOT `\s`, because \s matches a newline. With /m the old
    // version could consume the blank lines before a comment and misalign the
    // string matcher after it, so a template literal lost its opening backtick
    // and ordinary prose downstream parsed as a string. It reported five files
    // that were clean, on the run where Ruth asked whether the prompts still
    // said "she" - which is the worst moment for a guard to cry wolf.
    .replace(/^[ \t]*\/\/.*$/gm, '');
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
  // THE SAME EXEMPTION, FOR THE SAME REASON, IN THE HEALTH SECTION. The rule
  // about not characterising her clinician names the phrasings it forbids - "no
  // that's a shrug, no she fobbed you off" - because the version that only said
  // what to AIM at held in one run out of two. A rule that quotes what it bans
  // cannot be written without the words it bans in it.
  /take aim at the explanation and never at the person who gave it/i,
  // A STORED VALUE, NOT PROMPT TEXT, AND THE DIFFERENCE IS LOAD-BEARING.
  //
  // feel_goals.source is 'chip' or 'her words'. The second is a column value
  // written by onboarding and read in three places, and the bulk rewrite
  // de-gendered it to 'their words' - which typechecks, ships, and silently
  // stops matching every row already in the database. check-feel-and-flow caught
  // it within the minute.
  //
  // THIS IS THE SAME LINE AS THE ALLERGY NAMES on 5 October: a label is wording
  // and a stored value is data, and only one of them is safe to rewrite. The
  // exemption is this exact string and nothing broader, so a NEW third-person
  // value cannot hide behind it.
  /^'her words'$/,
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
