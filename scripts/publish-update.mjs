// PUBLISH AN UPDATE TO EVERY BRANCH A REAL BUILD LISTENS TO.
//
//   node scripts/publish-update.mjs "the message"
//
// Ruth, 10 October 2026: "thats the latest update.....i don't think youre
// publishing to the right place."
//
// Two days of work went to `production` while her phone, an internal APK on the
// `preview` channel, sat on 7 October. Every publish reported success. The CLI
// only ever claims PUBLISHED; DELIVERED is a different claim and nothing was
// making it.
//
// There is no --branch flag here on purpose. Choosing the branch by hand is the
// thing that went wrong, and a second guard reminding me to choose carefully is
// the kind of instruction that was already written and already ignored. So this
// takes the choice away: it publishes to every branch that a finished build
// actually points at, which is both of them, and then reads back what landed.

import { execFileSync } from 'node:child_process';
import { DELIVERY_BRANCH } from './update-target.mjs';

const MOBILE = 'mobile';
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const message = process.argv.slice(2).join(' ').trim();

if (!message) {
  console.error('  a message is required: node scripts/publish-update.mjs "what changed"');
  process.exit(2);
}
// The message reaches a shell on Windows, so it is passed as one argument and
// held to characters that cannot close a quote or start a command.
//
// NOT A REGEX, deliberately. The first version of this line was written into the
// file through a shell heredoc, which ate one backslash and turned
//   /["'`$\\\r\n]/   into   /["'`$\\r\n]/
// - a class that matches the LETTER R. It then refused every message with an "r"
// in it, including the one being published, and the refusal read like a rule
// working rather than a rule broken. An explicit list cannot rot that way.
const FORBIDDEN = ['"', "'", '`', '$', '\\', '\r', '\n'];
const bad = FORBIDDEN.filter((c) => message.includes(c));
if (bad.length > 0 || message.length > 200) {
  console.error(
    `  the message must be under 200 plain characters with no quotes or backslashes` +
      (bad.length ? ` (found ${bad.map((c) => JSON.stringify(c)).join(', ')})` : '')
  );
  process.exit(2);
}

function eas(args, { capture = true } = {}) {
  // NPX IS A .cmd ON WINDOWS, so this runs through a shell - and a shell splits
  // arguments on spaces regardless of how carefully they were passed as an
  // array. The first run of this script sent the message unquoted and the CLI
  // reported "Unexpected arguments: from, 8, and, 9, October,". Anything with a
  // space is quoted here; the message is already refused if it contains a quote
  // of its own, so there is nothing to escape.
  const quoted = args.map((a) => (process.platform === 'win32' && /\s/.test(a) ? `"${a}"` : a));
  return execFileSync(NPX, ['eas-cli', ...quoted], {
    cwd: MOBILE,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    maxBuffer: 1024 * 1024 * 32,
    shell: process.platform === 'win32',
  });
}

function jsonOf(args) {
  const out = eas([...args, '--non-interactive', '--json']);
  const at = Math.min(
    ...[out.indexOf('['), out.indexOf('{')].filter((i) => i >= 0).concat([Infinity])
  );
  return Number.isFinite(at) ? JSON.parse(out.slice(at)) : null;
}

// WHICH BRANCHES HAVE A LISTENER. A channel serves a branch; a build names a
// channel. A branch with no finished build behind it is the ghost `production`
// was for nine days, so it is not worth publishing to and not worth waiting for.
const channels = jsonOf(['channel:list']);
const chans = Array.isArray(channels) ? channels : (channels?.currentPage ?? []);
const builds = jsonOf(['build:list', '--platform', 'android', '--limit', '10']);
const bl = (Array.isArray(builds) ? builds : (builds?.currentPage ?? []))
  .filter((b) => (b.status ?? '').toLowerCase() === 'finished')
  .map((b) => b.updateChannel?.name ?? b.channel)
  .filter(Boolean);
const listening = new Set(bl);

const targets = [];
for (const c of chans) {
  if (!listening.has(c.name)) continue;
  const mapping = typeof c.branchMapping === 'string' ? JSON.parse(c.branchMapping) : c.branchMapping;
  const ids = new Set((mapping?.data ?? []).map((d) => d?.branchId).filter(Boolean));
  for (const u of c.updateBranches ?? []) {
    if (u?.name && (ids.size === 0 || ids.has(u.id))) targets.push(u.name);
  }
}
const branches = [...new Set(targets)];

if (!branches.includes(DELIVERY_BRANCH)) {
  console.error(
    `  REFUSING: "${DELIVERY_BRANCH}" is the branch her phone reads and no finished build ` +
      `points at it. Branches with a listener: ${branches.join(', ') || '(none)'}.`
  );
  process.exit(1);
}

// BUNDLE ONCE. Every `eas update` runs a full export, which takes ten minutes or
// more on this project, and a second one would also produce a DIFFERENT bundle
// for the same source - two branches that are meant to be the same build and are
// not quite. So the delivery branch is published and the rest are republished
// from that exact group.
console.log(`\n  publishing to ${DELIVERY_BRANCH}, then republishing to the rest\n`);
eas(
  ['update', '--branch', DELIVERY_BRANCH, '--environment', 'production', '--message', message, '--non-interactive'],
  { capture: false }
);

// `branch:view --json` returns {name, id, currentPage: [...]}, and each entry's
// `message` is DECORATED - the text in quotes followed by "(just now by ...)".
// The first version of this read `.updates` and compared the message for
// equality, so it found nothing and said "published, but could not read back the
// group" about a publish that had worked perfectly. The group id is exact; the
// message is only ever checked by containment.
function topOf(branch) {
  const v = jsonOf(['branch:view', branch]);
  return (v?.currentPage ?? [])[0] ?? null;
}

const published = topOf(DELIVERY_BRANCH);
const group = published?.group;
if (!group || !published.message?.includes(message)) {
  console.error(
    `\n  published, but ${DELIVERY_BRANCH} reads back as ${JSON.stringify(published?.message ?? null)}.\n`
  );
  process.exit(1);
}
for (const branch of branches) {
  if (branch === DELIVERY_BRANCH) continue;
  eas(
    ['update:republish', '--group', group, '--destination-branch', branch, '--message', message, '--non-interactive'],
    { capture: false }
  );
}

// AND READ BACK WHAT LANDED, because this whole script exists because a success
// line was trusted as evidence of delivery.
console.log('\n  what each branch now serves:\n');
let notServing = 0;
for (const branch of branches) {
  const latest = topOf(branch);
  const landed = Boolean(latest?.message?.includes(message));
  if (!landed) notServing += 1;
  console.log(`  ${landed ? 'OK  ' : 'BAD '} ${branch}: ${latest?.message ?? '(nothing)'}`);
}
if (notServing > 0) {
  console.log('\n  a branch is not serving what was just published.\n');
  process.exit(1);
}
console.log(`\n  delivered to ${branches.join(' and ')}.\n`);
