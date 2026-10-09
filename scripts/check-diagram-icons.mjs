// THE ICONS, AND THE MAPPING THAT DECIDES WHICH LABEL GETS WHICH DRAWING.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-diagram-icons.mjs
//
// Ruth gave the mapping by hand on 8 October: Food, Meals and Lunch use the
// bowl, Movement and Walk the footprints, and so on. A mapping written out by a
// person is exactly the kind of thing that drifts: a label gets reworded, the
// key no longer matches, and the icon silently disappears. Nothing breaks, the
// build is green, and the circle is just empty.
//
// So this checks the two directions that can go wrong:
//
//   AN ORPHAN MAPPING   an entry for a label that no diagram uses any more.
//   A MISSING ICON      a diagram label that should have one and does not.
//
// It also pins the things her brief was specific about: one ink, one stroke
// weight, round caps and joins, and no fills except the single solid dot on the
// cycle ring that her own drawing has.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { ICON_FOR, ICON_INK, ICON_STROKE } = await import(root + '/app/lib/icon-map.ts');
const { DIAGRAMS } = await import(root + '/app/lib/homepage-copy.ts');

const src = readFileSync('app/lib/icons.tsx', 'utf8');

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

/** Every label that appears in any diagram. */
const LABELS = new Set([
  ...DIAGRAMS.connections.nodes,
  ...DIAGRAMS.record.nodes,
  ...DIAGRAMS.realLife.nodes,
  ...DIAGRAMS.howItWorks.nodes,
]);

/** The ones her mapping covers. The How it works stages are deliberately not in it. */
const STAGES = new Set(DIAGRAMS.howItWorks.nodes);

console.log('\n  DIAGRAM ICONS\n');

check('every mapped label is still used by a diagram', () => {
  const orphans = Object.keys(ICON_FOR).filter((label) => !LABELS.has(label));
  assert.deepStrictEqual(orphans, [], `mapped but no diagram uses it: ${orphans.join(', ')}`);
  return `${Object.keys(ICON_FOR).length} mappings, all in use`;
});

check('every noun label has an icon', () => {
  // Stages are excluded on purpose: a drawing for "You understand" would be
  // invention rather than a redraw of her sheet.
  const nouns = [...LABELS].filter((l) => !STAGES.has(l));
  const missing = nouns.filter((l) => !ICON_FOR[l]);
  assert.deepStrictEqual(missing, [], `no icon for: ${missing.join(', ')}`);
  return `${nouns.length} nouns, all drawn`;
});

check('and the stages deliberately have none', () => {
  const wrong = [...STAGES].filter((l) => ICON_FOR[l]);
  assert.deepStrictEqual(wrong, [], `a stage was given an icon: ${wrong.join(', ')}`);
  return `${STAGES.size} stages, text only`;
});

check('every drawing the mapping points at exists', () => {
  const names = new Set(Object.values(ICON_FOR));
  const missing = [...names].filter((n) => !new RegExp(`^  ${n}:`, 'm').test(src));
  assert.deepStrictEqual(missing, [], `mapped to a drawing that does not exist: ${missing.join(', ')}`);
  return `${names.size} distinct drawings`;
});

check('one ink, one stroke, round ends and joins', () => {
  assert.strictEqual(ICON_INK, '#874C3A', 'the ink is not deep terracotta #874C3A');
  assert.strictEqual(ICON_STROKE, 1.7, 'the stroke weight is not a single constant');
  assert.ok(/strokeLinecap="round"/.test(src), 'ends are not round');
  assert.ok(/strokeLinejoin="round"/.test(src), 'joins are not round');
  // The stroke is divided by the scale so the weight is even at every size,
  // which is the whole of "one even stroke weight" once the icons differ in size.
  assert.ok(/strokeWidth=\{STROKE \/ scale\}/.test(src), 'the stroke is not corrected for scale');
  return '#874C3A, 1.7, round, scale-corrected';
});

check('nothing is filled except the one dot her drawing has', () => {
  const fills = [...src.matchAll(/fill=\{?["{]?([^"}\s]+)/g)].map((m) => m[1]);
  const solid = fills.filter((f) => f !== 'none' && f !== 'INK');
  assert.deepStrictEqual(
    [...new Set(solid)],
    [],
    `an unexpected fill: ${[...new Set(solid)].join(', ')}`
  );
  // And exactly one element carries it: the mark on the cycle ring.
  const dots = (src.match(/fill=\{INK\}/g) ?? []).length;
  assert.strictEqual(dots, 1, `expected one filled dot, found ${dots}`);
  return 'strokes only, plus the cycle ring’s single dot';
});

check('an icon is half the circle it sits in', () => {
  // HER SIZING RULE, and it is checkable because the circle and the icon are
  // drawn by the same component from the same radius. An icon placed at `r`
  // inside a circle of radius `r` is half the diameter, centred, which leaves
  // an even ring of colour around it.
  //
  // The previous version of this check counted numeric radii with a pattern,
  // which stopped matching the moment the radii became variables. It passed on
  // nothing and would have gone on passing. This reads the relationship.
  const diagrams = readFileSync('app/lib/diagrams.tsx', 'utf8');
  assert.ok(
    /<circle cx=\{cx\} cy=\{cy\} r=\{r\} fill=\{fill\} \/>/.test(diagrams),
    'the Node component no longer draws its circle from r'
  );
  assert.ok(
    /<Icon name=\{name\} cx=\{cx\} cy=\{cy\} size=\{r\} \/>/.test(diagrams),
    'the icon is no longer sized at half the circle width'
  );
  // And a label is never put inside a circle, which she asked for twice.
  assert.ok(
    !/<text[^>]*>\{label\}<\/text>\s*<circle/.test(diagrams),
    'a label was moved inside a circle'
  );
  return 'size equals radius, so the icon is half the diameter';
});

check('and this check can fail', () => {
  const broken = { ...ICON_FOR, Bananas: 'bowl' };
  const orphans = Object.keys(broken).filter((l) => !LABELS.has(l));
  assert.deepStrictEqual(orphans, ['Bananas'], 'an orphan mapping is not detected');

  const missing = ['Food', 'Sleep'].filter((l) => !{ Food: 'bowl' }[l]);
  assert.deepStrictEqual(missing, ['Sleep'], 'a missing icon is not detected');

  assert.notStrictEqual(ICON_INK, '#C97458', 'brand terracotta would pass as the ink');
  return 'an orphan, a missing icon, and the wrong ink';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
