// IS WHAT IS LIVE ON selodia.app THE SAME AS main?
//
//   node scripts/check-live-deployment.mjs
//   node scripts/check-live-deployment.mjs --json
//
// WHY THIS EXISTS, and it is not a hypothetical.
//
// On 1 October 2026 I told Ruth there were two Vercel projects, that pushing to
// GitHub deployed an unaliased one, and that a server change which was only
// pushed would never reach her phone. Every part of that was wrong. There is one
// project, it is connected to main, and pushes deploy to production.
//
// The two things that produced the error are both the same kind of thing - a
// name read instead of an identity:
//
//   .vercel/project.json still said projectName "unflump-app" after the project
//   was renamed to "selodia-app". It holds the right projectId, so every deploy
//   went to the right place, but the CLI prints the stale NAME. `vercel ls` then
//   labelled my CLI deploys "unflump-app" and the git deploys "selodia-app",
//   which reads exactly like two projects.
//
//   and I checked `vercel ls` for a new deployment about a minute after pushing,
//   saw nothing newer, and concluded pushes do not deploy. The build was in
//   flight. An absence a minute after a push is not evidence.
//
// So the fix is not a better habit, it is a question that can be answered
// mechanically: WHAT SHA IS SERVING selodia.app, AND IS IT main? That is one API
// call and a git ancestry test, and it would have refused the wrong answer
// immediately.
//
// WHAT IT CHECKS:
//
//   1  there is exactly ONE Vercel project. A second one appearing is worth
//      knowing about, because the whole confusion above was about which project
//      serves her domain.
//   2  the project is connected to GitHub, production branch main. Without this,
//      a push deploys nothing and the only route to production is somebody
//      remembering to run a command.
//   3  every production domain - selodia.app, api.selodia.app, www - is on the
//      SAME deployment. A split would mean the app and its API running different
//      code, which is the kind of thing that produces a bug nobody can reproduce.
//   4  the sha serving those domains is the tip of origin/main. Behind is a
//      failure and names how many commits; AHEAD is also a failure, because it
//      means production is running something that is not on main.
//
// IT NEEDS THE VERCEL CLI TO BE LOGGED IN on this machine, and reads its token
// from the CLI's own auth file. No token is stored in this repo. Without it the
// check SKIPS rather than fails: on a machine that cannot ask Vercel, "I do not
// know" is the honest answer and a red X would train everybody to ignore it.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROJECT_ID = 'prj_XmdCSQK6WwMtZPNh6yCCVxKeQOat';
const TEAM_ID = 'team_l9Ts8pCYpUMxLMxHKgZjmjhX';
const PRODUCTION_DOMAINS = ['selodia.app', 'api.selodia.app', 'www.selodia.app'];
const BRANCH = 'main';
const JSON_OUT = process.argv.includes('--json');

// The CLI's auth file, in the places it lives on each platform.
function vercelToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  const candidates = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'com.vercel.cli', 'Data', 'auth.json'),
    path.join(os.homedir(), '.local', 'share', 'com.vercel.cli', 'auth.json'),
    path.join(os.homedir(), 'Library', 'Application Support', 'com.vercel.cli', 'auth.json'),
  ];
  for (const p of candidates) {
    try {
      const token = JSON.parse(fs.readFileSync(p, 'utf8')).token;
      if (typeof token === 'string' && token.length > 0) return token;
    } catch {
      // Next candidate.
    }
  }
  return null;
}

const TOKEN = vercelToken();
if (!TOKEN) {
  console.log('  SKIPPED  no Vercel credentials on this machine.');
  console.log('           Run `npx vercel login`, or set VERCEL_TOKEN, then try again.');
  process.exit(0);
}

// A DEAD TOKEN IS "I CANNOT TELL", NOT A FAILURE AND NOT A CRASH.
//
// The CLI's auth file can hold an EXPIRED token, which this originally treated as
// credentials - present, so not skipped - and then threw an unhandled 403 out of
// the top level. An `until` loop waiting for this check to pass therefore waited
// for ever on a script that was crashing rather than failing, which is how a
// deploy check became a hang.
//
// Expired is the same situation as absent: nobody here can answer the question.
// It says so and exits 0, because a red X for "the laptop is logged out" trains
// everybody to ignore the check that matters.
class NotAuthorised extends Error {}

async function api(route) {
  const sep = route.includes('?') ? '&' : '?';
  const res = await fetch(`https://api.vercel.com${route}${sep}teamId=${TEAM_ID}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (res.status === 401 || res.status === 403) throw new NotAuthorised();
  if (!res.ok) throw new Error(`${route} -> ${res.status} ${await res.text()}`);
  return res.json();
}

// CAUGHT WHERE IT IS THROWN, not on a process handler. A rejected TOP-LEVEL
// await in an ES module surfaces as an uncaught exception and never reaches
// process.on('unhandledRejection') - so the handler that was here looked right
// and did nothing at all.
function skipIfUnauthorised(e) {
  if (!(e instanceof NotAuthorised)) throw e;
  console.log('  SKIPPED  the Vercel credentials on this machine have expired.');
  console.log('           Run `npx vercel login` from the project, then try again.');
  process.exit(0);
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

const failures = [];
const notes = [];
let pass = 0;
function check(name, fn) {
  try {
    const note = fn();
    if (note) notes.push(note);
    console.log(`  PASS  ${name}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL  ${name}\n          ${e.message}`);
    failures.push({ name, reason: e.message });
  }
}
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ---- 1. one project, connected to main -----------------------------------
const projects = (await api('/v9/projects?limit=100').catch(skipIfUnauthorised)).projects ?? [];
const project = projects.find((p) => p.id === PROJECT_ID) ?? null;

check('there is exactly one Vercel project', () =>
  ok(
    projects.length === 1,
    `found ${projects.length}: ${projects.map((p) => `${p.name} (${p.id})`).join(', ')}. ` +
      'If a second one is deliberate, say which serves selodia.app in docs/deployment.md and update this check.'
  )
);

check('it is the project this check is about', () =>
  ok(project, `${PROJECT_ID} is not in the account - was it deleted or recreated?`)
);

check(`a push to ${BRANCH} deploys it`, () => {
  const link = project?.link ?? null;
  ok(link, 'the project is NOT connected to a git repository, so a push deploys nothing');
  ok(
    link.productionBranch === BRANCH,
    `production branch is "${link.productionBranch}", not ${BRANCH}`
  );
  return `connected to ${link.type}:${link.org}/${link.repo}, production branch ${link.productionBranch}`;
});

// ---- 2. what is actually serving her domains ----------------------------
const ready = (
  await api(`/v6/deployments?projectId=${PROJECT_ID}&target=production&state=READY&limit=20`)
).deployments ?? [];
ok(ready.length > 0, 'no READY production deployment at all');

// THE LIVE ONE IS THE ONE HOLDING THE DOMAIN, not the newest. A newer
// deployment that was never aliased is not what she is using, and reading the
// newest instead is how "it is deployed" gets said about code nobody is running.
let live = null;
let liveAliases = [];
for (const d of ready) {
  const full = await api(`/v13/deployments/${d.uid}`);
  const aliases = full.alias ?? [];
  if (aliases.includes(PRODUCTION_DOMAINS[0])) {
    live = { ...d, full };
    liveAliases = aliases;
    break;
  }
}

check(`${PRODUCTION_DOMAINS[0]} is served by a READY production deployment`, () =>
  ok(live, `no READY production deployment holds ${PRODUCTION_DOMAINS[0]}`)
);

check('every production domain is on that same deployment', () => {
  const missing = PRODUCTION_DOMAINS.filter((d) => !liveAliases.includes(d));
  ok(
    missing.length === 0,
    `these point somewhere else: ${missing.join(', ')}. The app and its API would be running different code.`
  );
  return `serving ${PRODUCTION_DOMAINS.join(', ')}`;
});

// ---- 3. is it main? ------------------------------------------------------
const liveSha = live?.meta?.githubCommitSha ?? null;

check('the live deployment names the commit it was built from', () =>
  ok(liveSha, 'no commit sha on the live deployment, so nothing here can tell what is running')
);

check(`what is live is the tip of origin/${BRANCH}`, () => {
  // Fetched so "behind" is measured against the remote and not a stale local ref.
  try {
    git('fetch', 'origin', BRANCH, '--quiet');
  } catch {
    notes.push('could not fetch origin - comparing against the local ref');
  }
  const head = git('rev-parse', `origin/${BRANCH}`);
  if (liveSha === head) return `live and origin/${BRANCH} are both ${head.slice(0, 7)}`;

  // Which way round, and by how much. "Behind" and "ahead" are different problems.
  let known = true;
  try {
    git('cat-file', '-e', `${liveSha}^{commit}`);
  } catch {
    known = false;
  }
  if (!known) {
    throw new Error(
      `live is ${liveSha.slice(0, 7)}, which is not a commit this clone has. ` +
        `origin/${BRANCH} is ${head.slice(0, 7)}. Fetch, or production is running code that is not on ${BRANCH}.`
    );
  }
  const behind = git('rev-list', '--count', `${liveSha}..${head}`);
  const ahead = git('rev-list', '--count', `${head}..${liveSha}`);
  if (Number(ahead) > 0) {
    throw new Error(
      `production is AHEAD of origin/${BRANCH} by ${ahead} commit(s) - it is running ` +
        `${liveSha.slice(0, 7)}, which is not on ${BRANCH}. Probably a CLI deploy from a dirty tree.`
    );
  }
  throw new Error(
    `production is BEHIND origin/${BRANCH} by ${behind} commit(s). ` +
      `Live is ${liveSha.slice(0, 7)}, ${BRANCH} is ${head.slice(0, 7)}. ` +
      'If a build is still running this will pass in a few minutes; if not, the last push failed to build.'
  );
});

// ---- say it -------------------------------------------------------------
if (live) {
  const when = new Date(live.created).toISOString().replace('T', ' ').slice(0, 19);
  console.log(
    `\n  live: ${liveSha ? liveSha.slice(0, 7) : '?'} via ${live.source ?? '?'}, built ${when}Z`
  );
  const msg = (live.meta?.githubCommitMessage ?? '').split('\n')[0];
  if (msg) console.log(`        "${msg}"`);
}
for (const n of notes) console.log(`  note: ${n}`);

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      { liveSha, source: live?.source ?? null, aliases: liveAliases, pass, failures },
      null,
      2
    )
  );
}

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
