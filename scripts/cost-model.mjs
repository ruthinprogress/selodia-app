// WHAT A TURN ACTUALLY COSTS, from measured token counts rather than guesses.
// Sonnet 5: $2/M in, $10/M out, cache write 1.25x in, cache read 0.1x in.
// Haiku 4.5: $1/M in, $5/M out.
const S = { in: 2, out: 10, cacheWrite: 2.5, cacheRead: 0.2 };
const H = { in: 1, out: 5 };
const USD_GBP = 0.79;

const m = (n) => n / 1_000_000;

// A TYPED CHAT TURN, new path. Numbers from this week's probes and the audit.
const classify = {
  cachedIn: 8228,   // conduct + tool, measured 24 Sept
  freshIn: 6000,    // her data, history, the turn's own blocks
  out: 65,          // with the reply asked as a fallback (measured today)
};
const writer = {
  cachedIn: 3351,   // rebuilt prompt + safety block (measured today)
  freshIn: 900,     // facts + the last 8 turns
  out: 90,          // a sentence or two
};
const extraction = { in: 1200, out: 250 };  // Haiku, only on a logging turn

// `in` for a call with no cache, `freshIn` for the uncached half of a cached
// one. The first version used `c.freshIn ?? c.in` and the Haiku call has
// neither name matching, which produced NaN and then NaN everywhere downstream.
const call = (p, c) =>
  // (p.cacheRead ?? 0), because Haiku has no cacheRead here and 0 * undefined
  // is NaN rather than 0 - which is how one missing field turned every figure
  // in the table into NaN and looked like a pricing bug.
  m(c.cachedIn ?? 0) * (p.cacheRead ?? 0) + m(c.freshIn ?? c.in ?? 0) * p.in + m(c.out ?? 0) * p.out;

const turnChat = call(S, classify) + call(S, writer);
const turnLogging = turnChat + call(H, extraction);
const roundup = call(S, { freshIn: 9000, out: 700 });

console.log('\n  PER CALL, in US cents\n');
const c = (v) => (v * 100).toFixed(3) + 'c';
console.log('    classify (cached)        ', c(call(S, classify)));
console.log('    reply writer (cached)    ', c(call(S, writer)));
console.log('    extraction (Haiku)       ', c(call(H, extraction)));
console.log('    a plain chat turn        ', c(turnChat));
console.log('    a logging turn           ', c(turnLogging));
console.log('    a weekly roundup         ', c(roundup));

// USAGE. Ruth's own week is the only real sample: 13 turns on her busiest day,
// and 359 assistant replies across 14 days = ~26 a day. She is the heaviest
// imaginable user, so she is the ceiling rather than the average.
const profiles = [
  { name: 'heavy (Ruth)', turnsPerDay: 26, loggingShare: 0.6 },
  { name: 'engaged', turnsPerDay: 8, loggingShare: 0.6 },
  { name: 'typical', turnsPerDay: 3, loggingShare: 0.7 },
  { name: 'lapsed', turnsPerDay: 0.5, loggingShare: 0.8 },
];

console.log('\n  PER USER PER MONTH, models only, in GBP\n');
for (const p of profiles) {
  const perDay = p.turnsPerDay * (p.loggingShare * turnLogging + (1 - p.loggingShare) * turnChat);
  const month = perDay * 30 + roundup * 4.3;
  console.log(`    ${p.name.padEnd(14)} ${p.turnsPerDay} turns/day   $${month.toFixed(3)}   £${(month * USD_GBP).toFixed(3)}`);
}

// A MIX. Most people are not Ruth.
const mix = [
  { share: 0.05, turnsPerDay: 26, loggingShare: 0.6 },
  { share: 0.20, turnsPerDay: 8, loggingShare: 0.6 },
  { share: 0.45, turnsPerDay: 3, loggingShare: 0.7 },
  { share: 0.30, turnsPerDay: 0.5, loggingShare: 0.8 },
];
let blended = 0;
for (const p of mix) {
  const perDay = p.turnsPerDay * (p.loggingShare * turnLogging + (1 - p.loggingShare) * turnChat);
  blended += p.share * (perDay * 30 + roundup * 4.3);
}
console.log(`\n  BLENDED AVERAGE   $${blended.toFixed(3)}/user/month   £${(blended * USD_GBP).toFixed(3)}\n`);
console.log(`  (5% heavy, 20% engaged, 45% typical, 30% lapsed)\n`);
