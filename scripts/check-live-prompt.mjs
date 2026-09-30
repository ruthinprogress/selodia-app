// THE PROMPT THAT ACTUALLY WRITES HER REPLIES, AND THE CONTEXT IT IS GIVEN.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-live-prompt.mjs
//
// WHY THIS EXISTS. On 30 September Ruth pasted three skincare products and was
// told "I can't update the Me plan, and none of this is in your record", twice,
// and then - after saying Yes to the app's own offer - "that was a mistake on
// my part to ask, I actually can't add anything to your Me tab from here".
//
// Nothing was broken in the way that reads. There are two chat paths, the
// switch has been on the NEW one for text since 28 September, and:
//
//   the new prompt had no sentence about the Me tab at all, so the model did
//   not know the capability existed;
//
//   `extraBlocks` - the parameter whose own comment says "context blocks the
//   old path built that the new prompt still needs" - was never passed, so the
//   block listing her Me cards reached the OLD path only. "None of this is in
//   your record" was true of the record the writer was given.
//
// Both are absences. Neither shows up in a typecheck, a lint or any test that
// asks whether a function returns the right value, and the fix for each is one
// line that a future edit can silently drop again.
//
// So this checks the two things that were missing, and it checks them against
// the LIVE path rather than the one I spent an hour editing by mistake.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { replyPrompt, REPLY_PROMPT_PARTS } from '../app/lib/reply-prompt.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').split('\r\n').join('\n');

let pass = 0;
const failures = [];
const check = (name, fn) => {
  try {
    fn();
    pass += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
};

// ---------------------------------------------------- the capability is stated

const prompt = replyPrompt({ voice: false });

check('the live prompt tells the model it can add to the Me tab', () => {
  assert.ok(/me tab/i.test(prompt), 'the Me tab is not mentioned at all');
  assert.ok(
    /you can add to it and change it/i.test(prompt),
    'the prompt must say plainly that it CAN add to and change Me'
  );
});

check('and tells it never to claim it cannot', () => {
  assert.ok(
    /never tell her you cannot add to her me tab/i.test(prompt),
    'the exact refusal she hit must be forbidden by name'
  );
});

check('it must offer first and save on a yes', () => {
  assert.ok(/offer first and save on her yes/i.test(prompt));
});

check('it must not take back an offer the app has already made', () => {
  assert.ok(/never say you asked by mistake/i.test(prompt));
});

check('it must summarise rather than copy a long paste', () => {
  assert.ok(/summarise, never copy out/i.test(prompt));
});

check('it must not write an outcome she did not state', () => {
  // Tightened 30 September after "Redness already reducing" appeared in a
  // proposal. She had not typed it - it came out of the text she pasted, which
  // is not the same as her saying it.
  assert.ok(/only what she typed/i.test(prompt), 'the pasted-text rule must be stated');
  assert.ok(
    /never propose or store a current result or a prediction/i.test(prompt),
    'a result and a prediction must both be named'
  );
  assert.ok(/redness already reducing/i.test(prompt), 'the real example earns its place');
});

check('proposals must be glanceable, grouped, and free of markdown', () => {
  assert.ok(/one line per thing/i.test(prompt));
  assert.ok(/group them under morning and evening/i.test(prompt));
  assert.ok(/never asterisks or other markdown/i.test(prompt));
});

check('it must never scold her for repeating herself', () => {
  assert.ok(/never tell her off/i.test(prompt));
  assert.ok(/repeating it will not help/i.test(prompt));
});

// ------------------------------------------------- it does not disown the app

check('the prompt tells it that it IS the app', () => {
  assert.ok(/you are not a visitor here/i.test(prompt), 'the rule must be stated');
  assert.ok(
    /never say you do not control something/i.test(prompt),
    'the exact answer she got must be forbidden by name'
  );
  assert.ok(
    /what is stored is in the record below/i.test(prompt),
    'it must be told where to look instead of saying it cannot see'
  );
});

check('NO OTHER RULE SPEAKS OF "the app" IN THE THIRD PERSON', () => {
  // THIS IS THE ONE THAT MATTERS, and it is the cause rather than the symptom.
  // Three rules used to say "the app shows its own save confirmation", "the app
  // does the writing and tells her itself", "the app keeps her words". Each was
  // written to stop a receipt; together they handed the model a second party to
  // point at, and on 30 September at 2:27pm it pointed: "I don't control that,
  // only the app does."
  //
  // INSIDE_THE_APP is exempt because naming the phrase is how it forbids it.
  const offenders = [];
  for (const [name, text] of Object.entries(REPLY_PROMPT_PARTS)) {
    if (name === 'INSIDE_THE_APP') continue;
    const hit = String(text).match(/[^.!?]*\bthe app\b[^.!?]*/i);
    if (hit) offenders.push(`${name}: "${hit[0].trim()}"`);
  }
  assert.equal(
    offenders.length,
    0,
    'a rule speaks of the app as somebody else, which is where "only the app does" came from:\n      ' +
      offenders.join('\n      ')
  );
});

check('the voice prompt carries the same capability', () => {
  assert.ok(/me tab/i.test(replyPrompt({ voice: true })));
});

// ------------------------------------------------ the context is actually passed

const route = read('app/api/ask-selodia/route.ts');

check('meCardsBlock is built', () => {
  assert.ok(/const meCardsBlock\s*=/.test(route));
});

check('EVERY call to the live writer is given extraBlocks', () => {
  // The bug was not that extraBlocks did not exist. It was that it existed,
  // was documented, and was passed by nobody.
  const calls = route.split('writeReplyAfterSaves({').slice(1);
  assert.ok(calls.length >= 2, `expected at least 2 writer calls, found ${calls.length}`);
  calls.forEach((call, i) => {
    // The call ends at its closing "});" - near enough for this, since the
    // object is written flat.
    const body = call.slice(0, call.indexOf('\n        })'));
    assert.ok(
      body.includes('extraBlocks'),
      `writer call ${i + 1} does not pass extraBlocks, so the model cannot see her Me tab`
    );
    assert.ok(
      body.includes('meFactsBlock'),
      `writer call ${i + 1} passes extraBlocks without her Me cards`
    );
    // AND NEVER THE INSTRUCTION BLOCK. meCardsBlock tells the CLASSIFY call to
    // emit `proposedSave`; the writer has no tool to put one in, so handing it
    // that sentence makes it type the JSON into her message. It did, twice, on
    // 30 September at 11:32 and 11:35.
    assert.ok(
      !body.includes('meCardsBlock'),
      `writer call ${i + 1} is given meCardsBlock, which contains tool instructions - that is what made it print raw JSON to her`
    );
  });
});

check('the Me cards block carries the card CONTENTS, not just titles', () => {
  const block = route.slice(route.indexOf('const meCardsBlock'), route.indexOf('const plansBlock'));
  assert.ok(/why:/.test(block), 'the why must be shown, or the model cannot see the reason');
  assert.ok(/item:/.test(block), 'the items must be shown, or it cannot see what is on the card');
});

// --------------------------------------------------------------------- MUTATION
//
// Prove each half can fail: strip the capability, and drop extraBlocks.

const withoutCapability = prompt.replace(/YOU CAN ADD TO IT AND CHANGE IT[\s\S]*?You can\./, '');
const withoutBlocks = route.split('extraBlocks').join('xxBlocks');

let capabilityCaught = false;
try {
  assert.ok(/you can add to it and change it/i.test(withoutCapability));
} catch {
  capabilityCaught = true;
}

let blocksCaught = false;
try {
  const calls = withoutBlocks.split('writeReplyAfterSaves({').slice(1);
  calls.forEach((call) => {
    const body = call.slice(0, call.indexOf('\n        })'));
    assert.ok(body.includes('extraBlocks'));
  });
} catch {
  blocksCaught = true;
}

let disavowalCaught = false;
try {
  const withoutRule = prompt.replace(/YOU ARE NOT A VISITOR HERE[\s\S]*?"I can't see" is not\./, '');
  assert.ok(/you are not a visitor here/i.test(withoutRule));
} catch {
  disavowalCaught = true;
}

let thirdPersonCaught = false;
try {
  const parts = { ...REPLY_PROMPT_PARTS, SAVES: 'the app keeps her words and has already retried.' };
  const offenders = [];
  for (const [name, text] of Object.entries(parts)) {
    if (name === 'INSIDE_THE_APP') continue;
    if (/\bthe app\b/i.test(String(text))) offenders.push(name);
  }
  assert.equal(offenders.length, 0);
} catch {
  thirdPersonCaught = true;
}

if (!capabilityCaught) failures.push('USELESS: removing the capability sentence did not fail the check');
if (!blocksCaught) failures.push('USELESS: removing extraBlocks did not fail the check');
if (!disavowalCaught) failures.push('USELESS: removing the disavowal rule did not fail the check');
if (!thirdPersonCaught) failures.push('USELESS: putting "the app" back into a rule did not fail the check');

for (const f of failures) console.error('  FAIL  ' + f);
console.log(`\n  ${pass} passed, ${failures.length} failed`);
console.log(
  `  Proof: removing the capability is caught = ${capabilityCaught}, removing extraBlocks is caught = ${blocksCaught}`
);
if (failures.length > 0) process.exit(1);
