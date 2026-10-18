// THE CHAT KNOWS WHAT WE HAVE DRAWN, AND KNOWS IT ACCURATELY.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-movement-catalogue.mjs
//
// Ruth, 18 October 2026, on a Handstand Skills plan the chat had just written
// her: "It cant see what the library is planning to hold, illustrations wise,
// or even what it actually holds. Some plans might be half empty because of
// this. I thought we set it up to prefer items with video or illustrations - it
// doesnt seem to do that."
//
// All five movements in that plan had neither a clip nor a drawing. The library
// held a complete seven-stage handstand ladder at the time. There was no
// preference rule to be broken, either: it had never been written.
//
// Two things can go wrong now and both are silent, which is why they are
// checked rather than trusted:
//
//   THE CATALOGUE DRIFTS. It is generated into a file so the cached half of
//   the prompt stays byte-identical between turns. A generated file that
//   nothing compares against the source is a file that goes quietly out of
//   date - which is exactly what happened to the illustration brief earlier
//   the same day.
//
//   THE NAMES STOP RESOLVING. The catalogue is only useful if a name the model
//   copies out of it actually finds the drawing. Every name here is run
//   through the real resolver.

import assert from 'node:assert';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) {
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const mod = pathToFileURL(path.join(process.cwd(), 'app', 'lib', 'movement-catalogue.ts')).href;
const { DRAWN_MOVEMENTS, DRAWN_COUNT } = await import(mod);

let pass = 0;
const failures = [];
async function check(name, fn) {
  try {
    const note = await fn();
    console.log(`  PASS  ${name}${note ? `   ${note}` : ''}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL  ${name}\n          ${e.message}`);
    failures.push(name);
  }
}

console.log('\n  WHAT THE CHAT IS TOLD WE HAVE DRAWN\n');

/** Every movement name written in the catalogue block. */
function namesInCatalogue() {
  const names = [];
  for (const line of DRAWN_MOVEMENTS.split('\n')) {
    const after = line.slice(line.indexOf(':') + 1);
    for (const part of after.split(';')) {
      const n = part.trim();
      if (n) names.push(n);
    }
  }
  return names;
}

await check('the catalogue matches the library exactly', async () => {
  const { data, error } = await supabase
    .from('movement_illustrations')
    .select('join_key, progression, stage')
    .order('progression')
    .order('stage');
  assert.ok(!error, error?.message);

  const live = data.map((r) => r.join_key).sort();
  const told = namesInCatalogue().sort();

  const missing = live.filter((n) => !told.includes(n));
  const invented = told.filter((n) => !live.includes(n));
  assert.deepStrictEqual(missing, [], `drawn but the chat is not told: ${missing.join(', ')}`);
  assert.deepStrictEqual(invented, [], `the chat is told about undrawn movements: ${invented.join(', ')}`);
  assert.strictEqual(DRAWN_COUNT, data.length, 'DRAWN_COUNT is stale');
  return `${live.length} drawings, none missing, none invented`;
});

await check('AND EVERY NAME IN IT ACTUALLY RESOLVES', async () => {
  // The catalogue is a list of names the model is told to copy verbatim. If a
  // name in it does not find its own drawing, the instruction is worse than
  // useless - it produces a confident plan with empty cards.
  const names = namesInCatalogue();
  const { data, error } = await supabase.rpc('resolve_illustration_refs', { names });
  assert.ok(!error, error?.message);
  const found = new Map(data.map((r) => [r.input_name, r.join_key]));
  const dead = names.filter((n) => !found.get(n));
  assert.deepStrictEqual(dead, [], `names the chat would copy that find nothing: ${dead.join(', ')}`);
  return `${names.length} names, all resolving`;
});

await check('the progressions are in stage order, because the order is the point', async () => {
  // A ladder read out of sequence is a list of exercises. The model is shown
  // "in order" and has to be able to rely on it.
  const { data } = await supabase
    .from('movement_illustrations')
    .select('join_key, progression, stage')
    .order('progression')
    .order('stage');

  for (const line of DRAWN_MOVEMENTS.split('\n')) {
    const progression = line.slice(2, line.indexOf(',')).trim();
    const told = line.slice(line.indexOf(':') + 1).split(';').map((s) => s.trim());
    const live = data.filter((r) => r.progression === progression).map((r) => r.join_key);
    assert.deepStrictEqual(told, live, `${progression} is out of order in the catalogue`);
  }
  return '4 progressions, each in stage order';
});

await check('THE PREFERENCE IS A TIE-BREAK, AND SAYS SO', async () => {
  // Ruth's instruction, 18 October: "Prefer covered movements if one is pretty
  // much as useful for the request." The danger in a preference is that it
  // becomes a constraint - a handstand plan built from the seven stages we
  // happen to have drawn would be a worse plan than the right movements with
  // no pictures. So the limit is written beside the preference, not left to
  // the model's judgement.
  const route = fs.readFileSync('app/api/ask-selodia/route.ts', 'utf8');
  assert.ok(
    /WOULD SERVE THE REQUEST ABOUT EQUALLY WELL, PICK THE ONE ON THAT LIST/.test(route),
    'the preference instruction is gone'
  );
  assert.ok(/IT IS A TIE-BREAK AND NOTHING MORE/.test(route), 'the limit on the preference is gone');
  assert.ok(
    /Never build a plan around what happens to be drawn/.test(route),
    'nothing stops the preference becoming a constraint'
  );
  assert.ok(
    /never mention this list/.test(route),
    'the model may now explain its choices to the person, which is noise'
  );
  return 'preference stated, and bounded';
});

await check('and it is told to copy the name exactly', async () => {
  // The naming lesson from earlier the same day, in the one place it decides
  // whether a drawing is ever found. "tuck handstand hold, pressed from crow"
  // is a rung; "tuck handstand hold" is the join key.
  const route = fs.readFileSync('app/api/ask-selodia/route.ts', 'utf8');
  assert.ok(/name it EXACTLY as it is written there/.test(route), 'exact naming is no longer required');
  assert.ok(
    /Do not add the entry method, the equipment or a qualifier/.test(route),
    'nothing forbids decorating the name'
  );
  // The worked example has to be a real one, or it teaches a wrong fact.
  const { data } = await supabase.rpc('resolve_illustration_refs', {
    names: ['chest-to-wall handstand hold', 'back-to-wall handstand', 'tuck handstand hold, pressed from crow', 'tuck handstand hold'],
  });
  const found = new Map(data.map((r) => [r.input_name, r.join_key]));
  assert.strictEqual(found.get('chest-to-wall handstand hold'), null, 'the example is wrong');
  assert.strictEqual(found.get('back-to-wall handstand'), 'back-to-wall handstand', 'the example is wrong');
  assert.strictEqual(found.get('tuck handstand hold, pressed from crow'), null, 'the example is wrong');
  assert.strictEqual(found.get('tuck handstand hold'), 'tuck handstand hold', 'the example is wrong');
  return 'both worked examples verified against the resolver';
});

await check('AND THE PLAN THAT STARTED THIS WOULD STILL HAVE FOUND NOTHING', async () => {
  // The five movements of her Handstand Skills plan, verbatim. None of them
  // resolve, and none of them should: this check is here so that if somebody
  // later loosens the matcher to "fix" this case, it fails loudly. The fix is
  // the chat choosing drawn movements, not the matcher accepting near misses.
  const { data } = await supabase.rpc('resolve_illustration_refs', {
    names: [
      'Wrist prep (circles, palm and fingertip rocks)',
      'Plank shoulder taps',
      'Pike hold on a box',
      'Chest-to-wall handstand hold',
      'Kick-up practice against the wall',
    ],
  });
  for (const row of data) {
    assert.strictEqual(row.join_key, null, `"${row.input_name}" now matches - the matcher has been loosened`);
  }
  return '5 near misses, still correctly refused';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
