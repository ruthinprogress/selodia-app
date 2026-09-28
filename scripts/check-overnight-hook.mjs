// CAN THE OVERNIGHT HOOK LET GO? Three valves, each one proved.
//
// A Stop hook that can only say "keep going" is a trap, and this one writes to
// docs/progress.md, so it is not something to find out about at three in the
// morning. Every case below runs the real hook against a throwaway copy of the
// repository layout, so nothing here can touch the real progress file.
//
//   node scripts/check-overnight-hook.mjs

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOOK = path.resolve('scripts/overnight-stop-hook.mjs');

const QUEUE = `# Progress

## Overnight queue

- [x] 1. A thing already done
- [ ] 2. The next thing
- [ ] **blocked on Ruth** — something she has to answer
- [ ] 3. A later thing

## Something else entirely

- [ ] not a queue item, different section
`;

/** Build a throwaway repo, run the hook in it, hand back what it said. */
function run({ queue = QUEUE, state = null, off = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'overnight-'));
  fs.mkdirSync(path.join(dir, 'docs'));
  fs.mkdirSync(path.join(dir, '.claude'));
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(HOOK, path.join(dir, 'scripts', 'overnight-stop-hook.mjs'));
  fs.writeFileSync(path.join(dir, 'docs', 'progress.md'), queue);
  if (state) fs.writeFileSync(path.join(dir, '.claude', 'overnight-state.json'), JSON.stringify(state));
  if (off) fs.writeFileSync(path.join(dir, '.claude', 'overnight-off'), '');

  const out = execFileSync(process.execPath, ['scripts/overnight-stop-hook.mjs'], {
    cwd: dir,
    encoding: 'utf8',
  });
  return { out: out.trim(), progress: fs.readFileSync(path.join(dir, 'docs', 'progress.md'), 'utf8') };
}

const blocks = (r) => r.out.length > 0 && JSON.parse(r.out).decision === 'block';
const nextItem = (r) => (blocks(r) ? JSON.parse(r.out).reason.match(/\n\n {4}(.+)\n/)[1] : null);

const CASES = [
  {
    name: 'it blocks while an open item remains',
    check: () => blocks(run()),
  },
  {
    name: 'it picks the first UNTICKED item, skipping the done one',
    check: () => nextItem(run()) === '2. The next thing',
  },
  {
    name: 'an item marked blocked is not chosen',
    check: () => !/blocked on Ruth/.test(nextItem(run()) ?? ''),
  },
  {
    name: 'items under a LATER heading are not queue items',
    check: () => {
      const r = run({ queue: QUEUE.replace('- [ ] 2. The next thing\n', '').replace('- [ ] 3. A later thing\n', '') });
      return !blocks(r);
    },
  },
  {
    name: 'VALVE 1: the off switch stops it dead',
    check: () => !blocks(run({ off: true })),
  },
  {
    name: 'VALVE 2: the ceiling on continuations stops it',
    check: () => !blocks(run({ state: { continuations: 60, lastItem: null, sameItemCount: 0 } })),
  },
  {
    name: 'VALVE 3: the same item three times gets marked blocked, in the file',
    check: () => {
      const r = run({ state: { continuations: 5, lastItem: '2. The next thing', sameItemCount: 3 } });
      return !blocks(r) && /blocked on Ruth \(auto\)/.test(r.progress);
    },
  },
  {
    name: 'and after that marking, the run carries on with the item after it',
    check: () => {
      const r = run({ state: { continuations: 5, lastItem: '2. The next thing', sameItemCount: 3 } });
      const second = run({ queue: r.progress, state: { continuations: 6, lastItem: null, sameItemCount: 0 } });
      return nextItem(second) === '3. A later thing';
    },
  },
  {
    name: 'no queue section at all means it never blocks',
    check: () => !blocks(run({ queue: '# Progress\n\nNothing here.\n' })),
  },
  {
    name: 'every item ticked means it never blocks',
    check: () => !blocks(run({ queue: '# P\n\n## Overnight queue\n\n- [x] one\n- [x] two\n' })),
  },
  {
    name: 'a progress file it cannot parse fails OPEN, not closed',
    check: () => !blocks(run({ queue: '' })),
  },
];

let failed = 0;
for (const c of CASES) {
  let ok = false;
  try {
    ok = c.check() === true;
  } catch (err) {
    ok = false;
    console.log(`        ${err instanceof Error ? err.message : err}`);
  }
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
}

if (failed > 0) {
  console.error(`\n  ${failed} of ${CASES.length} failed. The hook is not safe to leave running.\n`);
  process.exit(1);
}
console.log(`\n  all ${CASES.length} passed: it blocks when it should and lets go three ways\n`);
