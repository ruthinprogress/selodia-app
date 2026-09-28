// DOES THE SINK STAY SILENT UNTIL IT IS TOLD NOT TO?
//
// This is the piece that decides whether words reach somebody's ear before the
// checks that could have stopped them. Every case below is a rule that, if it
// broke, would mean a person heard something the app had not finished deciding.
//
// Each check is run twice: once against the real sink, and once against a
// deliberately broken one that emits everything the moment it arrives. If a
// check passes against THAT, it was not checking anything.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-voice-sink.mjs

import { createVoiceSink, splitSpeakable } from '../app/lib/voice-sink.ts';

// A sink with the safety taken out: it speaks as soon as it is spoken to.
function leakySink() {
  const queue = [];
  let wake = null;
  let closed = false;
  let emitted = '';
  const emit = (t) => {
    if (!t) return;
    emitted += t;
    queue.push(t);
    wake?.();
    wake = null;
  };
  return {
    push: (t) => emit(t),
    open: () => {},
    isOpen: () => true,
    // NAIVE ON PURPOSE, IN BOTH WAYS. The first version of this kept the
    // divergence guard and only removed the open/closed gate, so the case about
    // a blocked reply passed against it and the run correctly refused. A stand-in
    // for "somebody rewrote this without the care" has to be missing ALL of the
    // care, or it quietly agrees with the real thing about half the rules.
    finish: (final) => {
      emit(final);
      closed = true;
      wake?.();
      wake = null;
    },
    abandon: () => {
      closed = true;
      wake?.();
      wake = null;
    },
    async *read() {
      for (;;) {
        while (queue.length) yield queue.shift();
        if (closed) return;
        await new Promise((r) => (wake = r));
      }
    },
  };
}

async function collect(sink, drive) {
  const heard = [];
  const reading = (async () => {
    for await (const piece of sink.read()) heard.push(piece);
  })();
  await drive(sink);
  await reading;
  return heard.join('');
}

const CASES = [
  {
    name: 'a sink that is never opened says nothing at all',
    // The turn was not ordinary, or the guess was discarded, or the person has a
    // food allergy. The reply is written and the app speaks none of it.
    drive: async (s) => {
      s.push('Half a lager, ');
      s.push('and you could try the pad thai.');
      s.finish('Half a lager, and you could try the pad thai.');
    },
    expect: '',
  },
  {
    name: 'opening late still says everything from the beginning',
    drive: async (s) => {
      s.push('Food is logged ');
      s.push('three days running.');
      s.open();
      s.finish('Food is logged three days running.');
    },
    expect: 'Food is logged three days running.',
  },
  {
    name: 'words written after opening go straight out',
    drive: async (s) => {
      s.push('Water is low ');
      s.open();
      s.push('today.');
      s.finish('Water is low today.');
    },
    expect: 'Water is low today.',
  },
  {
    name: 'the offer line the route appends is spoken, and only once',
    drive: async (s) => {
      s.push('Protein averaged 69g.');
      s.open();
      s.finish('Protein averaged 69g.\n\nWant me to save this to your Almanac?');
    },
    expect: 'Protein averaged 69g.\n\nWant me to save this to your Almanac?',
  },
  {
    name: 'a stored reply that diverges from what was spoken adds nothing',
    // Unreachable by design and checked anyway: saying the replacement after the
    // original would mean the person hears both.
    drive: async (s) => {
      s.push('Try the satay.');
      s.open();
      s.finish('What I had in mind does not work with your peanut allergy.');
    },
    expect: 'Try the satay.',
  },
  {
    name: 'abandoning after opening stops there rather than replaying',
    drive: async (s) => {
      s.push('Sleep was ');
      s.open();
      s.push('six hours.');
      s.abandon();
    },
    expect: 'Sleep was six hours.',
  },
  {
    name: 'nothing arrives after finish',
    drive: async (s) => {
      s.push('Done.');
      s.open();
      s.finish('Done.');
      s.push(' And another thing.');
    },
    expect: 'Done.',
  },
];

async function run(make) {
  const failures = [];
  for (const c of CASES) {
    const heard = await collect(make(), c.drive);
    if (heard !== c.expect) {
      failures.push(`${c.name}\n        expected ${JSON.stringify(c.expect)}\n        heard    ${JSON.stringify(heard)}`);
    }
  }
  return failures;
}

// ── THE SPLITTER, WHICH IS WHERE THE BUG WAS ────────────────────────────────
//
// The first version stripped the whitespace after each terminator, so the voice
// said "your record.If something's going on" with no gap - and, far worse, what
// had been spoken was no longer a PREFIX of what was stored, so the sink read
// every multi-sentence reply as a divergence and never spoke the offer line at
// the end of it. Heard in a real measured turn before it was read in the code.
const SPLITS = [
  {
    name: 'nothing is lost, so what is spoken is a prefix of what is stored',
    input: 'Food is logged. Protein averaged 69g. Water is low.',
  },
  { name: 'a newline between sentences survives', input: 'Done.\n\nWant me to save that?' },
  { name: 'one sentence, no trailing space', input: 'Sleep was six hours.' },
  { name: 'mid-sentence text waits', input: 'Food is logged and the prot' },
  { name: 'a decimal point is not a full stop', input: 'You averaged 69.4g of protein' },
];

let splitFailures = 0;
for (const c of SPLITS) {
  const { cuts, rest } = splitSpeakable(c.input);
  const rebuilt = cuts.join('') + rest;
  const ok = rebuilt === c.input;
  if (!ok) splitFailures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
  if (!ok) console.log(`        in  ${JSON.stringify(c.input)}\n        out ${JSON.stringify(rebuilt)}`);
}

// The old splitter, exactly as it was, so the case above is known to catch it.
function lossySplit(pending) {
  const cuts = [];
  let rest = pending;
  for (;;) {
    const at = rest.search(/[.!?\n]\s|[.!?]$/);
    if (at < 0) break;
    cuts.push(rest.slice(0, at + 1));
    rest = rest.slice(at + 1).replace(/^\s+/, '');
  }
  return { cuts, rest };
}
const lossyCaught = SPLITS.filter((c) => {
  const { cuts, rest } = lossySplit(c.input);
  return cuts.join('') + rest !== c.input;
});
if (lossyCaught.length === 0) {
  console.error('\n  THE SPLIT CHECKS ARE NOT REAL. The version that lost the space passed them.\n');
  process.exit(1);
}
console.log(`\n  ${lossyCaught.length} of them fail against the splitter that lost the space\n`);

const failures = await run(createVoiceSink);
for (const c of CASES) {
  const heard = await collect(createVoiceSink(), c.drive);
  console.log(`  ${heard === c.expect ? 'PASS' : 'FAIL'}  ${c.name}`);
}

// COULD THESE FAIL? Against a sink with no gate on it, the cases that exist to
// prove silence must break. Not all of them will - "words written after opening
// go straight out" is true of a leaky sink too, and that is fine: what matters
// is that the ones about NOT speaking are really checking something.
const leaked = await run(leakySink);
const silenceCases = ['a sink that is never opened says nothing at all', 'a stored reply that diverges'];
const caught = silenceCases.filter((name) => leaked.some((f) => f.startsWith(name.slice(0, 30))));
if (caught.length !== silenceCases.length) {
  console.error(
    '\n  THE CHECKS ARE NOT REAL. Against a sink that speaks everything the moment\n' +
      `  it arrives, only ${caught.length} of ${silenceCases.length} silence cases failed.\n`
  );
  process.exit(1);
}
console.log(`\n  the ${silenceCases.length} silence cases fail against a sink with no gate, so they can fail`);

if (failures.length > 0) {
  console.error('\n  FAILURES\n');
  for (const f of failures) console.error('    ' + f + '\n');
  process.exit(1);
}
console.log('  all checks passed\n');
