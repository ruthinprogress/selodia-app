// THE LIST OF MOVEMENTS TO DRAW, CANONICAL AND DEDUPED.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/illustration-list.mjs
//
// scope-illustration-gaps.mjs answers "what is missing". This answers the next
// question, which is "what should somebody actually draw", and they are not
// the same list.
//
// WHY NOT JUST DRAW THE MISSING NAMES. Because the missing names are whatever
// the model happened to write into a plan: "Slow standing calf raise holding a
// dumbbell", "Rotating Cossack Squat (hands-free, full depth)", and
// "Side-Lying Leg Lift" alongside "side-lying leg lift". Drawn verbatim that is
// the same movement twice, with titles nobody would put on a card.
//
// So the drawing list is CANONICAL - one clean name per movement - and the
// app's own movement_aliases table maps the model's phrasing onto it. That is
// what the alias table is for, it already exists, and it means a plan saying
// "slow standing calf raise holding a dumbbell" finds the picture called
// "standing calf raise" without anybody drawing a second one.
//
// Read-only. Prints the list and the aliases that would be needed.

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/**
 * The mechanical part: case, bracketed asides, and the adverbs a model adds.
 * Everything this cannot settle is in NAMED below, by hand, because a rule
 * that renames movements by pattern is how "kettlebell romanian deadlift"
 * became the single-leg variant.
 */
function tidy(name) {
  return name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(slow|slowly|gentle|basic|standing)\s+(?=\w)/gi, (m, w) =>
      // "standing" is part of the movement in a standing calf raise and noise
      // in "standing hip abduction"; only the hedging adverbs go.
      /^(slow|slowly|gentle|basic)$/i.test(w) ? '' : m
    )
    .replace(/\s+holding a [a-z]+$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** The ones a rule would get wrong, settled by hand. */
const NAMED = new Map([
  ['rotating cossack squat', 'cossack squat'],
  ['wall-supported middle split slide', 'middle splits at the wall'],
  ['wall-supported middle splits', 'middle splits at the wall'],
  ['world greatest stretch', "world's greatest stretch"],
  ['lying dumbbell hamstring curl', 'lying hamstring curl'],
  ['sumo squat', 'sumo squat'],
]);

const canonical = (name) => {
  const t = tidy(name);
  return NAMED.get(t) ?? t;
};

const { data: planRows } = await supabase
  .from('almanac_entries')
  .select('content')
  .ilike('kind', '%plan%');

const prescribed = new Map(); // canonical -> the raw names that map to it
for (const row of planRows ?? []) {
  for (const ex of row.content?.exercises ?? []) {
    if (ex.demoRef) continue;
    const raw = String(ex.name ?? '').trim();
    if (!raw) continue;
    const key = canonical(raw);
    if (!prescribed.has(key)) prescribed.set(key, new Set());
    if (raw.toLowerCase() !== key) prescribed.get(key).add(raw);
  }
}

console.log(`\n  ALREADY PRESCRIBED, SO THESE COME FIRST  (${prescribed.size} to draw)\n`);
for (const [name, aliases] of [...prescribed].sort()) {
  console.log(`  ${name}`);
  for (const a of aliases) console.log(`        alias: ${a}`);
}

const raw = [...prescribed.values()].reduce((n, s) => n + s.size, 0);
console.log(
  `\n  ${prescribed.size} drawings cover ${prescribed.size + raw} names the model has actually written.` +
    `\n  The ${raw} extra are aliases, which cost a row each and no artwork.\n`
);
