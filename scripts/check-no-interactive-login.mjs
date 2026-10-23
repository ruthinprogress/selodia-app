// NOTHING IN THIS REPOSITORY TELLS ANYBODY TO RUN AN INTERACTIVE LOGIN.
//
//   node scripts/check-no-interactive-login.mjs
//
// Ruth, 23 October 2026, setting up a server she means never to sit in front of
// again: "please make sure this is very clear so this never happens, in all
// specs and anywhere it might happen."
//
// THE RULE. `vercel login`, `eas login` and `expo login` create a browser
// session with an expiry. Refreshing one restarts the same clock, and when it
// lapses the only way back is a browser ON THAT MACHINE. A headless box has no
// browser, so the lapse is a locked door. A token is a string in a file with no
// expiry and never needs a person again. See WORKFLOW.md, "never an interactive
// login".
//
// THE FAILURE IS NOT SOMEBODY CHOOSING TO LOG IN. It is a check failing,
// printing a fix, and somebody doing what the screen says.
// check-update-reaches-phone.mjs said "Run `npx eas-cli login` from mobile/"
// until the day this was written - a line that, followed once on the server, is
// the entire failure. A doc from 1 October said "`npx vercel login` when
// convenient". Neither was written carelessly; both were correct advice for a
// laptop, and nothing marked the day that stopped being true.
//
// SO THIS DOES NOT BAN THE PHRASE, which would be unworkable: the scripts that
// REPLACE these logins have to name them to explain themselves, and the history
// is worth keeping. It requires that every mention CARRIES THE WARNING - a
// prohibition within three lines. Explain them as much as you like; never leave
// one looking like advice.
//
// WHY PROXIMITY RATHER THAN A FILE ALLOWLIST. An allowlist exempts a whole file
// forever, so the next person to add a line to an already-listed file adds it
// unguarded and nothing notices. Three lines is close enough that the warning is
// on screen with the thing it warns about, which is the only place it does any
// good.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOTS = ['scripts', 'docs', 'app', 'mobile/src', '.'];
const EXTS = new Set(['.md', '.mjs', '.js', '.ts', '.tsx', '.cmd', '.py', '.json', '.txt']);
const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.expo', 'android', 'ios']);

// The commands that create an expiring browser session.
const LOGIN = /\b(?:vercel|eas|eas-cli|expo)\s+login\b/i;

// What counts as the warning being present. Deliberately broad: the point is to
// force the thought, not to dictate a sentence. A check anchored on one phrasing
// is a check testing a wording rather than a behaviour, which this repository
// has been bitten by more than once.
const WARNED =
  /\bnever\b|\bdo not\b|\bdon't\b|\bdoes not\b|\bstop\b|\bstrand|\binstead of\b|\brather than\b|\bused to say\b|\bexpir|\bNOT\b|\bwrong\b|\bcorrected\b|\bno longer\b|\bavoid\b|\breplaces?\b/i;

const CONTEXT = 3;

function walk(dir, out = [], depth = 0) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP.has(name) || name.startsWith('.env')) continue;
    const full = path.join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      // The '.' root is only scanned shallowly, or it rediscovers everything.
      if (depth < 6) walk(full, out, depth + 1);
    } else if (EXTS.has(path.extname(name))) {
      out.push(full);
    }
  }
  return out;
}

const seen = new Set();
const files = [];
for (const root of ROOTS) {
  for (const f of walk(root, [], root === '.' ? 5 : 0)) {
    const key = path.resolve(f);
    if (!seen.has(key)) {
      seen.add(key);
      files.push(f);
    }
  }
}

const offences = [];
let mentions = 0;

for (const file of files) {
  let lines;
  try {
    lines = readFileSync(file, 'utf8').split(/\r?\n/);
  } catch {
    continue;
  }
  // This file names the commands in order to forbid them; its own regex would
  // match itself on every line.
  if (path.basename(file) === 'check-no-interactive-login.mjs') continue;

  for (let i = 0; i < lines.length; i += 1) {
    if (!LOGIN.test(lines[i])) continue;
    mentions += 1;
    const from = Math.max(0, i - CONTEXT);
    const to = Math.min(lines.length, i + CONTEXT + 1);
    const nearby = lines.slice(from, to).join('\n');
    if (!WARNED.test(nearby)) {
      offences.push({ file, line: i + 1, text: lines[i].trim().slice(0, 110) });
    }
  }
}

console.log('  NO INTERACTIVE LOGIN\n');
console.log(`  scanned ${files.length} files, found ${mentions} mention(s) of an interactive login`);

if (offences.length === 0) {
  console.log(`  every one of them carries a warning within ${CONTEXT} lines\n`);
  console.log(`  ${mentions} mention(s) checked, 0 unguarded`);
  process.exit(0);
}

console.log('');
for (const o of offences) {
  console.log(`  UNGUARDED  ${o.file}:${o.line}`);
  console.log(`             ${o.text}`);
}
console.log('');
console.log('  Each of these names a command that creates an EXPIRING browser session.');
console.log('  On a machine with no screen its lapse is a locked door, and the realistic');
console.log('  way that happens is somebody reading a fix off a screen and doing it.');
console.log('  Say so beside it, or say what to do instead: a token in .env.local.');
console.log('  See "never an interactive login" in mobile/WORKFLOW.md.');
console.log('');
console.log(`  ${mentions} mention(s) checked, ${offences.length} unguarded`);
process.exit(1);
