// THE NAME AND THE TAGLINE, AGAINST THE SPEC THAT SETTLED THEM.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-brand.mjs
//
// Ruth, 6 October 2026: "my bad on not correcting the tag line on prompt. It
// should always be - Your body isn't a problem to solve. It's something to get
// to know."
//
// It was not her mistake. SELODIA_SPEC.md has said this since 31 August, in
// capitals: "CONFIRMED FINAL... existing manifesto copy, carried over verbatim;
// it is not new and is not up for redrafting here." It is on the website, in the
// store submission and in the marketing spec.
//
// And the app said something else, in two places, because the About screen and
// the welcome screen each carried their own copy of it. A settled line with two
// copies is a line that can be wrong on its own - which is the same shape as the
// heading that said "Food" in setup and "On your plate" in the Manual, and as
// the macro block that disagreed with the food log.
//
// SO THIS READS THE SPEC. Not a string typed into this file: the document where
// it was confirmed is the thing the app has to agree with, and if somebody
// changes it there, this goes red until the app follows.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const BRAND = await import(root + '/mobile/src/lib/brand.ts');
const WELCOME = await import(root + '/mobile/src/lib/welcome.ts');

const spec = readFileSync('mobile/SELODIA_SPEC.md', 'utf8');

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

console.log('\n  THE NAME AND THE TAGLINE\n');

check('the tagline is the one the spec confirmed', () => {
  // THE SPEC IS THE SOURCE. Pulled out of the sentence that declares it final,
  // so this cannot drift into asserting a tagline somebody typed in here.
  const at = spec.indexOf('Tagline (CONFIRMED FINAL');
  assert.ok(at > 0, 'the spec no longer declares a confirmed tagline');
  const declared = spec.slice(at, at + 400);
  const quoted = declared.match(/\*"([^"]+)"\*/);
  assert.ok(quoted, 'the confirmed tagline is no longer quoted in the spec');
  assert.strictEqual(
    BRAND.TAGLINE,
    quoted[1],
    'the app and the spec disagree about the tagline'
  );
  return `"${BRAND.TAGLINE}"`;
});

check('the two halves join back into the whole', () => {
  // A SCREEN THAT SETS IT LARGE WRITES THE LINES OUT, so the halves and the whole
  // are two representations of one sentence and can come apart. They cannot.
  assert.strictEqual(
    BRAND.TAGLINE_LINES.join(' '),
    BRAND.TAGLINE,
    'the written-out lines do not add up to the tagline'
  );
  assert.strictEqual(
    BRAND.WELCOME_TITLE_LINES.join(' '),
    `Welcome to ${BRAND.APP_NAME}`,
    'the welcome title lines do not add up to the title'
  );
  return 'two lines, one sentence';
});

check('the welcome uses it rather than its own copy', () => {
  assert.strictEqual(WELCOME.WELCOME.line, BRAND.TAGLINE, 'the welcome has its own tagline again');
  assert.deepStrictEqual(
    [...WELCOME.WELCOME.titleLines],
    [...BRAND.WELCOME_TITLE_LINES],
    'the welcome has its own title lines again'
  );
  return 'one source';
});

check('nothing draws the name by wrapping a line', () => {
  // THE THIRD TIME ANDROID HAS DONE THIS. The Log screen drew its own name as
  // "Loq"; every unselected tab lost exactly its last letter; and the welcome
  // rendered "Welcome to Selodía" as "Welcome to" with the name measured, given
  // its space, and never drawn. Each cause was measurement and drawing
  // disagreeing about where a line ends.
  const screen = readFileSync('mobile/src/app/onboarding/welcome.tsx', 'utf8');
  const code = screen.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  assert.ok(
    /titleLines\.map/.test(code),
    'the title is one string again, so Android decides where it breaks'
  );
  // DRAWN, NOT ANNOUNCED. The whole string is still the accessibilityLabel, and
  // it should be: a screen reader should hear one sentence, not two fragments.
  // The first version of this banned the string outright and failed on exactly
  // that - a check condemning the thing it wanted.
  const drawn = code.slice(code.indexOf('<Pressable'));
  const asText = drawn.match(/>\s*\{WELCOME\.title\}\s*</);
  assert.ok(!asText, 'the whole title string is being drawn, which is what rendered blank');
  assert.ok(
    /accessibilityLabel=\{`\$\{WELCOME\.title\}/.test(drawn),
    'the screen reader hears the title in fragments'
  );
  return 'one Text per line, one sentence announced';
});

check('the app says the tagline in only one place', () => {
  // THE FAULT ITSELF: two screens, each with its own copy, one of them wrong.
  const about = readFileSync('mobile/src/app/settings/about.tsx', 'utf8');
  assert.ok(/TAGLINE/.test(about), 'the About screen has its own tagline again');
  assert.ok(
    !/Understand your body/.test(about),
    'the About screen still carries the line that was never the tagline'
  );
  return 'About and the welcome read the same constant';
});

check('and this check can fail', () => {
  const wrong = 'Understand your body. Live in it.';
  assert.notStrictEqual(wrong, BRAND.TAGLINE, 'the fixture is the real tagline');
  const split = ['Your body is', "n't a problem to solve. It's something to get to know."];
  assert.notDeepStrictEqual(split, [...BRAND.TAGLINE_LINES], 'the fixture matches the real split');
  return 'the line I invented, and a wrong split, are both detected';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
