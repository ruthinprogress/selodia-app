// A GESTURE INSIDE A MODAL NEEDS ITS OWN GESTURE ROOT.
//
//   node scripts/check-gestures-in-modals.mjs
//
// WHAT HAPPENED, 30 September 2026. The per-item swipe on the food detail card
// was built, typechecked, shipped, and did nothing at all. Ruth: "the swipe left
// to delete is not working. No swipe at all there."
//
// react-native-gesture-handler routes touches through a GestureHandlerRootView,
// and this app has exactly one, in app/_layout.tsx. On Android a <Modal> is a
// SEPARATE NATIVE WINDOW, so its contents sit outside that root and every
// gesture inside it is handled by nobody. Nothing throws. Nothing logs. The
// finger moves and the row does not.
//
// AND IT HAD BEEN BROKEN FOR SIX DAYS. The swipe on that card's HEADER was
// built on 24 September, documented in the file as working, and was inside the
// same modal the whole time. Nobody swiped a header to find out. A new feature
// is the only thing anybody tests; the old one that shares its cause is not.
//
// WHAT THIS CHECKS. For every file that renders a <Modal>, the JSX between
// <Modal and </Modal> is read: if it contains a gesture - a GestureDetector, a
// Gesture.something, or one of the components built on them - then a
// GestureHandlerRootView must appear inside that same span.
//
// WHAT IT CANNOT SEE, stated plainly rather than implied. It reads one file at
// a time and only literal JSX. A modal that renders <SomeCard /> where the
// gesture lives inside SomeCard's own file is invisible to it. That is a real
// gap; this catches the shape that actually occurred twice, which is a gesture
// written in the same file as the modal that contains it.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'mobile', 'src');

/** Components whose whole job is a gesture. A modal holding one needs a root. */
const GESTURE_COMPONENTS = ['SwipeToDelete', 'ReorderableRows'];

function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

// COMMENTS ARE NOT CODE, and this has bitten twice already this week - two
// checks passed or failed on a sentence in a comment that named the thing they
// were looking for. Strings are left alone: a gesture is never in one.
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** The span from each `<Modal` to its matching `</Modal>`. */
function modalSpans(source) {
  const spans = [];
  let from = 0;
  for (;;) {
    const open = source.indexOf('<Modal', from);
    if (open === -1) break;
    const close = source.indexOf('</Modal>', open);
    if (close === -1) break;
    spans.push(source.slice(open, close));
    from = close + 1;
  }
  return spans;
}

function gesturesIn(span) {
  const found = [];
  if (/<GestureDetector\b/.test(span)) found.push('GestureDetector');
  if (/\bGesture\.[A-Z]/.test(span)) found.push('Gesture.*');
  for (const name of GESTURE_COMPONENTS) {
    if (new RegExp(`<${name}\\b`).test(span)) found.push(name);
  }
  return found;
}

function audit(source, label) {
  const clean = withoutComments(source);
  const failures = [];
  for (const span of modalSpans(clean)) {
    const gestures = gesturesIn(span);
    if (gestures.length === 0) continue;
    if (!/<GestureHandlerRootView\b/.test(span)) {
      failures.push(
        `${label}: a <Modal> contains ${gestures.join(', ')} and no <GestureHandlerRootView>. ` +
          'On Android that modal is its own native window, so the gesture is handled by nobody ' +
          'and the swipe silently does nothing.'
      );
    }
  }
  return failures;
}

const files = sourceFiles(ROOT);
const failures = [];
let checked = 0;
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes('<Modal')) continue;
  checked += 1;
  failures.push(...audit(source, path.relative(process.cwd(), file)));
}

// CAN THIS CHECK FAIL? Take the root back out of the file the bug was found in
// and the check must report it. A structural check nobody has watched fail is a
// comment with a shebang.
const REAL = path.join(ROOT, 'components', 'food-breakdown-card.tsx');
const broken = fs.readFileSync(REAL, 'utf8').split('GestureHandlerRootView').join('View');
const mutationCaught = audit(broken, 'mutation').length > 0;

// AND THE OPPOSITE MUTATION: a modal with no gesture in it must not be reported
// just for being a modal, or every edit sheet in the app becomes a false alarm.
const innocent = `
  export function Sheet() {
    return (
      <Modal visible transparent>
        <Pressable onPress={close}><Text>Edit</Text></Pressable>
      </Modal>
    );
  }
`;
const quietOnInnocent = audit(innocent, 'innocent').length === 0;

if (!mutationCaught) {
  failures.push('USELESS: removing the gesture root from the real file did not fail the check');
}
if (!quietOnInnocent) {
  failures.push('TOO LOUD: a modal with no gesture in it was reported');
}

for (const f of failures) console.error('  FAIL  ' + f);
console.log(`\n  ${checked} file(s) with a <Modal> checked, ${failures.length} failed`);
console.log(
  `  Proof: removing the root is caught = ${mutationCaught}, a gesture-free modal is left alone = ${quietOnInnocent}`
);
if (failures.length > 0) process.exit(1);
