// WHAT CAN BE CHECKED WITHOUT A PHONE IN YOUR HAND.
//
// Ruth asked for accessibility to be scoped properly and for the automated
// checks to be run, and was explicit that nothing is to be claimed until it has
// been tested. This script is the honest half of that: the parts of WCAG 2.2 AA
// that a machine can genuinely decide from source code.
//
// IT DOES NOT MEASURE ACCESSIBILITY. Three of the four things below are
// necessary-not-sufficient: a button with an accessibilityLabel of "button" has
// a label and is still useless. The TalkBack script is where the real answer is.
//
// WHAT IT DECIDES, AND WHY EACH ONE IS DECIDABLE:
//
//   1. Contrast, 1.4.3 and 1.4.11. Pure arithmetic on the theme tokens. This is
//      the only check here that is a real pass or fail.
//   2. A touchable with no accessible name, 4.1.2. A screen reader announces
//      nothing at all for these. Absence is decidable; quality is not.
//   3. A touchable with no role, 4.1.2. TalkBack says "double tap to activate"
//      only when it knows it is a button.
//   4. Touch target size, 2.5.8. Only where a literal width and height are set
//      on the touchable itself, which is a minority of cases. Everything
//      measured by layout has to be checked on the phone.
//
//   node scripts/check-accessibility.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'mobile', 'src');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (/\.tsx$/.test(e.name)) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------- 1. contrast

// sRGB relative luminance, WCAG 2.x definition.
function luminance(hex) {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? [...n].map((c) => c + c).join('') : n;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// ------------------------------------------------------------ 2, 3, 4. source

const TOUCHABLE = /<(Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback)\b/g;

// The opening tag, from `<Pressable` to the `>` that closes it. Nesting inside
// braces means a naive scan to the first `>` cuts a style prop in half, so the
// brace depth is tracked.
function openingTag(text, from) {
  let depth = 0;
  for (let i = from; i < text.length; i += 1) {
    const c = text[i];
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (c === '>' && depth === 0) return text.slice(from, i + 1);
  }
  return text.slice(from, from + 400);
}

// Everything between the opening tag and its matching close, so the text a
// screen reader would gather can be seen. Tag depth, not brace depth.
function bodyOf(text, from) {
  const name = text.slice(from + 1).match(/^\w+/)[0];
  const open = new RegExp(`<${name}\\b`, 'g');
  const close = new RegExp(`</${name}>`, 'g');
  let depth = 0;
  let i = from;
  while (i < text.length) {
    open.lastIndex = i;
    close.lastIndex = i;
    const o = open.exec(text);
    const c = close.exec(text);
    if (!c) return text.slice(from, from + 1200);
    if (o && o.index < c.index) {
      depth += 1;
      i = o.index + 1;
    } else {
      depth -= 1;
      if (depth <= 0) return text.slice(from, c.index);
      i = c.index + 1;
    }
  }
  return text.slice(from, from + 1200);
}

// The decision for one touchable, in one place, so it can be proved.
function judge(text, index) {
  const tag = openingTag(text, index);
  const body = bodyOf(text, index);
  const spread = /\{\.\.\./.test(tag);
  return {
    silent:
      !spread &&
      !/accessibilityLabel|aria-label/.test(tag) &&
      !(/<(Themed)?Text\b/.test(body) || /[>}]\s*[A-Za-z][^<>{}]{2,}\s*[<{]/.test(body)),
    unroled: !spread && !/accessibilityRole|\brole=/.test(tag),
  };
}

// A CHECK REPORTING ZERO HAS TO BE ABLE TO REPORT SOMETHING. Section 2 now
// finds no silent touchables, which is either good news or a broken check, and
// nothing in the output distinguishes those. These four fixtures do.
const FIXTURES = [
  ['<Pressable onPress={x}><Ionicons name="close" /></Pressable>', { silent: true, unroled: true }],
  ['<Pressable onPress={x}><ThemedText>Save</ThemedText></Pressable>', { silent: false, unroled: true }],
  ['<Pressable accessibilityLabel="Close" onPress={x}><Icon /></Pressable>', { silent: false, unroled: true }],
  ['<Pressable accessibilityRole="button" onPress={x}><Icon /></Pressable>', { silent: true, unroled: false }],
];
for (const [src, want] of FIXTURES) {
  const got = judge(src, 0);
  if (got.silent !== want.silent || got.unroled !== want.unroled) {
    console.error('SELF-TEST FAILED. The check does not work; its output means nothing.');
    console.error(`  ${src}\n  wanted ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
    process.exit(2);
  }
}

const files = walk(SRC);
const unnamed = [];
const unroled = [];
const small = [];
let touchables = 0;

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  for (const m of text.matchAll(TOUCHABLE)) {
    const tag = openingTag(text, m.index);
    const line = text.slice(0, m.index).split('\n').length;
    touchables += 1;

    // A label can also arrive as a spread of shared props, so a spread counts
    // as "cannot tell" rather than "missing" - a false alarm in a list this
    // long is how a list stops being read.
    const { silent, unroled: noRole } = judge(text, m.index);

    // A TOUCHABLE WITH NO LABEL IS NOT NECESSARILY SILENT, and the first
    // version of this said it was. React Native gathers the text inside a
    // touchable and announces that, so a Pressable wrapping the words
    // "Continue to permission request" reads perfectly well with no
    // accessibilityLabel on it at all. Reporting 43 of those as silent would
    // have sent Ruth after 43 non-problems and buried the real ones.
    //
    // Silent means no label AND no text inside. That is the decidable case:
    // an icon-only button.
    if (silent) unnamed.push(`${rel}:${line}`);
    if (noRole) unroled.push(`${rel}:${line}`);

    // 2.5.8 AA is 24x24 CSS pixels. React Native's unit is density independent
    // and is the same thing for this purpose.
    for (const dim of tag.matchAll(/\b(width|height)\s*:\s*(\d+)/g)) {
      if (Number(dim[2]) < 24) {
        small.push(`${rel}:${line}  ${dim[1]}: ${dim[2]}`);
        break;
      }
    }
  }
}

// ------------------------------------------------------------------- the pairs

// Read from mobile/src/constants/theme.ts rather than typed here, so a palette
// change cannot silently leave this passing.
//
// PER MODE, NOT ONE FLAT MAP. The first version of this collected every hex in
// the file into one object keyed by name. Both modes use the same names, so
// `dark` overwrote `light` and the light palette was never checked at all -
// while the output looked like a complete report. A check that silently tests
// half of what it claims to test is worse than no check.
const theme = fs.readFileSync(path.join(SRC, 'constants', 'theme.ts'), 'utf8');

function paletteOf(mode) {
  const open = theme.indexOf(`${mode}: {`);
  if (open < 0) return null;
  const close = theme.indexOf('\n  },', open);
  const block = theme.slice(open, close < 0 ? theme.length : close);
  return Object.fromEntries(
    [...block.matchAll(/(\w+)\s*:\s*['"](#[0-9a-fA-F]{3,8})['"]/g)].map((m) => [m[1], m[2]])
  );
}

const MODES = ['light', 'dark'];

console.log(`SELODÍA ACCESSIBILITY: what source code can decide\n`);
console.log(`${files.length} screen and component files, ${touchables} touchables\n`);

console.log('1. CONTRAST (1.4.3 AA: 4.5:1 body, 3:1 large text and UI parts)\n');
for (const mode of MODES) {
  const hexes = paletteOf(mode);
  if (!hexes) {
    console.log(`  No ${mode} palette found in theme.ts.\n`);
    continue;
  }
  const names = Object.keys(hexes);
  const grounds = names.filter((n) => /background|surface|card|paper|ground|sheet/i.test(n));
  const inks = names.filter((n) => !grounds.includes(n) && n !== 'scrim');
  const rows = [];
  for (const g of grounds) {
    for (const i of inks) {
      const r = ratio(hexes[g], hexes[i]);
      if (r < 4.5) rows.push([r, i, hexes[i], g, hexes[g]]);
    }
  }
  rows.sort((a, b) => a[0] - b[0]);
  console.log(`  ${mode.toUpperCase()}  (${grounds.length} grounds x ${inks.length} inks)`);
  if (rows.length === 0) console.log('    every pair clears 4.5:1');
  for (const [r, i, ih, g, gh] of rows) {
    const verdict = r < 3 ? 'BELOW 3:1, not usable for anything' : 'large text and UI parts only';
    console.log(`    ${r.toFixed(2)}:1  ${i} (${ih}) on ${g} (${gh})  ${verdict}`);
  }
  console.log();
}
console.log('  A pair being listed is not a bug on its own: it is a bug only where');
console.log('  that ink is actually drawn on that ground, and at what size.\n');

const report = (title, list, note) => {
  console.log(`${title}: ${list.length}`);
  if (note) console.log(`  ${note}`);
  for (const l of list.slice(0, 25)) console.log(`    ${l}`);
  if (list.length > 25) console.log(`    ... and ${list.length - 25} more`);
  console.log();
};

console.log('2. NAMES AND ROLES (4.1.2 A)\n');
report(
  '  SILENT touchables (no label AND no text inside)',
  unnamed,
  'Icon-only. TalkBack has nothing at all to announce.'
);
report(
  '  Touchables with no role',
  unroled,
  'Announced, but not as a button. A checkbox here also has no checked state.'
);

console.log('3. TOUCH TARGETS (2.5.8 AA, 24x24)\n');
report('  Literal dimensions below 24', small, 'Only where the size is written on the touchable itself.');

console.log('WHAT THIS CANNOT TELL YOU, and it is most of it:');
console.log('  - whether a label that exists is any use');
console.log('  - reading order, focus order, or whether focus is ever trapped');
console.log('  - whether the app works at 200% text size (1.4.4)');
console.log('  - whether anything is announced when the screen changes (4.1.3)');
console.log('  - whether an error can be understood without seeing the red (1.4.1)');
console.log('\nThose need the phone. See the TalkBack script.');
