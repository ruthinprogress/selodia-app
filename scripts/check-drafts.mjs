// SOMETHING WRITTEN FOR HER TO SEND, AND THE RULES IT CANNOT BREAK.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-drafts.mjs
//
// From the audit of her Ruth's Health project, 12 October 2026: it drafts the
// message to her GP with her history and reference numbers already in it, and
// her effort is copy, paste, submit. Selodía held every one of those facts and
// could not do it, because the model that speaks to her has no tools and is
// told to keep to a sentence or two.
//
// A draft is therefore a separate call. What this check holds to, because each
// is a way a medical message written in somebody's name goes wrong:
//
//   it is never made on a voice call, where it would be read aloud;
//   it is never made on a turn that is not ordinary - distress, escalation, an
//   allergy block - where the careful reply must go out alone;
//   a photo turn cannot produce one, since nothing is acted on from a photo
//   until she confirms;
//   the writer is told it exists in plain words with no field names in them;
//   and the text itself carries no em dashes, because it goes out in her name.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const D = await import(root + '/app/lib/draft.ts');
const PHOTO = await import(root + '/app/lib/photo-turn.ts');
const PHONE = await import(root + '/mobile/src/lib/draft.ts');

const read = (p) => readFileSync(p, 'utf8').split('\r\n').join('\n');
const route = read('app/api/ask-selodia/route.ts');
const chat = read('mobile/src/app/(tabs)/index.tsx');
const card = read('mobile/src/components/draft-card.tsx');

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

console.log('\n  SOMETHING WRITTEN FOR HER TO SEND\n');

check('a draft in her name carries no em dashes, whatever the model wrote', () => {
  const d = D.tidyDraft({ title: 'Message to your GP — knee', body: 'My knee hurts — since Sunday.' });
  ok(d, 'a valid draft was refused');
  ok(!d.title.includes('—') && !d.body.includes('—'), 'an em dash survived');
  return 'replaced in code, not requested';
});

check('half a draft is no draft', () => {
  assert.strictEqual(D.tidyDraft(null), null);
  assert.strictEqual(D.tidyDraft({ title: 'x' }), null, 'no body was accepted');
  assert.strictEqual(D.tidyDraft({ title: '  ', body: 'text' }), null, 'a blank title was accepted');
  assert.strictEqual(D.tidyDraft({ title: 'x', body: 'y'.repeat(6001) }), null, 'a runaway body was accepted');
  return 'missing, blank and runaway all refused';
});

check('a gap left for her is noticed, so the reply can say so', () => {
  ok(D.hasGaps({ title: 't', body: 'The pain started [when the pain started].' }), 'a bracketed gap was missed');
  ok(!D.hasGaps({ title: 't', body: 'The pain started on Sunday.' }), 'a complete draft reads as having gaps');
  return 'square-bracket gaps detected';
});

check('the writer is told in plain words, with no field names', () => {
  const ok1 = D.draftWriterBlock({ title: 'Message to your GP', body: 'Hello [name]' }, 'a GP message');
  const fail = D.draftWriterBlock(null, 'a GP message');
  for (const b of [ok1, fail]) {
    ok(!/draftRequest|proposedSave|logIntent|draftBlock/.test(b), 'a field name reached the writer');
    ok(/do not write it out/i.test(b), 'the writer is not told to leave the draft to the card');
  }
  ok(ok1.includes('Message to your GP'), 'the writer is not told what the draft is');
  ok(/square brackets/.test(ok1), 'gaps are not mentioned when there are some');
  ok(/try again/.test(fail), 'a failed draft does not offer to try again');
  return 'success names it and the gaps; failure offers a retry';
});

check('the drafting prompt forbids invention and diagnosis', () => {
  const p = D.DRAFT_SYSTEM;
  ok(/never invent/i.test(p), 'invention is not forbidden');
  ok(/square brackets/i.test(p), 'unknowns are not left as visible gaps');
  ok(/do not diagnose/i.test(p), 'diagnosis is not forbidden');
  ok(/limit/i.test(p), 'a known length limit is not respected');
  ok(!/\b(she|her|hers)\b/i.test(p), 'the prompt says she/her - the house register is they');
  return 'invent, guess and diagnose are all ruled out';
});

check('never on a voice call, never on a turn that is not ordinary', () => {
  const gate = route.indexOf('if (newPathWrites(isVoice) && ordinary) {');
  const call = route.indexOf('draft = await writeDraft(');
  const writer = route.indexOf('const written = speculationHeld', call);
  ok(gate > 0 && call > gate, 'the draft is not inside the ordinary-turn branch');
  ok(writer > call, 'the draft is not written before the reply that describes it');
  ok(/const draftAsked =\s*!isVoice &&/.test(route), 'a voice call can ask for a draft');
  return 'typed and ordinary only, and written before the reply';
});

check('a photo turn cannot produce one', () => {
  const v = PHOTO.photoOnlyVerdict({ classification: 'routine', reply: 'x', draftRequest: 'a letter' });
  ok(!('draftRequest' in v), 'a draft request survived a photo turn');
  return 'stripped by the photo allowlist';
});

check('it reaches the phone, and is still there tomorrow', () => {
  ok(/\n    draft,\n/.test(route), 'the response does not carry the draft');
  ok(/\.\.\.\(draft \? \{ draft \} : \{\}\)/.test(route), 'the draft is not stored on the reply row');
  ok(/draft: asDraft\(\(m\.meta as \{ draft\?: unknown \} \| null\)\?\.draft\)/.test(chat), 'a reloaded thread loses the draft');
  ok(/draft: asDraft\(draft\)/.test(chat), 'a live reply drops the draft');
  return 'returned live, stored in meta, read back on reload';
});

check('the phone shares it and sends nothing itself', () => {
  ok(/Share\.share\(\{ message: body, title \}\)/.test(card), 'the card does not use the Share sheet');
  ok(!/expo-clipboard|react-native-clipboard/.test(card), 'the card needs a native module the app does not have');
  ok(/m\.role === 'assistant' && m\.draft/.test(chat), 'a draft could be drawn on her own message');
  return 'the phone\'s own sheet, which offers Copy';
});

check('a malformed draft from the network draws nothing', () => {
  assert.strictEqual(PHONE.asDraft(null), null);
  assert.strictEqual(PHONE.asDraft({ title: 'x' }), null);
  assert.strictEqual(PHONE.asDraft({ title: 1, body: 'y' }), null);
  assert.deepStrictEqual(PHONE.asDraft({ title: 't', body: 'b' }), { title: 't', body: 'b' });
  return 'only a title and a body make a card';
});

check('and this check can fail', () => {
  // The shapes that would have been wrong, detected as wrong.
  ok(/—/.test('raw — text'), 'the em dash fixture is not a fixture');
  ok(/draftRequest/.test('Set draftRequest to the letter.'), 'a field-name block reads as clean');
  const voiceAllowed = 'const draftAsked =\n      typeof result.draftRequest === "string"';
  ok(!/const draftAsked =\s*!isVoice &&/.test(voiceAllowed), 'an ungated draft reads as gated');
  return 'an em dash, a field name and an ungated draft all fail';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
