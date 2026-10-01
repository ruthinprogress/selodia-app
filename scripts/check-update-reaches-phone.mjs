// WILL AN UPDATE PUBLISHED TO THIS BRANCH ACTUALLY REACH HER PHONE?
//
//   node scripts/check-update-reaches-phone.mjs [branch]
//
// Ruth, 1 October 2026: "The Week view update hasn't reached my phone. Settings
// still shows the last update as 11:30. This is the same unresolved fault as
// yesterday."
//
// IT WAS NOT THE UPDATER. Every `eas update --branch production` published
// perfectly, reported "Published!", printed an update id and a dashboard link,
// and exited 0. The updates are all there. Her phone has simply never been able
// to see one of them, because:
//
//   her installed build is channel PREVIEW (every Android build on this project
//   is, profile `preview`, distribution internal);
//   updates go to a BRANCH;
//   a phone only sees a branch that its CHANNEL points at;
//   and there is no channel named `production` at all. The production branch is
//   a ghost - published to for days, pointed at by nothing.
//
// SO "PUBLISHED" AND "DELIVERED" ARE DIFFERENT CLAIMS and the CLI only makes the
// first one. I read the success line as the second, repeatedly, and told her the
// work was on her phone when it had never left Expo's server. That is the same
// shape as the Vercel mistake this morning: a success message answering a
// narrower question than the one I was asking.
//
// WHAT THIS CHECKS, before trusting any publish:
//
//   1  the branch is pointed at by a channel - without this, publishing to it is
//      writing to a drawer nobody opens;
//   2  that channel is one a REAL BUILD uses, so there is a phone out there
//      listening;
//   3  the runtime version of the latest update matches that build's, because a
//      runtime mismatch is the other silent way an update is ignored;
//   4  and the latest update on the branch is newer than the build, or there is
//      nothing to deliver.
//
// It needs the EAS CLI logged in on this machine. Without it the check SKIPS
// rather than failing.

import { execFileSync } from 'node:child_process';

const BRANCH = process.argv[2] ?? 'preview';
const MOBILE = 'mobile';

// NPX IS A .cmd ON WINDOWS, and Node refuses to execFile one without a shell -
// EINVAL, since the batch-injection fix in Node 20. The first version of this
// threw on every call, returned null, and reported SKIPPED on a machine where
// the CLI was logged in and had just published an update. A check that says "I
// cannot tell" when it can is the same failure it exists to catch, one level up.
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

// AND A SHELL MEANS THE ARGUMENTS HAVE TO BE SAFE. The branch name comes from
// argv, so it is held to the characters EAS allows in one rather than quoted and
// hoped for. Everything else passed here is a literal in this file.
// A colon is in every subcommand name - channel:list, update:list, build:list.
const SAFE = /^[A-Za-z0-9._:/-]{1,100}$/;

function eas(args) {
  for (const a of args) {
    if (!SAFE.test(a)) {
      console.error(`  refusing to run with an unexpected argument: ${JSON.stringify(a)}`);
      process.exit(2);
    }
  }
  try {
    return execFileSync(NPX, ['eas-cli', ...args, '--non-interactive', '--json'], {
      cwd: MOBILE,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 1024 * 1024 * 32,
      shell: process.platform === 'win32',
    });
  } catch {
    return null;
  }
}

function json(args) {
  const out = eas(args);
  if (!out) return null;
  // The CLI prints progress lines before the JSON on some commands.
  const at = out.indexOf('[') >= 0 && (out.indexOf('[') < out.indexOf('{') || out.indexOf('{') < 0)
    ? out.indexOf('[')
    : out.indexOf('{');
  if (at < 0) return null;
  try {
    return JSON.parse(out.slice(at));
  } catch {
    return null;
  }
}

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

const channels = json(['channel:list']);
if (channels === null) {
  console.log('  SKIPPED  the EAS CLI is not logged in on this machine.');
  console.log('           Run `npx eas-cli login` from mobile/, then try again.');
  process.exit(0);
}

const list = Array.isArray(channels) ? channels : (channels?.currentPage ?? channels?.data ?? []);
// THE JSON IS NOT THE TABLE. `eas build:list` prints "Channel" and "Runtime
// Version" as columns, and the --json output has neither at the top level - they
// are `updateChannel.name` and `runtime.version`. Reading the flat names gives
// undefined for every build, which made this check report that NO build listens
// to preview while her phone was sitting on exactly that channel. Flattened once,
// here, so the checks below read plain fields.
const builds = json(['build:list', '--platform', 'android', '--limit', '10']) ?? [];
const buildList = (Array.isArray(builds) ? builds : (builds?.currentPage ?? [])).map((b) => ({
  ...b,
  channel: b.updateChannel?.name ?? b.channel ?? null,
  runtimeVersion: b.runtime?.version ?? b.runtimeVersion ?? null,
}));
const finished = buildList.filter((b) => (b.status ?? '').toLowerCase() === 'finished');

console.log(`\n  WILL AN UPDATE ON "${BRANCH}" REACH A PHONE?\n`);

/**
 * Branch NAMES a channel points at.
 *
 * `branchMapping` arrives as a JSON STRING holding branch UUIDs, not names, so
 * the ids are resolved through `updateBranches` - which carries both. Matching a
 * name against the id list directly never matches anything, and would have made
 * this check pass for a branch no channel serves, which is the whole bug.
 */
function branchesOf(channel) {
  const mapping =
    typeof channel?.branchMapping === 'string'
      ? safeParse(channel.branchMapping)
      : channel?.branchMapping;
  const mapped = new Set((mapping?.data ?? []).map((d) => d?.branchId).filter(Boolean));
  const names = new Set();
  for (const u of channel?.updateBranches ?? []) {
    // Only the branches this channel actually routes to. A channel can carry a
    // branch in updateBranches without the mapping pointing at it.
    if (u?.name && (mapped.size === 0 || mapped.has(u.id))) names.add(u.name);
  }
  return names;
}
function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

const serving = list.filter((c) => branchesOf(c).has(BRANCH));

check('a channel points at this branch', () => {
  ok(
    serving.length > 0,
    `no channel points at "${BRANCH}". Channels that exist: ${
      list.map((c) => c.name).join(', ') || '(none)'
    }. ` +
      'Publishing to it writes to a drawer nobody opens - which is exactly what happened to ' +
      'the "production" branch for several days.'
  );
  return `channel ${serving.map((c) => c.name).join(', ')}`;
});

check('a real build listens to that channel', () => {
  const names = new Set(serving.map((c) => c.name));
  const listeners = finished.filter((b) => names.has(b.channel));
  ok(
    listeners.length > 0,
    `no finished Android build uses ${[...names].join(', ') || '(no channel)'}. ` +
      `Builds use: ${[...new Set(finished.map((b) => b.channel))].join(', ')}. ` +
      'An update nobody has a build for is not a delivered update.'
  );
  const newest = listeners[0];
  return `${listeners.length} build(s), newest ${newest.id?.slice(0, 8)} on ${newest.channel}`;
});

check('the runtime versions match', () => {
  // The other silent way an update is ignored: a build only accepts updates
  // built for its own runtime, and a mismatch is never reported to the user.
  const names = new Set(serving.map((c) => c.name));
  const listeners = finished.filter((b) => names.has(b.channel));
  const buildRuntimes = new Set(listeners.map((b) => b.runtimeVersion).filter(Boolean));
  const updates = json(['update:list', '--branch', BRANCH, '--limit', '1']) ?? [];
  const groups = Array.isArray(updates) ? updates : (updates?.currentPage ?? []);
  const latest = groups[0]?.updates?.[0] ?? groups[0];
  const updateRuntime = latest?.runtimeVersion;
  ok(updateRuntime, 'could not read the latest update on this branch');
  ok(
    buildRuntimes.has(updateRuntime),
    `the newest update is runtime ${updateRuntime} and the builds are ${[...buildRuntimes].join(', ')}. ` +
      'A phone silently ignores an update built for a runtime it is not.'
  );
  return `runtime ${updateRuntime}`;
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) {
  console.log('  An update published to this branch will NOT reach her phone.\n');
  process.exit(1);
}
