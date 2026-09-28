// DOES THE PRICING ACTUALLY PRICE? Run it and check the arithmetic by hand.
//
// A money function that is wrong is worse than one that does not exist, because
// a number on a page gets believed. So every case here has its expected value
// worked out from the published rate card separately, in the comment above it,
// rather than from what the function returned.
//
// AND EVERY CHECK IS PROVED ABLE TO FAIL. The last line runs the whole set
// against a deliberately broken pricing function and refuses to pass unless all
// of them fail. A check that cannot fail is decoration.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-model-cost.mjs

import { callCostMicroCents } from '../app/lib/model-cost.ts';

const SONNET = 'claude-sonnet-5';
const HAIKU = 'claude-haiku-4-5-20251001';

// Micro-cents: dollars x 100 x 1,000,000.
const CASES = [
  {
    name: 'a plain Sonnet call, no cache',
    // 1,000,000 in at $2/M = $2. 1,000,000 out at $10/M = $10. $12 = 1.2e9 mc.
    model: SONNET,
    usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 },
    expect: 1_200_000_000,
  },
  {
    name: 'a cached read costs a tenth of fresh input',
    // 1,000,000 cache_read at $0.20/M = $0.20 = 2e7 mc. Nothing else.
    model: SONNET,
    usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000 },
    expect: 20_000_000,
  },
  {
    name: 'a cache write costs a quarter more than fresh input',
    // 1,000,000 cache_write at $2.50/M = $2.50 = 2.5e8 mc.
    model: SONNET,
    usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 1_000_000 },
    expect: 250_000_000,
  },
  {
    name: 'Haiku is half of Sonnet',
    // 1,000,000 in at $1/M plus 1,000,000 out at $5/M = $6 = 6e8 mc.
    model: HAIKU,
    usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 },
    expect: 600_000_000,
  },
  {
    name: 'a real cached classify turn',
    // 8,228 cached read at $0.20/M = $0.0016456
    // 6,000 fresh in at $2/M      = $0.012
    // 65 out at $10/M             = $0.00065
    //                        total  $0.0142956 -> 1.42956 cents -> 1,429,560 mc
    model: SONNET,
    usage: {
      input_tokens: 6_000,
      output_tokens: 65,
      cache_read_input_tokens: 8_228,
      cache_creation_input_tokens: 0,
    },
    expect: 1_429_560,
  },
  {
    name: 'nulls are not NaN',
    // The SDK sends null rather than 0 when there is no cache. 1,000 in at $2/M
    // plus 100 out at $10/M = $0.003 = 300,000 mc.
    model: SONNET,
    usage: {
      input_tokens: 1_000,
      output_tokens: 100,
      cache_read_input_tokens: null,
      cache_creation_input_tokens: null,
    },
    expect: 300_000,
  },
  {
    name: 'an unknown model is null, not zero',
    model: 'claude-something-nobody-priced',
    usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 },
    expect: null,
  },
  {
    name: 'a call that did nothing costs nothing',
    model: SONNET,
    usage: { input_tokens: 0, output_tokens: 0 },
    expect: 0,
  },
];

function run(price) {
  const failures = [];
  for (const c of CASES) {
    const got = price(c.model, c.usage);
    if (got !== c.expect) failures.push(`${c.name}: expected ${c.expect}, got ${got}`);
  }
  return failures;
}

const failures = run(callCostMicroCents);
for (const c of CASES) {
  const got = callCostMicroCents(c.model, c.usage);
  console.log(`  ${got === c.expect ? 'PASS' : 'FAIL'}  ${c.name}`);
}

// COULD ANY OF THEM HAVE FAILED? A pricing function that returns the same thing
// for everything would pass a badly written set, and a set that cannot fail is
// worth nothing. This one is broken on purpose.
//
// THE SENTINEL IS -1 AND NOT 0, and the first version used 0 and caught itself:
// the case "a call that did nothing costs nothing" legitimately expects 0, so it
// passed against the broken pricer and the run correctly refused. A value no
// case can honestly hold is the only one that proves anything.
const broken = run(() => -1);
if (broken.length !== CASES.length) {
  console.error(
    `\n  THE CHECKS ARE NOT REAL. Against a pricing function that returns -1 for\n` +
      `  everything, ${CASES.length - broken.length} of ${CASES.length} still passed.\n`
  );
  process.exit(1);
}
console.log(`\n  all ${CASES.length} fail against a broken pricer, so they can fail`);

if (failures.length > 0) {
  console.error('\n  FAILURES\n');
  for (const f of failures) console.error('    ' + f);
  process.exit(1);
}
console.log('  all checks passed\n');
