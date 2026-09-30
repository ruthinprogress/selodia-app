// `npm run web`, with a heap big enough to bundle this app.
//
// THE WEB DEV SERVER HAS NOW DIED OF THIS TWICE (22 and 24 September 2026).
// Node's default old-space is about 4 GB, and bundling expo-router's entry for
// web sits right on that line: it ran for six minutes, re-bundled on every
// request at roughly four minutes a time, and then went out with
//
//   FATAL ERROR: Ineffective mark-compacts near heap limit
//   Allocation failed - JavaScript heap out of memory
//
// The failure is invisible from the outside. Every navigation afterwards came
// back as Chrome's own "site can't be reached" page, whose location.pathname is
// "/" - so a screenshot run reported that three different routes had all
// redirected to the home screen, and that reads exactly like a routing bug in
// the app. Half an hour went into the wrong question. Another instance of an
// absent thing presenting as a working one.
//
// Raising the ceiling in .claude/launch.json is not possible - that file takes
// a command and arguments, not an environment - and the first fix (setting
// NODE_OPTIONS by hand before starting it) only helped whoever remembered. So
// it lives in the script the config already calls, and applies however the
// server is started.
//
// No new dependency: cross-env would do this in one line and is not installed,
// and a dependency added to somebody's app to set one variable is a poor trade.
//
// 8192 IS NOT ALWAYS AVAILABLE, and when it is not the failure looks the same
// (30 September 2026, overnight). Three starts died at exit 134 without ever
// answering on 8081. The machine has 15.9 GB with about 7.7 GB free while
// Chrome is open, so V8 asks for a ceiling the OS cannot supply and dies
// reaching for it.
//
// Lowering it does not help, which is worth writing down so nobody tries
// again: at 6144 the bundle grew to 6.1 GB and died anyway, so this genuinely
// needs more than 6 GB of old space. The fix is free memory, not a smaller
// ceiling - closing Chrome is usually enough.
//
// The tell that it is this and not a code fault: it never answers HTTP at all,
// and the log ends in "Reached heap limit" rather than in a stack trace from
// the app.

import { spawn } from 'node:child_process';

const HEAP = '--max-old-space-size=8192';

process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, HEAP].filter(Boolean).join(' ');

const child = spawn('npx', ['expo', 'start', '--web', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
