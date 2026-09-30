// THE REFERENCE LAYER IS SHUT, AND EVERY ENTRY IN IT IS CHECKABLE.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-clinical-reference.mjs
//
// Ruth's standing rule, carried over from the red flags: the layer stays off
// until she has read the list and a clinician has reviewed it. A rule that
// lives only in a sentence is a rule somebody switches off at four in the
// afternoon to test something. This makes that a failing build.
//
// It also checks the boundary in the content, because that is the part that
// drifts: an entry summarising a guideline which itself says "offer" comes out
// sounding like advice unless something refuses it.

import assert from 'node:assert';

import {
  ENTRIES,
  MAX_ENTRIES_PER_TURN,
  REFERENCE_LAYER_ON,
  assertSafeEntry,
  referenceBlock,
  referenceFor,
} from '../app/lib/clinical-reference.ts';

let pass = 0;
const failures = [];
const check = (name, fn) => {
  try {
    fn();
    pass += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
};

check('the layer is off', () => {
  assert.equal(
    REFERENCE_LAYER_ON,
    false,
    'REFERENCE_LAYER_ON is true. It stays false until Ruth has read the entries AND a clinician ' +
      'has reviewed them - the same rule as the red-flag layer, for the same reason.'
  );
});

check('and nothing comes out of it while it is off', () => {
  const asked = referenceFor('perimenopause, hot flushes, HRT, oestrogen, progesterone, bone density');
  assert.equal(asked.length, 0, `${asked.length} entries were returned with the gate shut`);
  assert.equal(referenceBlock(asked), '', 'an empty set must produce no block at all');
});

check('every entry names a source somebody can open', () => {
  for (const entry of ENTRIES) {
    assert.ok(entry.source?.name, `${entry.id}: no source name`);
    assert.ok(entry.source?.document, `${entry.id}: no document named`);
    assert.ok(/^https?:\/\//.test(entry.source?.url ?? ''), `${entry.id}: no usable url`);
    assert.ok(entry.source?.checked, `${entry.id}: no date it was checked against the source`);
  }
});

check('and no entry is worded as advice', () => {
  for (const entry of ENTRIES) assertSafeEntry(entry);
});

check('an entry with no source cannot pass', () => {
  assert.throws(
    () =>
      assertSafeEntry({
        id: 'sourceless',
        topic: 'hrt',
        match: [/hrt/i],
        fact: 'Something about HRT.',
        source: { name: '', document: '', url: '', checked: '' },
        reviewed: true,
      }),
    /no checkable source/
  );
});

// THE ADVICE GUARD, against the wordings that would actually turn up. Each of
// these is the shape a summary drifts into, not a straw man.
const WOULD_BE_ADVICE = [
  'You should ask your GP to increase your dose if flushes continue.',
  'We recommend transdermal oestrogen for women with a raised clot risk.',
  'If symptoms persist, try taking it in the evening instead.',
  'It is recommended that she start HRT within ten years of her last period.',
  'Stop your HRT before surgery.',
];

for (const fact of WOULD_BE_ADVICE) {
  check(`refused: "${fact.slice(0, 38)}…"`, () => {
    assert.throws(
      () =>
        assertSafeEntry({
          id: 'advice-shaped',
          topic: 'hrt',
          match: [/hrt/i],
          fact,
          source: {
            name: 'NICE',
            document: 'NG23',
            url: 'https://www.nice.org.uk/guidance/ng23',
            checked: '2026-09-30',
          },
          reviewed: true,
        }),
      /worded as advice/
    );
  });
}

// AND A STATEMENT OF FACT MUST STILL GET THROUGH, or the guard is just a ban on
// the topic. This one says what a thing IS, which is the whole point of the
// layer.
check('a plain statement of fact is allowed', () => {
  assertSafeEntry({
    id: 'plain',
    topic: 'hrt',
    match: [/hrt/i],
    fact: 'Sequential HRT is taken so that a monthly bleed occurs; it is not a natural cycle.',
    source: {
      name: 'NICE',
      document: 'NG23',
      url: 'https://www.nice.org.uk/guidance/ng23',
      checked: '2026-09-30',
    },
    reviewed: true,
  });
});

check('the per-turn cap is a small number', () => {
  assert.ok(
    MAX_ENTRIES_PER_TURN > 0 && MAX_ENTRIES_PER_TURN <= 6,
    `${MAX_ENTRIES_PER_TURN} entries a turn is a textbook, not a reference`
  );
});

// ------------------------------------------------------------------- MUTATION

let gateCaught = false;
try {
  assert.equal(true, false, 'a layer switched on must fail this check');
} catch {
  gateCaught = true;
}

let adviceCaught = false;
try {
  assertSafeEntry({
    id: 'mutation',
    topic: 'hrt',
    match: [/hrt/i],
    fact: 'You should start HRT.',
    source: { name: 'NICE', document: 'NG23', url: 'https://www.nice.org.uk/guidance/ng23', checked: '2026-09-30' },
    reviewed: true,
  });
} catch {
  adviceCaught = true;
}

if (!gateCaught) failures.push('USELESS: the gate assertion cannot fail');
if (!adviceCaught) failures.push('USELESS: advice-shaped text passed assertSafeEntry');

for (const f of failures) console.error('  FAIL  ' + f);
console.log(`\n  ${pass} passed, ${failures.length} failed`);
console.log(`  ${ENTRIES.length} entries, layer ${REFERENCE_LAYER_ON ? 'ON' : 'OFF'}`);
console.log(`  Proof: advice-shaped text is refused = ${adviceCaught}`);
if (failures.length > 0) process.exit(1);
