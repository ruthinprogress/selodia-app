// A ME CARD MADE OF PARTS, tested against the behaviour that produced the bug.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-me-items.mjs
//
// Ruth, 29 September 2026, on the skincare card: "text repeated three times,
// status history mixed into the body, no per-item view, contradictory lines
// (20 Sept 'retinol nightly' vs 29 Sept 'alternating'), and an outcome she
// never stated."
//
// EVERY CHECK IS RUN TWICE: once against the real functions, once against THE
// OLD BEHAVIOUR - a card that can only append prose to its history, which is
// exactly what updateMeCard could do and all it could do. A check the old
// behaviour passes would not have caught any of this, and this file says so
// rather than counting it.

import assert from 'node:assert';

import {
  archiveProse,
  changeNote,
  coerceItem,
  coerceItems,
  collapseSameDay,
  itemKey,
  itemsOf,
  mergeItems,
} from '../app/lib/me-items.ts';

// HOW IT BEHAVED BEFORE. A card could change status and append a reason to its
// history; there was no items array and no merge. Everything new arrived as one
// more paragraph.
const OLD = {
  // THE OLD WORLD HAD NO ITEMS ARRAY. Not a worse merge - no merge, and
  // nowhere for an item to be. Everything she said arrived as one more
  // paragraph in the status history, which is the whole bug.
  //
  // The first version of this stub concatenated the two lists, and the harness
  // correctly called the multi-item group WEAK: concatenating into an empty
  // card produces the right answer by accident, so the check proved nothing.
  // Modelling the old behaviour honestly is what makes these checks evidence.
  mergeItems: () => ({ items: [], changes: [] }),
  collapseSameDay: (history) => history,
  archiveProse: (content) => ({ content, archived: null }),
  coerceItems: (v) => (Array.isArray(v) ? v : []),
};

let pass = 0;
const failures = [];
const weak = [];

function group(name, run) {
  // Against the real implementation.
  const before = failures.length;
  run({ mergeItems, collapseSameDay, archiveProse, coerceItems });
  const realFailed = failures.length > before;

  // Against the old behaviour. At least one check must break, or the group is
  // not testing the thing that was wrong.
  const mark = failures.length;
  const passMark = pass;
  run(OLD);
  const oldFailed = failures.length > mark;
  failures.length = mark;
  pass = passMark;

  if (!realFailed && !oldFailed) {
    weak.push(`${name}: every check passed against the OLD behaviour too, so it proves nothing.`);
  }
}

function check(name, fn) {
  try {
    fn();
    pass += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

// ------------------------------------------------- the three skincare products

const HERS = [
  { name: 'Niacinamide', when: 'AM', purpose: 'Barrier support, redness, pores' },
  { name: 'Vitamin C (Ascorbyl Glucoside)', when: 'PM, alternating', purpose: 'Fine lines, pigmentation' },
  { name: 'Retinol 1%', when: 'PM, alternating', purpose: 'Fine lines, pores' },
];

group('multi-item add', (impl) => {
  const { items } = impl.mergeItems([], HERS);
  check('three products become three items', () => {
    assert.equal(items.length, 3);
  });
  check('each keeps its own when and purpose', () => {
    assert.equal(items[0].when, 'AM');
    assert.equal(items[2].when, 'PM, alternating');
    assert.ok(items[1].purpose);
  });
  check('nothing is repeated', () => {
    const names = items.map((i) => itemKey(i.name));
    assert.equal(new Set(names).size, names.length);
  });
});

group('adding to an existing card', (impl) => {
  const existing = [HERS[0]];
  const { items, changes } = impl.mergeItems(existing, [HERS[1], HERS[2]]);
  check('the card grows to three', () => {
    assert.equal(items.length, 3);
  });
  check('the original is untouched', () => {
    assert.equal(items[0].name, 'Niacinamide');
    assert.equal(items[0].when, 'AM');
  });
  check('the additions are reported as added', () => {
    assert.equal(changes.filter((c) => c.kind === 'added').length, 2);
  });
});

group('a contradiction replaces rather than accumulates', (impl) => {
  // 20 September: retinol nightly. 29 September: alternating.
  const before = [{ name: 'Retinol 1%', when: 'nightly', purpose: 'Fine lines' }];
  const { items, changes } = impl.mergeItems(before, [
    { name: 'Retinol 1%', when: 'PM, alternating', purpose: null },
  ]);
  check('it is still ONE retinol, not two', () => {
    assert.equal(items.filter((i) => itemKey(i.name) === 'retinol 1').length, 1);
  });
  check('the newer timing wins', () => {
    assert.equal(items[0].when, 'PM, alternating');
  });
  check('the older timing is recorded, not silently dropped', () => {
    const note = changeNote(changes) ?? '';
    assert.ok(note.includes('nightly'), `the change note should name what it replaced, got: ${note}`);
  });
  check('a field she did NOT restate is left alone', () => {
    assert.equal(items[0].purpose, 'Fine lines');
  });
});

group('same-day status flips collapse', (impl) => {
  const history = [
    { date: '', status: 'Active', reason: null },
    { date: '2026-09-29', status: 'Active', reason: 'Alternating vitamin C and retinol' },
    { date: '2026-09-29', status: 'Paused', reason: null },
    { date: '2026-09-29', status: 'Active', reason: null },
  ];
  const out = impl.collapseSameDay(history);
  check('the bare flips become one', () => {
    assert.equal(out.length, 3, `expected the two bare 29 Sept rows to collapse, got ${out.length}`);
  });
  check('the reason she gave survives', () => {
    assert.ok(out.some((e) => (e.reason ?? '').includes('Alternating')));
  });
  check('the last state of the day is the one kept', () => {
    assert.equal(out[out.length - 1].status, 'Active');
  });
});

group('the old prose is archived, not deleted', (impl) => {
  const content = {
    why: 'Bright, even skin',
    detail: 'Retinol 1% nightly, vitamin C rotated 3-4 nights a week',
    history: [],
  };
  const { content: next, archived } = impl.archiveProse({ ...content }, '2026-09-29');
  check('it leaves the body', () => {
    assert.equal(next.detail, undefined, 'the contradictory prose must not stay in the body');
  });
  check('it is still on the card, in history', () => {
    assert.ok(archived);
    assert.ok(JSON.stringify(next.history).includes('nightly'));
  });
});

// ------------------------------------------------------ stated facts only
//
// This one is about what the SHAPE allows, not about a model's wording. An item
// has a name, a when, a purpose and a detail. There is no field for a result,
// so "already seeing redness reduce" has nowhere to be written even if a model
// offers it - which is a stronger guarantee than asking a prompt not to.

check('there is no outcome field to write an outcome into', () => {
  const item = coerceItem({
    name: 'Retinol 1%',
    when: 'PM',
    purpose: 'Fine lines',
    outcome: 'already seeing redness reduce',
    result: 'working well',
  });
  assert.deepEqual(Object.keys(item).sort(), ['name', 'purpose', 'when']);
});

check('an item with no name is dropped rather than invented', () => {
  assert.equal(coerceItem({ when: 'PM', purpose: 'Fine lines' }), null);
});

check('the same item listed twice in one instruction is one item', () => {
  const items = coerceItems([{ name: 'Retinol' }, { name: 'retinol' }]);
  assert.equal(items.length, 1);
});

check('itemsOf survives a card that has no items yet', () => {
  assert.deepEqual(itemsOf({ why: 'x' }), []);
  assert.deepEqual(itemsOf(null), []);
});

// ------------------------------------------------------------------- THE COPY
//
// mobile/src/lib/me-items.ts is a narrow read-only copy of this module, because
// the mobile bundle has no path to app/lib. A copy that can drift is a copy
// that will, so the two field lists are compared here: if either side gains or
// loses a field, this fails rather than letting the app quietly stop showing
// something the server writes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const fields = (file) => {
  // Line endings normalised first: `.` does not match \r, and this repository
  // has already lost a day to a check that only worked on LF files.
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\r\n').join('\n');
  const block = src.match(/export type MeItem = \{([\s\S]*?)\};/);
  if (!block) return null;
  return [...block[1].matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]).sort();
};

const server = fields('app/lib/me-items.ts');
const app = fields('mobile/src/lib/me-items.ts');
check('the app copy of MeItem has not drifted', () => {
  assert.ok(server, 'could not read MeItem from app/lib/me-items.ts');
  assert.ok(app, 'could not read MeItem from mobile/src/lib/me-items.ts');
  assert.deepEqual(app, server, `app copy has [${app}], server has [${server}]`);
});

for (const f of failures) console.error('  FAIL  ' + f);
for (const w of weak) console.error('  WEAK  ' + w);
console.log(`\n  ${pass} passed, ${failures.length} failed, ${weak.length} weak`);
if (failures.length + weak.length > 0) process.exit(1);
