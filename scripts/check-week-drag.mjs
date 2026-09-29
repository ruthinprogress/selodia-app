// THE FOUR WAYS THE WEEK'S DRAG BREAKS WITHOUT ANYONE NOTICING.
//
//   node scripts/check-week-drag.mjs
//
// Every one of these is a fault that actually happened on 29 September, and
// none of them shows up in a typecheck, a lint or a screenshot of a screen at
// rest. Three of the four are silent: the app renders, the page looks right,
// and the gesture simply does nothing - which is exactly the report Ruth
// sent ("does nothing at all").
//
//   1  TEMPORAL DEAD ZONE IN A WORKLET
//      A Reanimated worklet captures the variables it references AT THE MOMENT
//      IT IS BUILT. `clearCarry` was declared below the gestures that used it,
//      so building them read a `const` that did not exist yet and threw before
//      the Week tab drew anything. A crash, not a silence - but a crash on her
//      phone and on no screen here.
//
//   2  THE HOLD BOUND TWICE
//      Pressable's onLongPress and the pan gesture both fired, so holding a
//      card lifted it for dragging AND threw a sheet up over the week she was
//      dragging it across. Caught only in a mid-drag screenshot.
//
//   3  A PAN WITHOUT activateAfterLongPress
//      Then the gesture fights the ScrollView for every touch: either the page
//      stops scrolling or the drag never starts. This is the regression that
//      would quietly undo the whole fix.
//
//   4  "MOVE TO…" QUIETLY DROPPED
//      Her instruction was "both drag and a Move to… option; not one or the
//      other", because a drag cannot be done with a screen reader. If the tap
//      sheet ever loses it, the app loses its only accessible way to move an
//      activity - and nothing else would complain.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEEK = path.join(ROOT, 'mobile/src/components/week-view.tsx');
const LOG_SHEET = path.join(ROOT, 'mobile/src/components/log-plan-sheet.tsx');

// COMMENTS ARE NOT CODE, and this file is full of comments that describe the
// very faults it looks for - "NO onLongPress", "Move to… lives here". Reading
// those as code made three of the four checks fail against a correct file.
//
// CRLF FIRST. A `.` does not match `\r`, so a stripper written against `$`
// silently does nothing on a CRLF checkout - which is how check-onboarding-copy
// once passed on a branch and failed on main with identical content.
const stripComments = (src) =>
  src
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');

const read = (p) => stripComments(fs.readFileSync(p, 'utf8'));

// ---------------------------------------------------------------- the checks
//
// Each takes the sources and returns a list of complaints. Returning an empty
// list is a pass, which is what makes them runnable against a broken copy
// below to prove they can fail.

const CHECKS = {
  'worklet closures are declared first'(week) {
    const out = [];
    const lines = week.split('\n');
    // Where the first gesture is built. Everything a worklet mentions has to
    // exist by then.
    const builtAt = lines.findIndex((l) => l.includes('Gesture.Pan()'));
    if (builtAt === -1) return ['no Gesture.Pan() in week-view.tsx at all'];
    for (const m of week.matchAll(/runOnJS\(\s*([A-Za-z_$][\w$]*)\s*\)/g)) {
      const name = m[1];
      const declaredAt = lines.findIndex((l) =>
        new RegExp(`^\\s*(?:const|let|function)\\s+${name}\\b`).test(l)
      );
      if (declaredAt === -1) continue; // imported, or a prop
      if (declaredAt > builtAt) {
        out.push(
          `runOnJS(${name}) is built at line ${builtAt + 1} but ${name} is ` +
            `declared at line ${declaredAt + 1}. A worklet captures it when it is ` +
            `BUILT, so this throws before the screen draws.`
        );
      }
    }
    return out;
  },

  'the hold is bound once'(week) {
    // A card inside a GestureDetector must not also carry onLongPress.
    if (!week.includes('GestureDetector')) return ['no GestureDetector - the drag is gone'];
    return week.includes('onLongPress')
      ? [
          'week-view.tsx still binds onLongPress. The pan gesture already owns ' +
            'the hold, and both firing lifts the card AND opens a sheet over it.',
        ]
      : [];
  },

  'the pan waits for the hold'(week) {
    return week.includes('activateAfterLongPress')
      ? []
      : [
          'Gesture.Pan() without .activateAfterLongPress(). It will fight the ' +
            'ScrollView: either the week stops scrolling or the drag never starts.',
        ];
  },

  'the accessible route survives'(_week, logSheet) {
    const out = [];
    if (!logSheet.includes('Move to…')) {
      out.push('the tap sheet has no "Move to…" - the only route a screen reader can use');
    }
    // It has to be OUTSIDE the scroller, or it is below the fold and nobody
    // finds it. The footer is the pinned part of the sheet.
    const footerAt = logSheet.indexOf('styles.footer');
    const moveAt = logSheet.indexOf('Move to…');
    const scrollEnd = logSheet.indexOf('</ScrollView>');
    if (moveAt !== -1 && scrollEnd !== -1 && moveAt < scrollEnd) {
      out.push('"Move to…" is inside the ScrollView, so it sits below the fold');
    }
    if (footerAt === -1) out.push('the tap sheet has no pinned footer');
    return out;
  },
};

// ------------------------------------------------------------------- running

const week = read(WEEK);
const logSheet = read(LOG_SHEET);

const failures = [];
for (const [name, fn] of Object.entries(CHECKS)) {
  for (const problem of fn(week, logSheet)) failures.push(`${name}: ${problem}`);
}

// ------------------------------------------------------------------ MUTATION
//
// PROVE EACH CHECK CAN FAIL. Every check is re-run against a copy of the
// source with its subject broken. A check that still passes is testing a
// wording rather than a behaviour, and says so rather than reporting green.

const BREAK = {
  'worklet closures are declared first': (w) =>
    // Move a declaration below the gesture: rename it at the top and
    // re-declare it at the bottom, which is exactly the shape of the bug.
    w.replace('const clearCarry = useCallback(', 'const clearCarryMoved = useCallback(') +
    '\nconst clearCarry = () => {};\n',
  'the hold is bound once': (w) => w.replace('accessibilityRole="button"', 'onLongPress={x}'),
  'the pan waits for the hold': (w) => w.replaceAll('activateAfterLongPress', 'xx'),
  'the accessible route survives': (w) => w,
};
const BREAK_SHEET = {
  'the accessible route survives': (l) => l.replaceAll('Move to…', 'Log it'),
};

const useless = [];
for (const [name, fn] of Object.entries(CHECKS)) {
  const w = BREAK[name] ? BREAK[name](week) : week;
  const l = BREAK_SHEET[name] ? BREAK_SHEET[name](logSheet) : logSheet;
  if (fn(w, l).length === 0) {
    useless.push(`${name}: still passed against a copy with its subject broken.`);
  }
}

for (const f of failures) console.error('  FAIL     ' + f);
for (const u of useless) console.error('  USELESS  ' + u);

const total = Object.keys(CHECKS).length;
console.log(
  `\n  ${total - failures.length}/${total} checks passed, ` +
    `${useless.length} useless (each proved able to fail)`
);
if (failures.length + useless.length > 0) process.exit(1);
