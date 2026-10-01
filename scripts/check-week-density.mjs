// DOES THE WEEK STILL FIT ON A PHONE?
//
//   node scripts/check-week-density.mjs
//
// Ruth, 1 October 2026, UI refinement. Success criterion one: "the week can
// usually be viewed without scrolling."
//
// WHY A HEIGHT BUDGET AND NOT A SCREENSHOT. A screenshot proves the week fits
// TODAY, with the activities that happen to be in it, and proves nothing about
// the next person who adds padding to a day row. The thing worth protecting is
// the budget: seven day rows, a heading, the flexible section, walking and the
// footer have to come to less than a phone screen. That is arithmetic, and
// arithmetic can be checked on every run.
//
// IT READS THE STYLESHEET, which is a weak kind of evidence and the only kind
// available without a device. It cannot see wrapping, a larger font scale, or a
// day with four activities on it - so the budget below is deliberately generous
// and the check is a GUARD AGAINST DRIFT rather than a proof of fit. The proof
// is Ruth's phone.
//
// THE NUMBERS COME FROM THE SMALLEST PHONE WE CARE ABOUT. An iPhone 13 mini is
// 812pt tall; take off the status bar, the tab bar and the page's own insets and
// roughly 600pt is left for content. The budget is set at that.

import fs from 'node:fs';
import path from 'node:path';

const WEEK = path.join(process.cwd(), 'mobile/src/components/week-view.tsx');
const src = fs.readFileSync(WEEK, 'utf8');

// Spacing scale, from constants/theme.ts. Read rather than hardcoded so a change
// there cannot silently make this check wrong.
const THEME = fs.readFileSync(path.join(process.cwd(), 'mobile/src/constants/theme.ts'), 'utf8');
const SPACING = {};
const spacingBlock = /export const Spacing = \{([\s\S]*?)\}/.exec(THEME);
for (const m of (spacingBlock?.[1] ?? '').matchAll(/(\w+):\s*(\d+)/g)) {
  SPACING[m[1]] = Number(m[2]);
}

/** A numeric style value out of the StyleSheet, resolving Spacing.x. */
function styleValue(selector, prop) {
  const block = new RegExp(`\\n  ${selector}: \\{([\\s\\S]*?)\\n  \\},`).exec(src);
  const inline = new RegExp(`\\n  ${selector}: \\{([^\\n]*?)\\},`).exec(src);
  const body = block?.[1] ?? inline?.[1];
  if (body === undefined) return null;
  const m = new RegExp(`${prop}:\\s*(Spacing\\.(\\w+)|\\d+)`).exec(body);
  if (!m) return null;
  return m[2] ? SPACING[m[2]] : Number(m[1]);
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
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log('\n  THE WEEK ON ONE SCREEN\n');

const BUDGET = 600;

const blockGap = styleValue('block', 'gap');
const dayMin = styleValue('dayRow', 'minHeight');
const emptyMin = styleValue('dayRowEmpty', 'minHeight');
const pillMin = styleValue('pill', 'minHeight');
const gridMin = styleValue('gridCard', 'minHeight');

check('the stylesheet can still be read', () => {
  // If this fails the rest is meaningless, so it is said plainly rather than
  // letting five checks pass against nulls.
  ok(SPACING.one === 4, `Spacing.one is ${SPACING.one}, expected 4`);
  for (const [name, v] of Object.entries({ blockGap, dayMin, emptyMin, pillMin, gridMin })) {
    ok(typeof v === 'number', `could not read ${name} - the styles were renamed`);
  }
  return `gap ${blockGap}, day ${dayMin}/${emptyMin}, pill ${pillMin}, flexible ${gridMin}`;
});

check('a typical week fits the budget', () => {
  // Her actual shape: a few days with something on them, the rest empty.
  const BUSY = 3;
  const days = BUSY * dayMin + (7 - BUSY) * emptyMin;
  const gaps = blockGap * 10; // seven days, heading, flexible, walking, footer
  const heading = 20;
  const flexible = gridMin + 8;
  const walking = 22;
  const footer = 40;
  const total = days + gaps + heading + flexible + walking + footer;
  ok(
    total <= BUDGET,
    `the week comes to about ${total}pt against a ${BUDGET}pt budget. ` +
      `Days ${days}, gaps ${gaps}, heading ${heading}, flexible ${flexible}, walking ${walking}, footer ${footer}.`
  );
  return `about ${total}pt of ${BUDGET}`;
});

check('an empty day is shorter than a full one', () =>
  ok(
    emptyMin < dayMin,
    `empty ${emptyMin} vs full ${dayMin} - item 6 is the emphasis falling on days with something in them`
  )
);

check('a day row still holds a pill without clipping it', () => {
  // The density pass must not have gone past the content. A pill plus the row's
  // own padding has to fit inside the row.
  const padding = styleValue('dayRow', 'paddingVertical') * 2;
  ok(
    dayMin >= pillMin + padding,
    `a ${pillMin}pt pill plus ${padding}pt of padding does not fit a ${dayMin}pt row`
  );
  return `${pillMin} + ${padding} <= ${dayMin}`;
});

check('the flexible section is lighter than the scheduled week', () =>
  // Item 8. These are intentions, not appointments.
  ok(gridMin <= dayMin, `flexible cards are ${gridMin}pt against ${dayMin}pt day rows`)
);

check('the touch targets survived the diet', () => {
  // THE ONE THING DENSITY MUST NOT COST. A pill is tapped to open the log sheet
  // and the "+" opens the add sheet; 44pt is the floor, and the "+" reaches it
  // through hitSlop rather than through its own size.
  ok(pillMin >= 32, `a ${pillMin}pt pill is too small to tap reliably`);
  ok(
    /hitSlop=\{Spacing\.three\}/.test(src),
    'the "+" lost its hitSlop, so quieter also made it harder to hit'
  );
  return 'pill tappable, "+" keeps hitSlop';
});

check('the "+" is quieter than the content', () => {
  // Item 10, as a rule rather than a look: it must not be drawn in the accent.
  const plusUsesAccent = /name="add"[^>]*color=\{theme\.accent/.test(src);
  ok(!plusUsesAccent, 'the "+" is back in the accent colour, which makes it the loudest mark again');
  return 'secondary text, not accent';
});

check('today is sage, not the action colour', () => {
  // Ruth, 1 October: "it reads like an alarm at the moment". Terracotta is this
  // app's action colour, so a filled terracotta dot asks for something.
  ok(
    /todayDot, \{ backgroundColor: theme\.sage \}/.test(src),
    'the today dot is not theme.sage'
  );
  return 'theme.sage';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
