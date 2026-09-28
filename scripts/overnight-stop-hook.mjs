// THE OVERNIGHT STOP HOOK. Keep going until the queue is empty.
//
// Ruth, 28 September 2026: "Set up a Claude Code Stop hook that checks
// docs/progress.md when you try to stop: if unticked items remain that aren't
// marked 'blocked on Ruth', block the stop and continue with the next item."
//
// HOW IT WORKS. Claude Code runs this when the assistant is about to finish its
// turn. It reads the OVERNIGHT QUEUE section of docs/progress.md, finds the
// first `- [ ]` item that is not marked blocked, and tells Claude to carry on
// with it. When every item is ticked or blocked, it says nothing and the turn
// ends normally.
//
// THREE WAYS IT LETS GO, because a hook that can only say "keep going" is a trap:
//
//   1. NO QUEUE, NO BLOCK. If docs/progress.md has no "## Overnight queue"
//      heading, this does nothing at all. Deleting that section ends the run.
//   2. THE SAME ITEM THREE TIMES. If the next item has not changed across three
//      consecutive stops, it is marked blocked IN THE FILE with the reason, and
//      the run moves to whatever is after it. An item cannot loop forever.
//   3. A HARD CEILING of MAX_CONTINUATIONS. Whatever else is true, the hook
//      stops blocking after that many turns.
//
// AND AN OFF SWITCH THAT NEEDS NO TOOLS: create a file called
// `.claude/overnight-off`. The hook checks for it first and does nothing.
//
// IT FAILS OPEN. Every error path here exits 0 with no output, which means the
// turn ends normally. A bug in this file must never be able to trap a session.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PROGRESS = path.join(ROOT, 'docs', 'progress.md');
const OFF_SWITCH = path.join(ROOT, '.claude', 'overnight-off');
const STATE = path.join(ROOT, '.claude', 'overnight-state.json');

// Roughly a long night's work. High enough not to cut the run short, low enough
// that a loop nobody is watching cannot run until morning.
const MAX_CONTINUATIONS = 60;
// Three stops on the same item means it is not moving.
const SAME_ITEM_LIMIT = 3;

const HEADING = /^##\s+Overnight queue/im;
const ITEM = /^\s*-\s*\[( |x|X)\]\s*(.+)$/;

function done() {
  process.exit(0);
}

try {
  if (fs.existsSync(OFF_SWITCH)) done();
  if (!fs.existsSync(PROGRESS)) done();

  const text = fs.readFileSync(PROGRESS, 'utf8');
  const start = text.search(HEADING);
  if (start < 0) done();

  // The queue runs to the next `## ` heading, so later sections of the progress
  // file cannot be mistaken for queue items.
  const after = text.slice(start + 1);
  const nextHeading = after.search(/^##\s+/m);
  const block = nextHeading < 0 ? after : after.slice(0, nextHeading);

  const lines = block.split(/\r?\n/);
  const open = [];
  for (const line of lines) {
    const m = line.match(ITEM);
    if (!m) continue;
    const ticked = m[1] !== ' ';
    const label = m[2].trim();
    // "blocked" anywhere in the item takes it out of the running, which is how
    // the standing rule already words it: blocked items go to Questions for Ruth.
    if (!ticked && !/blocked/i.test(label)) open.push({ line, label });
  }

  if (open.length === 0) done();

  let state = { continuations: 0, lastItem: null, sameItemCount: 0 };
  try {
    state = { ...state, ...JSON.parse(fs.readFileSync(STATE, 'utf8')) };
  } catch {
    // No state yet, or it is unreadable. Start from zero rather than give up.
  }

  if (state.continuations >= MAX_CONTINUATIONS) {
    fs.writeFileSync(
      STATE,
      JSON.stringify({ ...state, stoppedBecause: 'max continuations reached' }, null, 2)
    );
    done();
  }

  const next = open[0];
  const same = state.lastItem === next.label;
  const sameItemCount = same ? state.sameItemCount + 1 : 1;

  if (sameItemCount > SAME_ITEM_LIMIT) {
    // THREE STOPS AND NO MOVEMENT. Mark it blocked in the file, with the reason,
    // so the next evaluation skips it and the run continues with the rest.
    const marked = text.replace(
      next.line,
      next.line.replace(
        /^(\s*-\s*\[ \]\s*)/,
        `$1**blocked on Ruth (auto):** no progress across ${SAME_ITEM_LIMIT} stops. `
      )
    );
    fs.writeFileSync(PROGRESS, marked, 'utf8');
    fs.writeFileSync(
      STATE,
      JSON.stringify({ ...state, lastItem: null, sameItemCount: 0 }, null, 2)
    );
    // Let this turn end. The next one sees a shorter queue.
    done();
  }

  fs.writeFileSync(
    STATE,
    JSON.stringify(
      {
        continuations: state.continuations + 1,
        lastItem: next.label,
        sameItemCount,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  const remaining = open.length;
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason:
        `The overnight queue in docs/progress.md still has ${remaining} open item` +
        `${remaining === 1 ? '' : 's'}. Continue with the next one:\n\n` +
        `    ${next.label}\n\n` +
        'Work it, tick it off in docs/progress.md, and split it into smaller ' +
        'steps in that file as you go so an interruption loses nothing. If it ' +
        'cannot be done without Ruth, mark it "blocked on Ruth" with the reason ' +
        'and move to the next item. ' +
        `(Continuation ${state.continuations + 1} of ${MAX_CONTINUATIONS}.)`,
    })
  );
  process.exit(0);
} catch {
  // FAILS OPEN, deliberately. See the note at the top.
  process.exit(0);
}
