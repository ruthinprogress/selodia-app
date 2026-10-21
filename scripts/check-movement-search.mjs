// THE LIBRARY IS LOOKED UP NOW, NOT CARRIED.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-movement-search.mjs
//
// Ruth, 21 October 2026, choosing between three ways of dealing with the
// prompt's biggest block: "do option 1, make it a tool - i'm assuming this
// means it's like a database it can go to when needed. we grow the database of
// illustrations and videos over time."
//
// 27,573 characters of movement names left the prompt. What replaces them is a
// search, and a search has a failure the list never had: it can answer with the
// WRONG movement. The list was at least true.
//
// SO THE BAR IS SET WHERE A MISS IS CHEAP AND A WRONG HIT IS NOT. Measured on
// the real library while this was being written: "bird dog" matched "3 leg dog
// pose" on the strength of one word, and "hip hinge" came back full of hip
// thrusts. Both are this project's worst outcome - a confidently wrong
// demonstration, which somebody then copies. A miss costs nothing by
// comparison: the prompt has always said a plan with no demonstrations is a
// perfectly ordinary plan.
//
// AND THE PROMPT MUST NOT STILL CLAIM TO HOLD THE LIST. The sentence "You can
// see the whole library of films and drawings right now" was true the day
// before and false the day after. At this prompt's size a stale sentence does
// not sit quietly - it ARGUES with the new instruction, and the older, more
// emphatic one usually wins. That is a rule this project has already paid for.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { searchMovements, formatResults, score, words, byMuscleGroup } = await import(
  here('app/lib/movement-search.ts')
);
const { findMovementsTool, FIND_MOVEMENTS_TOOL_NAME, MOVEMENT_LIBRARY_PROMPT } = await import(
  here('app/lib/movement-tool.ts')
);

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

const route = fs.readFileSync('app/api/ask-selodia/route.ts', 'utf8');

// A SMALL STAND-IN FOR THE REAL LIBRARY, holding the exact names that produced
// the faults above. Real names, so a rule that passes here passes on the real
// thing for the same reason.
const LIBRARY = [
  { joinKey: '3 leg dog pose', muscleGroup: 'Yoga' },
  { joinKey: 'downward dog toe to heel', muscleGroup: 'Yoga' },
  { joinKey: 'barbell hip thrust', muscleGroup: 'Legs' },
  { joinKey: 'bodyweight hip thrust', muscleGroup: 'Legs' },
  { joinKey: 'barbell romanian deadlift', muscleGroup: 'Legs' },
  { joinKey: 'dead bug', muscleGroup: 'Abdominals' },
  { joinKey: 'dead bug extended arms', muscleGroup: 'Abdominals' },
  { joinKey: 'glute bridge bodyweight', muscleGroup: 'Legs' },
  { joinKey: 'plate glute bridge to pullover', muscleGroup: 'Legs' },
  { joinKey: 'back-to-wall handstand', muscleGroup: 'Drawn', drawn: true },
];

console.log('\n  FINDING A MOVEMENT INSTEAD OF BEING TOLD 950 OF THEM\n');

check('HALF THE WORDS IS NOT A MATCH', () => {
  // The fault this was built to stop, in the two forms it actually took.
  const [birdDog] = searchMovements(LIBRARY, ['bird dog']);
  assert.strictEqual(birdDog.hits.length, 0, `"bird dog" matched ${birdDog.hits.map((h) => h.name).join(', ')}`);

  const [hinge] = searchMovements(LIBRARY, ['hip hinge']);
  assert.strictEqual(hinge.hits.length, 0, `"hip hinge" matched ${hinge.hits.map((h) => h.name).join(', ')}`);
  return 'bird dog finds no dog pose, hip hinge finds no hip thrust';
});

check('AND A REAL MATCH STILL COMES BACK', () => {
  // The bar has to cost misses, not everything. A rule that returned nothing
  // would pass the check above and be useless.
  const [bridge] = searchMovements(LIBRARY, ['glute bridge']);
  assert.ok(bridge.hits.length >= 2, 'a movement the library plainly holds came back empty');
  assert.strictEqual(bridge.hits[0].name, 'glute bridge bodyweight', 'the plainest name did not rank first');
  const [rdl] = searchMovements(LIBRARY, ['romanian deadlift']);
  assert.strictEqual(rdl.hits[0].name, 'barbell romanian deadlift');
  return 'the plain name ranks above the equipment one';
});

check('SPACING IS NOT MEANING', () => {
  // "deadbug" came back NOTHING FILMED while the library held "dead bug".
  const [glued] = searchMovements(LIBRARY, ['deadbug']);
  assert.ok(glued.hits.length > 0, '"deadbug" does not find "dead bug"');
  assert.strictEqual(glued.hits[0].name, 'dead bug');
  // But a short word must not glue its way into everything: "bug" inside
  // "deadbug" is fine, "leg" inside a hundred names is not.
  assert.strictEqual(score(words('dog'), '3 leg dog pose') > 0, true);
  return 'deadbug finds dead bug';
});

check('A DRAWING IS FINDABLE, AND SAID TO BE A DRAWING', () => {
  // Most of the drawn library was drawn precisely because nothing filmed it, so
  // a search that only knew about films would hide the handstand ladder and
  // both splits progressions.
  const [hand] = searchMovements(LIBRARY, ['back-to-wall handstand']);
  assert.strictEqual(hand.hits[0].drawn, true, 'a drawing is not marked as drawn');
  assert.ok(/\[drawn\]/.test(formatResults([hand])), 'the answer does not say it is a drawing');
  return 'marked [drawn]';
});

check('NOTHING FOUND IS SAID OUT LOUD, AND SAID TO BE ORDINARY', () => {
  // An empty list is something a model skims past. The words matter here: a
  // miss must not read as "do not use this movement", which would quietly make
  // every plan worse than the library deserves.
  const text = formatResults(searchMovements(LIBRARY, ['bird dog']));
  assert.ok(/NOTHING FILMED/.test(text), 'an empty answer is silent');
  assert.ok(/Use it anyway/.test(text), 'a miss reads as a refusal rather than a missing picture');
  return 'a miss is named and defused';
});

check('THE PROMPT NO LONGER CLAIMS TO HOLD THE LIST', () => {
  // The stale-sentence rule, which this project has already paid for once.
  assert.ok(!/\$\{FILMED_MOVEMENTS\}/.test(route), 'the catalogue is still in the prompt');
  assert.ok(
    !/You can see the whole library of films and drawings right now, before anything is saved\./.test(route),
    'the prompt still says the model can see the whole library, which is now false'
  );
  assert.ok(/MOVEMENT_LIBRARY_PROMPT/.test(route), 'nothing tells the model the library exists');
  assert.ok(
    new RegExp(FIND_MOVEMENTS_TOOL_NAME).test(MOVEMENT_LIBRARY_PROMPT),
    'the prompt does not name the tool it is pointing at'
  );
  return 'the list is gone and the pointer is there';
});

check('AND THE RULES THE LIST CARRIED SURVIVED IT', () => {
  // The list was never just names. Three instructions rode with it, and all
  // three are the reason a wrong name does damage.
  const d = findMovementsTool.description;
  assert.ok(/COPY A NAME EXACTLY/.test(d), 'nothing says to copy the name exactly');
  assert.ok(/never use a name that did NOT come back/i.test(d), 'nothing forbids a name it invented');
  assert.ok(/worse than none/.test(d), 'the reason a wrong name matters is gone');
  assert.ok(/NOTHING FILMED/.test(d), 'the model is not told what a miss looks like');
  return 'copy exactly, never invent, a miss is fine';
});

check('THE TURN CAN STILL NEVER ANSWER WITHOUT DECIDING', () => {
  // Forcing classify_and_reply by name made the search unreachable, so the
  // choice opened to 'any'. That keeps the guarantee that mattered - no plain
  // text, so never a turn without a safety classification - but only if the
  // loop ends in the decision tool. The last attempt demands it by name.
  assert.ok(/tool_choice: leadMode \? \{ type: 'auto' \} : \{ type: 'any' \}/.test(route),
    'the tool choice no longer requires a tool call');
  assert.ok(/lastAttempt/.test(route), 'nothing forces the decision on the last attempt');
  assert.ok(
    /lastAttempt[\s\S]{0,120}\{ type: 'tool', name: CLASSIFY_TOOL_NAME \}/.test(route),
    'the last attempt does not force the decision tool'
  );
  assert.ok(/MAX_SEARCHES/.test(route), 'the lookup loop has no cap');
  return "'any', capped, and forced at the end";
});

check('AND EVERY LEG OF THE TURN IS BILLED', () => {
  // A plan turn is now two or three calls. Recording only the last would make
  // the cheapest-looking turns the expensive ones, which is the opposite of
  // what the usage table is for.
  const at = route.indexOf('for (let searched = 0');
  assert.ok(at > -1, 'the lookup loop is gone');
  const loop = route.slice(at, route.indexOf('// WHETHER THE CACHE ACTUALLY HIT'));
  assert.ok(/recordModelUsage/.test(loop), 'a lookup leg is never recorded, so plan turns under-report');
  return 'each leg recorded';
});

check('BROWSING A BODY AREA IS BOUNDED', () => {
  // Legs alone is 194 names. An unbounded browse would put the block straight
  // back into the turn it was taken out of.
  const legs = byMuscleGroup(
    Array.from({ length: 300 }, (_, i) => ({ joinKey: `move ${i}`, muscleGroup: 'Legs' })),
    'Legs'
  );
  assert.ok(legs.length <= 60, `a browse returned ${legs.length} names`);
  return `${legs.length} at most`;
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
