// A CHAT THAT LEADS: ONE MODEL THROUGH THE TURN, ON THE ACCOUNTS SWITCHED ON,
// WITH EVERY GUARD STILL WHERE IT WAS.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-lead-turn.mjs
//
// The plan Ruth signed off on 13 October 2026 promised four things this checks:
//   - the same model that decides the turn writes the reply, and is told what
//     the app actually did;
//   - typed turns only, on accounts switched on, and a turn that is not
//     ordinary (distress, crisis, red flag, allergy) keeps today's path;
//   - the reply gets everything the old writer got, plus the app guide;
//   - nothing saves from the reply step, and a plain yes to a waiting offer is
//     read as yes.

import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const L = await import(root + '/app/lib/lead-turn.ts');

const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8').split('\r\n').join('\n');

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

console.log('\n  A CHAT THAT LEADS\n');

check('only typed turns, only on accounts switched on', () => {
  assert.ok(/let leadMode = !isVoice && \(await leadChatOn\(supabase, user\.id\)\);/.test(route), 'leadMode is not typed-only and per account');
  assert.ok(/\.select\('lead_chat'\)/.test(readFileSync('app/lib/lead-turn.ts', 'utf8')), 'the switch is not read from user_profile.lead_chat');
  const mig = readdirSync('supabase/migrations').find((f) => /a_chat_that_leads/.test(f));
  assert.ok(mig, 'there is no migration file for the switch');
  assert.ok(/lead_chat boolean not null default false/.test(readFileSync(`supabase/migrations/${mig}`, 'utf8')), 'the switch is not off by default');
  return 'off by default, typed only';
});

check('the same model decides the turn and writes the reply', () => {
  assert.ok(/let firstModel = leadMode \? LEAD_MODEL : MODEL;/.test(route), 'the first call does not move to the lead model');
  assert.ok(/model: firstModel,/.test(route), 'the first call ignores firstModel');
  assert.ok(/system: firstSystem,\s*messages,\s*tools: firstTools,/.test(route), 'the first call does not use the held system and tools');
  assert.ok(/first: \{ system: firstSystem, messages, tools: firstTools \}/.test(route), 'the reply does not continue the same conversation');
  assert.ok(/firstContent: response\.content/.test(route), 'the reply is not given what the model decided');
  assert.strictEqual(L.LEAD_MODEL, 'claude-opus-5-5', 'the lead model is not the strongest, which was her decision');
  return L.LEAD_MODEL;
});

check('a turn that is not ordinary keeps today\'s path', () => {
  const branch = route.indexOf('if (newPathWrites(isVoice) && ordinary) {');
  const lead = route.indexOf('const leadWritten = async ()');
  assert.ok(branch > 0 && lead > branch, 'the lead reply is not inside the ordinary branch, so a crisis turn could reach it');
  const end = route.indexOf('timing.mark(\'replyWritten\')');
  assert.ok(lead < end, 'the lead reply is outside the reply section');
  return 'inside the ordinary branch only';
});

check('the reply gets every block the old writer gets, plus the guide', () => {
  const lead = route.slice(route.indexOf('const leadWritten = async ()'));
  const leadBlocks = lead.slice(lead.indexOf('blocks: ['), lead.indexOf('],', lead.indexOf('blocks: [')));
  const writer = route.slice(route.indexOf(': await writeReplyAfterSaves({'));
  const writerBlocks = writer.slice(writer.indexOf('extraBlocks: ['), writer.indexOf('],', writer.indexOf('extraBlocks: [')));
  // A SET, because the writer's list carries comments that name a block twice.
  const names = (s) => [...new Set((s.match(/\b[a-zA-Z]+Block\b/g) ?? []).filter((n) => n !== 'extraBlocks'))].sort();
  assert.deepStrictEqual(names(leadBlocks), names(writerBlocks), 'the lead reply and the writer see different blocks');
  assert.ok(/guide: appGuideBlock\(\)/.test(lead), 'the lead reply is not given the app guide');
  assert.ok(/didLines: appendedNotes/.test(lead), 'the lead reply is not told what the app did');
  assert.ok(/offerWaiting: offered/.test(lead), 'the lead reply is not told an offer is waiting');
  return `${names(leadBlocks).length} blocks, the same as the writer's`;
});

check('both calls of a turn ask for the same effort', () => {
  // Ruth, 14 October 2026: 20 to 30 seconds "is broken by any normal users
  // standards". Effort is the measured lever (probe-lead-latency.mjs: 16.9s at
  // medium, 11.3s at low, same answers). It must be the SAME on both calls: the
  // resolved effort is rendered into the prompt, so a different level on the
  // second call throws away the cache that call exists to reuse.
  const src = readFileSync('app/lib/lead-turn.ts', 'utf8');
  assert.strictEqual(L.LEAD_EFFORT, 'low');
  assert.ok(/output_config: \{ effort: LEAD_EFFORT \}/.test(src), 'the reply step does not set the effort');
  assert.ok(
    /leadMode \? \{ output_config: \{ effort: LEAD_EFFORT \} \} : \{\}/.test(route),
    'the first call does not set the same effort, so the second loses its cache'
  );
  // And only on a led turn: the old path is untouched.
  assert.ok(!/output_config/.test(route.slice(route.indexOf("tool_choice: { type: 'tool', name: CLASSIFY_TOOL_NAME },\n    }"))), 'effort leaked onto a path that is not led');
  return `effort ${L.LEAD_EFFORT} on both`;
});

check('nothing can be done from the reply step', () => {
  const src = readFileSync('app/lib/lead-turn.ts', 'utf8');
  assert.ok(/tool_choice: \{ type: 'none' \}/.test(src), 'the reply step could call a tool');
  assert.ok(/NOTHING NEW HAPPENS FROM THIS REPLY/.test(L.LEAD_REPLY_INSTRUCTIONS));
  assert.ok(/Never write that anything was saved/.test(L.LEAD_REPLY_INSTRUCTIONS), 'the reply may claim a save');
  // AND THE ONE EXCEPTION, ruled by Ruth on 14 October 2026 after T1 of the
  // comparison run: "exception for corrections".
  //
  // The absolute rule above exists because the app prints its own confirmation
  // and saying it twice is the waffle she objected to. But a CORRECTION raises
  // one question the app's line cannot answer - whether there are now two of
  // the thing - and the morning's version of this failure sent her into the Log
  // to go and check for duplicates. "Changed the existing entry rather than
  // adding a second" is what stops her looking.
  assert.ok(
    /ONE EXCEPTION, AND ONLY THIS ONE: A CORRECTION/.test(L.LEAD_REPLY_INSTRUCTIONS),
    'a correction can no longer say it replaced rather than duplicated'
  );
  assert.ok(
    /never for a NEW entry/.test(L.LEAD_REPLY_INSTRUCTIONS),
    'the exception is not held to corrections, so it licenses announcing every save'
  );
  return 'tool_choice none, and told so';
});

check('the old limits are lifted for this reply, and the new ones stated', () => {
  const t = L.LEAD_REPLY_INSTRUCTIONS;
  assert.ok(/REPLACE every earlier instruction/.test(t) && /a sentence or two/.test(t) && /no bullet points/.test(t), 'the old limits are not explicitly replaced');
  // "THINK ONE STEP AHEAD" BECAME "GIVE THEM THE FIRST STEP" on 14 October 2026,
  // and the rename is the point rather than a tidy-up. Thinking a step ahead
  // produced a list of things to ask and no way to reach anybody. Ruth, on a
  // reply that did exactly that: "it should alsways offer the next logical step
  // with any and all scripts, numbers, or link to follow... If i read that, i'd
  // think, ok, so contact the doctor, but i don't know how, the number says use
  // the online portal, i get lost inside it and there's noone to help me."
  assert.ok(
    /GIVE THEM THE FIRST STEP, NOT THE LIST/.test(t) && /KNOWS THEIR HISTORY/.test(t) && /CHECK WHAT YOU CAN/.test(t),
    'a promised behaviour is missing'
  );
  // AND THE REPLY STAYS WITH THEM AT THE HARD PART. A portal or a phone menu is
  // where somebody gives up, and nobody reports giving up - which is why care
  // drops off before it has started, in her words, and why this is checked
  // rather than left to the prompt's good intentions.
  assert.ok(/DO NOT ASSUME THE STEP IS EASY/.test(t), 'the reply assumes the next step is easy');
  assert.ok(/send me a screenshot/.test(t), 'the offer to look at where they got stuck is gone');
  assert.ok(/No exclamation marks/.test(t) && /never moralise/.test(t), 'her voice rules are missing');
  return 'history, next steps, checks, shape';
});

check('the outcome tells the model what happened, and what is waiting', () => {
  const base = { record: 'R', blocks: ['ME BLOCK', null, ''], guide: 'GUIDE' };
  const some = L.leadOutcome({ ...base, didLines: ['A save failed.'], offerWaiting: true });
  assert.ok(/- A save failed\./.test(some) && /AN OFFER IS WAITING/.test(some) && /ME BLOCK/.test(some) && /GUIDE/.test(some));
  const none = L.leadOutcome({ ...base, didLines: [], offerWaiting: false });
  assert.ok(/nothing was written/.test(none) && !/AN OFFER IS WAITING/.test(none));
  return 'outcomes, offers, blocks, guide';
});

check('a plain yes to a waiting offer is a yes', () => {
  for (const y of ['Yes', 'yes please', 'Yes.', 'Yeah', 'ok', 'Go ahead', 'please do', 'Save it', 'yes thanks']) {
    assert.ok(L.isBareYes(y), `"${y}" was not read as yes`);
  }
  for (const n of ['No', 'not yet', 'yes but change the title', 'Yes, and also log my lunch', '']) {
    assert.ok(!L.isBareYes(n), `"${n}" was read as a bare yes`);
  }
  const at = route.indexOf("if (pendingSave.proposal && !result.saveAnswer && isBareYes(message))");
  assert.ok(at > route.indexOf('if (isPhotoOnly) photoOnlyVerdict(result);'), 'the guard is missing, or runs before the photo allowlist');
  return 'bare yes read, anything more left to the model';
});

check('and this check can fail', () => {
  const old = "const written = speculationHeld\n      ? await spokenReplyInFlight\n      : await writeReplyAfterSaves({";
  assert.ok(!/leadMode/.test(old), 'the old reply step reads as leading');
  assert.ok(!L.isBareYes('yes but change the title'), 'the yes test passes anything');
  return 'the old reply step and a qualified yes both fail';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
