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
const { DRAWN_MOVEMENTS, DRAWN_COUNT, FILMED_MOVEMENTS, FILMED_COUNT } = await import(mod);

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

await check('THE CHAT CAN SEE THE FILMED LIBRARY TOO', async () => {
  // Ruth, 18 October 2026: "It's not matching. The chat literally says it cant
  // see what's available at all. Thats what needs fixing."
  //
  // 950 clips, and the chat had never been shown one of them at any point -
  // writing a plan or reading one back. The [video] marks it did get were only
  // ever for plans ALREADY SAVED.
  const { data, error } = await supabase.from('movement_assets').select('join_key');
  assert.ok(!error, error?.message);
  assert.strictEqual(FILMED_COUNT, data.length, 'FILMED_COUNT is stale');

  const live = new Set(data.map((r) => r.join_key));
  const told = [];
  for (const line of FILMED_MOVEMENTS.split('\n')) {
    if (!line.includes(':')) continue;
    for (const n of line.slice(line.indexOf(':') + 1).split(';')) {
      const name = n.trim();
      if (name) told.push(name);
    }
  }
  assert.strictEqual(told.length, data.length, `told about ${told.length} of ${data.length} clips`);

  const invented = told.filter((n) => !live.has(n));
  assert.deepStrictEqual(invented.slice(0, 5), [], 'the chat is told about clips that do not exist');
  return `${told.length} clips, none missing, none invented`;
});

await check('AND IT IS TOLD WHAT NOT TO DO WITH THAT LIST', async () => {
  // A list of 950 names is a new way to be confidently wrong. Three dangers,
  // each written into the prompt rather than left to judgement:
  //
  //   the ugly names - the films came from a vendor, so some carry a machine,
  //   a version number or a long equipment description. Putting one of those on
  //   somebody's card is a worse outcome than no picture.
  //
  //   the near misses - a bulgarian split squat is not a split squat. The
  //   matcher refuses these correctly, so the only way they cause harm is the
  //   model reaching for one anyway.
  //
  //   the padding - a plan stuffed with covered movements to avoid an uncovered
  //   one is the preference hardening into a constraint, which is the fault
  //   this whole arrangement is supposed to avoid.
  const route = fs.readFileSync('app/api/ask-selodia/route.ts', 'utf8');
  assert.ok(/COPY THE NAME EXACTLY AS WRITTEN ABOVE/.test(route), 'exact clip naming is not required');
  assert.ok(
    /PICK THE ONE SOMEBODY WOULD WANT ON THEIR CARD/.test(route),
    'nothing steers it away from the machine and version names'
  );
  assert.ok(
    /NEVER USE A NAME THAT IS NOT IN THE LIST ABOVE JUST BECAUSE IT LOOKS SIMILAR/.test(route),
    'nothing forbids reaching for a near miss'
  );
  assert.ok(
    /NEVER PAD A PLAN WITH COVERED MOVEMENTS/.test(route),
    'nothing stops the library bending the plan'
  );

  // The worked example has to be real, or the prompt teaches a wrong fact.
  const { data } = await supabase
    .from('movement_assets')
    .select('join_key')
    .eq('join_key', 'band two legs calf raise - (band under both legs) version 2');
  assert.strictEqual(data?.length, 1, 'the ugly-name example is not a real clip any more');
  return '4 instructions, and the example verified against the library';
});

await check('A WRITTEN MOVEMENT IS NOT DESCRIBED AS A GAP', async () => {
  // Ruth, 18 October 2026, correcting what I had written: "It does not tell the
  // user it doesnt have something, because it does, it's just text only."
  //
  // My version said "do not point it out", which is half the answer and the
  // wrong half. The distinction she is drawing is between an ABSENCE and a
  // FORMAT. Written instructions are one of the three ways this app teaches a
  // movement, not the failure of the other two, and a plan containing one is
  // finished rather than lacking. Describing it as missing makes a complete
  // plan sound broken - which is the same fault as the app apologising for
  // itself anywhere else.
  const route = fs.readFileSync('app/api/ask-selodia/route.ts', 'utf8');

  assert.ok(
    /A WRITTEN MOVEMENT IS NOT A GAP IN THEIR PLAN/.test(route),
    'the written route is described as a gap again'
  );
  assert.ok(
    /one of the three ways this app teaches a movement/.test(route),
    'written instructions are no longer named as a real format alongside film and drawing'
  );
  assert.ok(
    /NEVER tell somebody a movement is missing, unavailable, not covered, not in the library/.test(route),
    'nothing forbids telling somebody the library lacks their movement'
  );

  // AND THE POSITIVE THING SHE ASKED FOR, which is the point of the whole
  // correction: the request is what makes the library grow, and that is worth
  // the person hearing.
  assert.ok(/goes to our illustrator as a request to draw/.test(route), 'the illustrator line is gone');
  assert.ok(
    /has not come up before/.test(route) && /good thing to want to learn/.test(route),
    'the framing she asked for is gone'
  );
  assert.ok(
    /Never as an apology and never as a warning/.test(route),
    'nothing stops it being said as an apology'
  );

  // The ORDER matters too: look first, choose from what is there, write only
  // what nothing covers.
  assert.ok(
    /Look at both lists above FIRST/.test(route),
    'the chat is no longer told to look before it chooses'
  );
  return 'a format, not an absence - and the request is told where it goes';
});

await check('A PLAN IS OFFERED TO PLANS, NOT TO THE ALMANAC', async () => {
  // Ruth, 18 October 2026: "But it's not in the Almanac anymore, it's in Plans."
  //
  // The prompt still told the chat to ask "Want me to save this to your
  // Almanac?" for a movement plan. Somebody says yes, then goes to the Almanac
  // and finds Insights and Me. The plans moved tab and this sentence did not
  // move with them - it is the kind of staleness nothing fails on, because the
  // save works perfectly and only the direction is wrong.
  const route = fs.readFileSync('app/api/ask-selodia/route.ts', 'utf8');
  const planSection = route.slice(route.indexOf('(2) PLANS you have genuinely worked out'));
  const instruction = planSection.slice(0, 1200);

  assert.ok(
    /Want me to save this to your Plans\?/.test(instruction),
    'the plan offer no longer names the Plans tab'
  );
  assert.ok(
    !/save this to your Almanac/.test(instruction),
    'the plan offer sends people to the Almanac again'
  );
  assert.ok(
    /THEY LIVE ON THE PLANS TAB, NOT IN THE ALMANAC/.test(instruction),
    'the reason is gone, so the example is the only thing holding the rule'
  );

  // AND THE FAILURE LINE NAMES NO TAB AT ALL, because one line covers every
  // save type and cannot know which one failed.
  const pending = fs.readFileSync('app/lib/pending-save.ts', 'utf8');
  assert.ok(
    /That didn't save just now/.test(pending),
    'the failure line has gone back to naming a tab'
  );
  assert.ok(
    !/didn't save to your Almanac/.test(pending),
    'the failure line sends people to the Almanac again'
  );
  return 'offered to Plans, and the failure line names nowhere';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
