// AN OFFER SHE CAN SAY YES TO ACTUALLY EXISTS.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-offer-exists.mjs
//
// Ruth, 9 October 2026: "it also didn't add the high cholesterol comment to my
// Me section."
//
// THE SENTENCE SHE HEARD, verbatim from chat_messages:
//
//   "...would you like it kept as a note on your Me tab, so it's there if you
//    want to raise it with your GP again?"
//
// She said "Uh, yes, please." Nothing was written. The turn had set neither
// proposedSave nor rememberCategory, so her yes answered an offer that did not
// exist.
//
// IT HAPPENED TWICE IN ONE DAY. Once in the morning, and again in the
// afternoon AFTER a separate bug in the same area was found and fixed - the
// user_context gate that dropped the first fact in any new category. That
// second failure is what proved the two were different bugs rather than one,
// and it is why the commit for the gate claims more than it earned.
//
// AND THE PROMPT ALREADY FORBIDS IT, in these words: "a turn where you show
// them a list and ask 'shall I save this?' WITHOUT setting proposedSave
// produces an offer that does not exist, and their yes then has nothing to
// answer." Written down, ignored twice. Which is the whole argument for a guard
// at the write rather than a firmer instruction.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { offersToKeep, stripDeadOffer, claimsAWrite, offerNamesAppStore } = await import(
  root + '/app/lib/claimed-write.ts'
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

// The real reply, as stored.
const HERS =
  "Mm, just a sec. Bear with me a moment. That cholesterol mention is worth holding onto - would you like it kept as a note on your Me tab, so it's there if you want to raise it with your GP again? If the letter gave you an actual number, I can include that too.";

console.log('\n  AN OFFER SHE CAN SAY YES TO\n');

check('the sentence she actually heard is caught', () => {
  const found = offersToKeep(HERS);
  assert.ok(found, 'the real dead offer is not detected');
  assert.ok(/would you like it kept as a note/i.test(found), found);
  return 'the Me tab question';
});

check('and this check can fail', () => {
  // The assertion above is "something was found", which passes on a matcher
  // that returns every sentence. So: an ordinary reply must find nothing, and
  // the stripper must leave it completely alone.
  const plain = 'A 5K in half an hour is a good distance to have under your belt.';
  assert.strictEqual(offersToKeep(plain), null, 'an ordinary sentence matched');
  assert.strictEqual(stripDeadOffer(plain), plain, 'an ordinary reply was altered');
  // And the real one really does differ from it.
  assert.notStrictEqual(offersToKeep(HERS), null);
  return 'an ordinary reply is untouched';
});

check('a question that is not about keeping anything survives', () => {
  // THE EXPENSIVE FALSE POSITIVE. Stripping these would take real questions
  // away from her, so the verb list deliberately excludes "add" and "put".
  for (const s of [
    'Would you like me to add more protein to your day?',
    'Shall I look further back than three days?',
    'Want me to explain what saturated fat does?',
    'Do you want me to put that in simpler terms?',
    'Should I ask you about this again tomorrow?',
    'How have you been finding the logging this week?',
  ]) {
    assert.strictEqual(offersToKeep(s), null, `wrongly caught: ${s}`);
    assert.strictEqual(stripDeadOffer(s), s, `wrongly stripped: ${s}`);
  }
  return '6 real questions, all left alone';
});

check('the other ways she gets asked are caught too', () => {
  for (const s of [
    'Want me to keep that in your Almanac?',
    'Shall I save this to your Me tab?',
    'Would you like me to note that down?',
    'Should I record that against today?',
    'Do you want me to store that with your readings?',
  ]) {
    assert.ok(offersToKeep(s), `missed: ${s}`);
  }
  return '5 phrasings caught';
});

check('only the question goes, and the rest of what she was told stays', () => {
  const left = stripDeadOffer(HERS);
  assert.ok(!/would you like it kept/i.test(left), `the offer survived: ${left}`);
  assert.ok(/cholesterol mention is worth holding onto/i.test(left), `her answer was lost: ${left}`);
  assert.ok(/If the letter gave you an actual number/i.test(left), `the rest was lost: ${left}`);
  assert.ok(left.length > 120, `too much was removed: ${left}`);
  return 'the question removed, the answer kept';
});

check('a list stays a list', () => {
  // stripSaveClaims learned this the hard way: splitting the whole reply into
  // sentences and rejoining flattened every list she is meant to glance at.
  const reply =
    'Morning\n- Niacinamide\n- SPF\nEvening\n- Retinol\n\nShall I keep that in your Me tab?';
  const left = stripDeadOffer(reply);
  assert.ok(left.includes('\n- Niacinamide'), `the list was flattened: ${JSON.stringify(left)}`);
  assert.ok(left.includes('Evening'), 'a heading was lost');
  assert.ok(!/Shall I keep/i.test(left), 'the offer survived');
  return 'line breaks and bullets intact';
});

check('it is wired into the route, and only when no offer was made', () => {
  const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8');
  const code = route.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(/const offerExists =/.test(code), 'the route does not check whether an offer exists');
  // All five of the fields that create one. Missing any would strip a question
  // that was about to work.
  for (const field of ['proposedSave', 'rememberCategory', 'almanacKind', 'planOffered', 'meUpdate', 'noteText']) {
    assert.ok(
      new RegExp(`result\\.${field}`).test(code.slice(code.indexOf('const offerExists ='), code.indexOf('const offerExists =') + 400)),
      `offerExists ignores result.${field}`
    );
  }
  assert.ok(/offerExists \? null : offersToKeep/.test(code), 'the guard runs even when an offer exists');
  assert.ok(/label: 'offer-without-offer'/.test(code), 'it is removed without being counted');
  return '6 offer fields, stripped only when none is set';
});

check('A PLAN OFFER IS NOT A DEAD OFFER', () => {
  // 17 October 2026. Ruth asked for a side splits plan on her phone. The model
  // described one and asked "Would you like me to save it so you can check?" -
  // exactly what the prompt requires, because a plan is confirmed first and
  // almanacKind is set only after a yes. The question was stripped as an offer
  // with nothing behind it and she was told "That did not save."
  //
  // Two rules, each correct alone, which together made plans unsaveable. The
  // guard's premise holds for a Me card, where the APP stores the offer and a
  // yes with nothing stored is lost. It does not hold for a plan, whose yes is
  // answered conversationally by the next turn setting almanacKind.
  const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8');

  // The model must be TOLD to set it, in the prose and not only in the schema -
  // a field nothing instructs is a field nothing sets.
  assert.ok(
    /SET planOffered TRUE ON THAT SAME TURN/.test(route),
    'the prompt does not tell the model to flag a plan offer'
  );
  assert.ok(
    /planOffered: \{\s*type: 'boolean'/.test(route),
    'planOffered is not in the classify tool'
  );
  // AND IT MUST NOT WRITE ANYTHING. It exists to keep a question in the reply;
  // a field that saves on its own would be a plan stored without a yes, which
  // is the rule this whole section protects.
  const writes = route.match(/result\.planOffered/g) ?? [];
  assert.strictEqual(writes.length, 1, 'planOffered is read somewhere other than offerExists');

  // The sentence that started it still matches the sweep, so this test is
  // exercising the real pattern rather than a paraphrase of it.
  assert.ok(
    offersToKeep('Would you like me to save it so you can check?'),
    'the real sentence no longer matches, so this check proves nothing'
  );
  return 'the question survives, and still writes nothing on its own';
});

check('AND THE PLAN QUESTION SURVIVES WITHOUT THE MODEL\'S HELP', () => {
  // THE SECOND LAYER. planOffered above is the model saying which kind of
  // question it asked. This is what holds when it does not say - which is the
  // thing that actually went wrong in October, twice, with the instruction
  // already written down.
  //
  // The sweep now acts only on an offer that NAMES somewhere the app stores and
  // collects the yes for. Hers named nothing.
  const PLAN = 'Would you like me to save it so you can check?';
  assert.ok(offersToKeep(PLAN), 'the sentence no longer matches, so this proves nothing');
  assert.strictEqual(offerNamesAppStore(PLAN), false, 'a plan offer is read as app-stored');
  assert.strictEqual(stripDeadOffer(PLAN), PLAN, 'her plan question is still being removed');

  // AND THE ONE THIS GUARD IS ACTUALLY FOR STILL GOES, or the narrowing has
  // simply turned the guard off.
  assert.strictEqual(offerNamesAppStore(HERS), true, 'the Me tab offer is no longer recognised');
  assert.ok(!/would you like it kept/i.test(stripDeadOffer(HERS)), 'the 9 October offer survived');

  // TWO QUESTIONS IN ONE REPLY: one goes, one stays.
  const both = `${PLAN} Shall I keep that in your Me tab?`;
  const left = stripDeadOffer(both);
  assert.ok(left.includes(PLAN), `the plan question was taken with it: ${left}`);
  assert.ok(!/keep that in your Me tab/i.test(left), `the Me tab question survived: ${left}`);

  // EVERY PLAN OFFER turn_diagnostics RECORDED AS REMOVED, verbatim from the
  // rows on 17 October. These are not paraphrases: each one is a question a
  // real person was asked and never saw.
  for (const s of [
    'Want me to save it to your Almanac?',
    'Do you want me to save this to your Almanac?',
    'Do you want me to write out the sets and reps and save it to Plans?',
    'Would you like me to save it on Plans, or change anything first?',
    "Want me to keep this letter's details in your care record alongside the rest of the knee claim?",
  ]) {
    assert.ok(offersToKeep(s), `no longer matched, so it proves nothing: ${s}`);
    assert.strictEqual(stripDeadOffer(s), s, `still removed: ${s}`);
  }

  // And the route uses the same test rather than its own copy of the idea.
  const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8');
  assert.ok(
    /offerNamesAppStore\(offerFound\)/.test(route),
    'the route still strips every offer it finds'
  );
  return 'the plan question stays, the Me tab question goes';
});

check('a care record is never silenced by the quiet period', () => {
  // THE THREE-HOUR QUIET PERIOD exists so she is not pestered about every
  // passing remark. It swallowed the AXA call notes in the comparison run of
  // 14 October 2026: she typed out the authorisation code, the claims line, the
  // agreed route and the physio allowance, got an excellent set of next steps,
  // and was never offered the record - because an earlier case minutes before
  // had offered something else. That is Session 71 repeating.
  //
  // A care record is not a passing remark. It is only proposed when a letter, a
  // reference number or the notes of a call have been handed over, and handing
  // those over IS the act of recording. Missing one costs the most, too: a chat
  // message falls out of context within weeks and a care record does not, so
  // the save is what makes a thread recoverable at all.
  const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8');
  const at = route.indexOf('const askedFor =');
  assert.ok(at > -1, 'the quiet-period exemption has moved');
  const decl = route.slice(at, route.indexOf(';', at));
  for (const type of ['me', 'week', 'care']) {
    assert.ok(decl.includes(`'${type}'`), `a ${type} offer can still be swallowed by the quiet period`);
  }
  // Still a LIST and not everything, or the limit is gone and she is pestered
  // about every passing remark again.
  assert.ok(/proposal &&/.test(decl), 'every offer now skips the quiet period');
  return 'me, week and care';
});

check('it does not fight the guard next door', () => {
  // claimsAWrite exempts offer sentences on purpose - "shall I save that?" is
  // not a claim to have saved. The two must not both act on one sentence.
  const sentence = 'Shall I keep that in your Almanac?';
  assert.strictEqual(claimsAWrite(sentence), null, 'the claim guard now treats an offer as a claim');
  assert.ok(offersToKeep(sentence), 'the offer guard does not see it');
  return 'one sentence, one guard';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
