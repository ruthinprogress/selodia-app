// EVERY REPLY THAT REACHES SOMEBODY HAS BEEN THROUGH THE ALLERGY GATE.
//
// Written 28 September 2026, after finding that one of them had not been.
//
// WHAT WENT WRONG. `runAllergyGate` is called once, on the reply the OLD path
// wrote, and `turnIsOrdinary` asks whether THAT one passed before letting the
// rebuilt path run. The rebuilt path then writes a completely different sentence
// and that sentence went straight to chat_messages. So for anybody with a
// declared food allergy, the gate was checking a draft that was thrown away -
// which is worse than no gate, because the turn is recorded as gated.
//
// It survived a typecheck, a lint and a day of use. Nothing about it is visible
// in the shape of the code: both branches assign to `replyBody` and only one of
// them had been checked.
//
// WHAT THIS CHECKS, and what it cannot. It reads the route and asserts that
// every assignment which puts MODEL-WRITTEN words into `replyBody` is preceded
// by a gate call. That is a structural check and it is blunt: it cannot prove
// the gate works (probe-allergy-gate.mjs does that, against the real model) and
// it will not survive a large refactor of the route. What it does is fail the
// moment somebody adds a third way for the model's words to reach her, or
// deletes one of the two gate calls, which is exactly how this one got in.
//
//   node scripts/check-gated-paths.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROUTE = path.join(process.cwd(), 'app', 'api', 'ask-selodia', 'route.ts');

function audit(source) {
  const failures = [];

  // Every gate call, in order, with where it is.
  const gates = [...source.matchAll(/runAllergyGate\s*\(/g)].map((m) => m.index);

  // Every place the model's own words become the reply. `safeReplyText` is the
  // gated old path and `blockedSuggestionMessage` is the gate's own refusal, so
  // neither of those counts - what matters is raw model output.
  const assignments = [...source.matchAll(/replyBody\s*=\s*([A-Za-z_$][\w$.]*)/g)]
    .map((m) => ({ at: m.index, from: m[1] }))
    .filter((a) => a.from !== 'blockedSuggestionMessage');

  if (gates.length < 2) {
    failures.push(
      `Only ${gates.length} call(s) to runAllergyGate. There are two reply paths and ` +
        'each one needs its own - the old path\'s reply and the rebuilt one are ' +
        'different sentences, and gating one proves nothing about the other.'
    );
  }

  for (const a of assignments) {
    const gatedBefore = gates.some((g) => g < a.at);
    if (!gatedBefore) {
      failures.push(
        `replyBody is set from \`${a.from}\` at character ${a.at} with no runAllergyGate ` +
          'call before it. Model-written words must be gated before they become the reply.'
      );
    }
  }

  // The rebuilt path specifically: its assignment must sit after a SECOND gate,
  // not merely after the first one, because the first gated a different draft.
  // ADOPTED THROUGH A WRAPPER SINCE 30 SEPTEMBER. The rebuilt reply is now
  // `stripMachineOutput(written.text)` - the strip that keeps a proposedSave
  // object out of her message. It is still the same assignment in the same
  // branch, still after the second gate, so this check matches either spelling
  // rather than being loosened to match anything.
  // The capture above stops at the first non-identifier character, so a wrapped
  // adoption reads as the wrapper's name rather than the whole expression.
  const written = assignments.find(
    (a) => a.from === 'written.text' || a.from === 'stripMachineOutput'
  );
  if (!written) {
    failures.push(
      "Could not find `replyBody = written.text`, which is how the rebuilt path's " +
        'reply is adopted. Either it was renamed - update this check - or the ' +
        'rebuilt path no longer works the way this check assumes.'
    );
  } else if (gates.filter((g) => g < written.at).length < 2) {
    failures.push(
      'The rebuilt reply is adopted after only ONE gate call. That call ran on the ' +
        'old path\'s reply, which is a different sentence and was thrown away. ' +
        'This is the exact bug of 28 September 2026.'
    );
  }

  return failures;
}

const source = fs.readFileSync(ROUTE, 'utf8');
const failures = audit(source);

// CAN THIS CHECK FAIL? The bug is reconstructed by deleting the second gate call
// and the run refuses to pass unless the reconstruction is caught. A structural
// check that nobody has ever seen fail is a comment with a shebang.
const withoutSecondGate = (() => {
  let seen = 0;
  return source.replace(/runAllergyGate\s*\(/g, (m) => (++seen === 2 ? 'notTheGate(' : m));
})();
if (audit(withoutSecondGate).length === 0) {
  console.error(
    '\n  THE CHECK IS NOT REAL. With the second gate call removed it still passed.\n'
  );
  process.exit(1);
}

if (failures.length > 0) {
  console.error('\n  UNGATED REPLY PATH\n');
  for (const f of failures) console.error('    ' + f + '\n');
  process.exit(1);
}

console.log('  PASS  both reply paths are gated');
console.log('  PASS  the check fails when the second gate is removed');
