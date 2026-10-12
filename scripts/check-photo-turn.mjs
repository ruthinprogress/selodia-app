// A PHOTO SHE SENT WITH NO WORDS IS LOOKED AT, AND NOTHING IS SAVED FROM IT.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-photo-turn.mjs
//
// Ruth, 12 October 2026: "the chat doesn't process any document I give it. It
// should be able to receive any image and decipher it like a normal Claude
// chat." And: "Even with no question, Selodía should extract the details and
// ask if not sure."
//
// classify-image kept ONE WORD of what the model saw, and "unclear" ended in "I
// couldn't quite make that out". Now an unplaced photo becomes her message, with
// the image attached, and the reply says what is in it and asks.
//
// THE RISK IS SAVING FROM A PICTURE NOBODY CONFIRMED, and this check is mostly
// about that. The classifier is told not to - but a rule the model is asked to
// follow is not a rule. So the verdict is cut to an allowlist in code, and this
// asserts three things about it: that it strips everything that can write
// (including a field that does not exist yet), that it runs BEFORE the route
// first reads the verdict, and that it cannot be switched on by a voice call.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const SERVER = await import(root + '/app/lib/photo-turn.ts');
const PHONE = await import(root + '/mobile/src/lib/photo-turn.ts');

const read = (p) => readFileSync(p, 'utf8').split('\r\n').join('\n');
const route = read('app/api/ask-selodia/route.ts');
const chat = read('mobile/src/app/(tabs)/index.tsx');
const logging = read('mobile/src/lib/image-logging.ts');

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
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** A verdict with every kind of write set, as a classifier might return it. */
function everythingSet() {
  return {
    classification: 'routine',
    reply: 'It looks like a letter from your GP.',
    healthGuidanceApplied: false,
    logIntent: 'food',
    logText: 'porridge',
    reminderAction: 'create',
    reminderLabel: 'take magnesium',
    rememberCategory: 'health',
    rememberContent: 'something',
    proposedSave: { type: 'me' },
    correctionKind: 'food',
    daySymptoms: ['headache'],
    cycleEvent: 'period_start',
    almanacTitle: 'A card',
    allergiesDisclosed: ['nickel'],
    weekEntry: { activity: 'yoga' },
    // NOT A REAL FIELD. Added next month by somebody who never read this file.
    someFutureSaveThing: true,
  };
}

console.log('\n  A PHOTO WITH NO WORDS IS LOOKED AT, AND NOTHING IS SAVED FROM IT\n');

check('the verdict keeps safety and conversation', () => {
  const v = SERVER.photoOnlyVerdict(everythingSet());
  assert.strictEqual(v.classification, 'routine', 'the safety classification was stripped');
  assert.strictEqual(v.reply, 'It looks like a letter from your GP.');
  assert.strictEqual(v.healthGuidanceApplied, false);
  return 'classification and reply kept';
});

check('and strips everything that can write, including fields that do not exist yet', () => {
  const v = SERVER.photoOnlyVerdict(everythingSet());
  assert.strictEqual(v.logIntent, 'none', 'logIntent survived');
  for (const k of [
    'logText', 'reminderAction', 'reminderLabel', 'rememberCategory', 'rememberContent',
    'proposedSave', 'correctionKind', 'daySymptoms', 'cycleEvent', 'almanacTitle',
    'allergiesDisclosed', 'weekEntry', 'someFutureSaveThing',
  ]) {
    ok(!(k in v), `${k} survived a photo turn`);
  }
  return 'an invented future field is stripped by default';
});

check('an offer to keep a care detail survives, and no other offer does', () => {
  // Ruth, 12 October 2026, on a screenshot of her GP practice's website: it
  // should have "asked if it was the users practice and if they wanted saves".
  // An offer saves nothing until her yes, so it is allowed through. The
  // exception is exactly one type wide.
  const care = SERVER.photoOnlyVerdict({ classification: 'routine', reply: 'x', proposedSave: { type: 'care', title: 'A practice' } });
  ok(care.proposedSave && care.proposedSave.type === 'care', 'a care offer was stripped from a photo turn');
  for (const t of ['me', 'marker', 'condition', 'symptom', 'rule']) {
    const v = SERVER.photoOnlyVerdict({ classification: 'routine', reply: 'x', proposedSave: { type: t } });
    ok(!('proposedSave' in v), `a ${t} offer survived a photo turn`);
  }
  return 'care offered, everything else still stripped';
});

check('the route applies it before it first reads the verdict', () => {
  const guard = route.indexOf('if (isPhotoOnly) photoOnlyVerdict(result);');
  ok(guard > 0, 'the route never calls photoOnlyVerdict');
  const declared = route.indexOf('const result = toolUse.input as {');
  ok(declared > 0 && declared < guard, 'the guard is not after the verdict is parsed');
  // Every read of the verdict after it was parsed must come after the guard.
  const firstRead = route.indexOf('result.', route.indexOf('};', declared));
  ok(firstRead > guard, 'the route reads the verdict before the allowlist has run');
  return 'parsed, then cut down, then read';
});

check('a voice call cannot switch it on', () => {
  ok(/const isPhotoOnly = photoOnly === true && !isVoice;/.test(route), 'isPhotoOnly does not exclude voice');
  return 'typed turns only';
});

check('both models are told, each in its own terms', () => {
  ok(/isPhotoOnly \? `\\n\\n\$\{PHOTO_ONLY_CLASSIFIER_NOTE\}`/.test(route), 'the classifier is not given the note');
  ok(/isPhotoOnly \? PHOTO_ONLY_WRITER_BLOCK : ''/.test(route), 'the writer is not given its block');
  // The writer block must not name a field: the last time a block naming one
  // reached the writer it typed the JSON into her message, twice.
  ok(!/logIntent|proposedSave|reminderAction/.test(SERVER.PHOTO_ONLY_WRITER_BLOCK), 'the writer block names a field');
  return 'instructions to the classifier, plain words to the writer';
});

check('the placeholder is the same on both sides, and never shown', () => {
  assert.strictEqual(SERVER.PHOTO_ONLY_MESSAGE, PHONE.PHOTO_ONLY_MESSAGE);
  assert.strictEqual(PHONE.displayedText('[photo]', true), '', 'the placeholder is shown under her photo');
  assert.strictEqual(PHONE.displayedText('what is this?', true), 'what is this?', 'real words were hidden');
  assert.strictEqual(PHONE.displayedText('[photo]', false), '[photo]', 'text with no image was hidden');
  return `"${SERVER.PHOTO_ONLY_MESSAGE}", hidden only beside an image`;
});

check('the phone sends an unplaced photo into the conversation', () => {
  ok(/\{ status: 'unclear'; image: PickedImage \}/.test(logging), "'unclear' no longer carries the photo");
  ok(/return \{ status: 'unclear', image \}/.test(logging), 'classifyAndLog drops the photo on unclear');
  ok(
    /result\.status === 'unclear' && fitsAPhotoTurn\(result\.image\)[\s\S]{0,120}handleSend\(PHOTO_ONLY_MESSAGE, undefined, result\.image\)/.test(chat),
    'an unclear photo still ends in the dead-end message'
  );
  ok(/cardImageBase64: photo\.base64, cardMediaType: photo\.mediaType, photoOnly: true/.test(chat), 'the turn does not carry the photo and the flag');
  return 'unclear becomes her message, with the photo and the flag';
});

check('a photo too large for a turn keeps the old line rather than arriving blank', () => {
  const small = { base64: 'A'.repeat(1000), mediaType: 'image/jpeg' };
  const big = { base64: 'A'.repeat(Math.ceil((PHONE.MAX_PHOTO_TURN_BYTES + 10) * 4 / 3)), mediaType: 'image/jpeg' };
  ok(PHONE.fitsAPhotoTurn(small), 'a small photo is refused');
  ok(!PHONE.fitsAPhotoTurn(big), 'an oversized photo is accepted and would be stored as nothing');
  return '4 MB ceiling, matching the route';
});

check('and this check can fail', () => {
  // A verdict handled the old way - no allowlist - keeps its writes.
  const untouched = everythingSet();
  ok('reminderAction' in untouched && untouched.logIntent === 'food', 'the fixture is not a fixture');
  // The shipped dead end reads as a failure.
  const shipped = "if (kind === 'unclear') return { status: 'unclear' };";
  ok(!/return \{ status: 'unclear', image \}/.test(shipped), 'the old return reads as carrying the photo');
  // And a guard placed after the first read is caught.
  const late = 'const result = toolUse.input as {\n a: 1;\n};\nif (result.logIntent) x();\nif (isPhotoOnly) photoOnlyVerdict(result);';
  const g = late.indexOf('if (isPhotoOnly) photoOnlyVerdict(result);');
  const d = late.indexOf('const result = toolUse.input as {');
  const r = late.indexOf('result.', late.indexOf('};', d));
  ok(!(r > g), 'a guard after the first read reads as safe');
  return 'an unguarded verdict, the old dead end, and a late guard all fail';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
