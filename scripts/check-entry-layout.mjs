// AN EXPANDED ENTRY CONTAINS ITS BODY EXACTLY ONCE.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-entry-layout.mjs
//
// Ruth's item 7: "Test: expanded entry contains its body text exactly once.
// Prove the test fails against the current layout."
//
// So the same assertions run twice - once against the layout this file guards,
// and once against THE OLD RENDER, which drew the truncated preview, then the
// full why, then the detail, with nothing checking whether any of them were the
// same sentence. Her three cards are the fixtures, in their real wording.

import assert from 'node:assert';

import { addsNothing, expandedLayout } from '../mobile/src/lib/entry-layout.ts';

const PREVIEW_CHARS = 110;

/** The truncation the collapsed card uses, copied so the fixtures are honest. */
function previewOf(text) {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim();
  if (flat.length <= PREVIEW_CHARS) return flat;
  const cut = flat.slice(0, PREVIEW_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > PREVIEW_CHARS * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

// WHAT THE OLD LAYOUT PUT ON SCREEN when a card was expanded: the preview never
// stood down, and `detail` was drawn whatever it said.
const OLD = (card) => [previewOf(card.why || card.detail || ''), card.why, card.detail].filter(Boolean);

// WHAT IT DRAWS NOW.
const NEW = (card) => {
  const { body, latest } = expandedLayout(card);
  return [body, latest].filter(Boolean);
};

// ------------------------------------------------------------- her real cards

const CARDS = {
  Nickel: {
    why: 'Contact with nickel jewellery brings a rash up on your neck. Found out 28 September 2026 after a necklace was left on overnight by accident.',
    detail: 'Rash on neck from leaving necklace on overnight - suspected nickel reaction',
  },
  // THE FULL why, not the 160 characters a query happened to print. My first
  // fixture was the truncated version, which made the comparison easier than
  // reality: the real text already names Grazax and the GP, so the detail
  // shares far more of its vocabulary than the short version suggested. A
  // threshold tuned against truncated data is a threshold tuned against
  // nothing.
  'Seasonal Allergy Plan': {
    why: "Nasal steroids were prescribed but never tested since the pollen season ended before starting them. Antihistamines were ruled out because they worsen venous leg issues and disrupt sleep. Plan is to test nasal steroids when pollen returns, and if they don't help or the yearly reliance still doesn't sit right, use that plus the antihistamine issues to make the case to the GP for Grazax immunotherapy.",
    detail:
      'Nasal steroid prescription picked up but not yet used; Grazax application requires trying nasal steroids first per GP',
  },
  'Evening Skincare Routine': {
    why: 'Trying to keep skin looking bright and even with age, especially given freckles',
    detail: 'Retinol 1% nightly, vitamin C rotated 3-4 nights a week',
  },
};

let pass = 0;
const failures = [];
const weak = [];

const check = (name, fn) => {
  try {
    fn();
    pass += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
};

/**
 * THE CENTRAL ASSERTION. Take the first sentence of the body and count how many
 * of the rendered blocks contain it. Exactly one, or the reader is being shown
 * the same thing twice.
 */
function bodyAppearsOnce(render, card, label) {
  const blocks = render(card);
  const opening = (card.why || card.detail || '').split(/[.;]/)[0].trim().slice(0, 40).toLowerCase();
  const hits = blocks.filter((b) => (b ?? '').toLowerCase().includes(opening)).length;
  assert.equal(hits, 1, `${label}: the opening of the body appears in ${hits} blocks, expected 1`);
}

for (const [name, card] of Object.entries(CARDS)) {
  check(`${name}: body appears exactly once`, () => bodyAppearsOnce(NEW, card, name));

  // PROVE IT FAILS AGAINST THE OLD LAYOUT.
  let oldFailed = false;
  try {
    bodyAppearsOnce(OLD, card, name);
  } catch {
    oldFailed = true;
  }
  if (!oldFailed) {
    weak.push(`${name}: the old layout passed this too, so it proves nothing.`);
  }
}

// ------------------------------------------------- the second line earns its place

check('Nickel: the detail restates the why and is hidden', () => {
  assert.equal(expandedLayout(CARDS.Nickel).latest, null);
});

check('Seasonal Allergy Plan: the detail names Grazax and is kept', () => {
  const { latest } = expandedLayout(CARDS['Seasonal Allergy Plan']);
  assert.ok(latest && latest.includes('Grazax'), 'a line that adds a fact must survive');
});

check('Skincare: the routine is not the reason, so it is kept', () => {
  assert.ok(expandedLayout(CARDS['Evening Skincare Routine']).latest);
});

check('an exact repeat is hidden', () => {
  assert.ok(addsNothing('Rash on neck', 'Rash on neck from a necklace'));
});

check('a card with only a detail shows it as the body, not as an afterthought', () => {
  const { body, latest } = expandedLayout({ why: null, detail: 'Started October after a low reading' });
  assert.equal(body, 'Started October after a low reading');
  assert.equal(latest, null);
});

check('an empty card draws nothing rather than an empty label', () => {
  assert.deepEqual(expandedLayout({ why: '', detail: '' }), { body: null, latest: null });
});

check('there is no preview field to show beside the body', () => {
  assert.deepEqual(Object.keys(expandedLayout(CARDS.Nickel)).sort(), ['body', 'latest']);
});

for (const f of failures) console.error('  FAIL  ' + f);
for (const w of weak) console.error('  WEAK  ' + w);
console.log(`\n  ${pass} passed, ${failures.length} failed, ${weak.length} weak`);
if (failures.length + weak.length > 0) process.exit(1);
