// CAN THE MODEL ACTUALLY OFFER EVERY KIND OF THING THE APP CAN SAVE?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-model-can-offer.mjs
//
// THE BUG THIS EXISTS FOR, found on 2 October by reading Ruth's own pending offer.
//
// She asked chat about a muscle up. It offered to save it as an INSIGHT, titled
// "Muscle up". Her Skills tab stayed empty, and "no skills" was one of the two
// things she said was broken after two days of work.
//
// Everything on the receiving end was built and shipped that morning: SaveType
// gained 'skill', pending-save routed it, lib/skill-add.ts matched the ladders and
// wrote the rows, a prompt rule told the model a skill is never her week, and
// skill-facts put her skills in front of it.
//
// AND THE TOOL SCHEMA STILL SAID:
//
//   {"type": "symptom" | "insight" | "me" | "rule" | "week", ...}
//
// So the model could not emit 'skill' if it wanted to. Told to offer a skill and
// given no type for one, it picked the nearest thing it was allowed to say.
//
// THE SHAPE: a capability built from the inside out, where the last step - telling
// the model the field exists - is the one with no compiler and no test behind it.
// The coercer accepting a value the schema never offers is invisible from both
// ends. This is the same class as the honesty guard's hand-kept list of writers,
// and the reason it went unnoticed for a day is identical: nothing fails.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const cwd = process.cwd().replace(/\\/g, '/');
const { SAVE_TYPES } = await import(`file://${cwd}/app/lib/pending-save.ts`);

const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8');

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
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

console.log('\n  CAN THE MODEL OFFER WHAT THE APP CAN SAVE?\n');

/** The `"type": "a" | "b" | ...` union in the proposedSave description. */
function schemaTypes() {
  const at = route.indexOf('proposedSave: {');
  ok(at > 0, 'proposedSave is not in the tool schema at all');
  const union = route.slice(at, at + 4000).match(/"type":\s*((?:"[a-z_]+"\s*\|\s*)*"[a-z_]+")/);
  ok(union, 'the proposedSave description no longer states its type union');
  return union[1].match(/"([a-z_]+)"/g).map((q) => q.replace(/"/g, ''));
}

/**
 * Types that reach the model through their OWN field rather than through an offer.
 *
 * `note` is deliberately not offerable. The prompt is explicit: "There is no offer
 * for a note, because asking is the yes: set noteText to their words exactly as
 * they said them." A note she asked for needs no permission, so it has its own
 * field and no entry in the union. Named here so that stays a stated exception
 * rather than a hole, and the exception only counts if the field really exists.
 */
const BY_OWN_FIELD = { note: 'noteText' };

check('every save type the app accepts is reachable by the model', () => {
  const offered = schemaTypes();
  const missing = SAVE_TYPES.filter((t) => {
    if (offered.includes(t)) return false;
    const field = BY_OWN_FIELD[t];
    return !(field && route.includes(`${field}: {`));
  });
  ok(
    missing.length === 0,
    `the app accepts ${missing.join(', ')} but the tool schema never offers ${
      missing.length === 1 ? 'it' : 'them'
    }, so the model cannot emit ${missing.length === 1 ? 'it' : 'them'}. ` +
      `The schema says: ${offered.join(' | ')}. This is exactly how Ruth's muscle up ` +
      'became an insight: the whole receiving end existed and the model was never told.'
  );
  return `${SAVE_TYPES.length} types, all offered: ${offered.join(' | ')}`;
});

check('and the model is offered nothing the app would throw away', () => {
  // THE OTHER DIRECTION. A type in the schema that coerceSaveType rejects means
  // the model emits it, the coercer drops it to null, and the offer silently never
  // happens - which looks to her exactly like the model ignoring her.
  const offered = schemaTypes();
  const unknown = offered.filter((t) => !SAVE_TYPES.includes(t));
  ok(
    unknown.length === 0,
    `the schema offers ${unknown.join(', ')}, which coerceSaveType rejects - so an ` +
      'offer of that kind is dropped in silence'
  );
  return 'nothing offered that would be discarded';
});

check('every type has its content shape described', () => {
  // A type with no shape is a type the model fills in from imagination, and
  // coerceProposal then rejects it for missing a field nobody told it about.
  const at = route.indexOf('proposedSave: {');
  const block = route.slice(at, at + 6000);
  // "for an insight", not "for a insight". The article was my bug, not the route's,
  // and loosening this to ignore it would have hidden a real gap.
  const described = SAVE_TYPES.filter((t) => !BY_OWN_FIELD[t]);
  const missing = described.filter((t) => !new RegExp(`for an? ${t}\\b`, 'i').test(block));
  ok(
    missing.length === 0,
    `${missing.join(', ')} appear in the type union with no "for a <type> {...}" shape, ` +
      'so the model has to guess the content fields'
  );
  return `${described.length} offerable types, each with its content shape`;
});

check('a skill is told apart from her week and from an insight', () => {
  const at = route.indexOf('proposedSave: {');
  const block = route.slice(at, at + 6000);
  // The two mistakes actually observed: her week (the deflection of 1 October) and
  // an insight (what it did on 2 October).
  ok(
    /A SKILL IS NEVER HER WEEK/.test(block),
    'nothing in the schema stops a skill being offered as a week entry'
  );
  ok(
    /never an insight/i.test(block),
    'nothing stops a skill being offered as an insight, which is what happened'
  );
  return 'both observed mistakes named';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
