// A REQUEST THAT DID NOT COME BACK IS NOT A SAVE THAT DID NOT HAPPEN.
//
//   node scripts/check-a-lost-reply-is-not-a-lost-save.mjs
//
// WHY THIS EXISTS, and it is the mechanism behind a bug Ruth has reported three
// times. From her own tables, 23 October 2026:
//
//   13:46:31  she logs "turtle bean soup, 50g chicken breast, 2 black coffees"
//   13:46:57  the server answers after 25.5s and WRITES THE ROW (295 kcal)
//             the phone has already given up, and shows:
//             "That did not save. Worth trying again."
//   13:47:35  she sends the same text again, as instructed
//   13:47:43  "That came through twice, so I haven't logged it again."
//
// The only reason there is not a duplicate lunch in her log is the dedupe guard.
// THE DUPLICATES ARE MANUFACTURED BY THE INSTRUCTION TO RE-SEND, and the guard
// is a net under that rather than a fix for it.
//
// THE RULE. A catch block around a network call knows exactly one thing: no
// answer arrived. It cannot tell a lost REQUEST from a lost REPLY, and those
// have opposite correct responses - one needs sending again, the other must not
// be. So it may not assert either. It re-reads the record and says to look.
//
// WHAT IS STILL ALLOWED, and the distinction is the whole point: a failure
// BEFORE anything is sent may say so plainly. pickImage failing means nothing
// left the phone, so there is no write to be uncertain about and "worth trying
// again" is true. This checks network catches only.
//
// AND ONLY CALLS THAT WRITE TO HER RECORD. The first run of this flagged three
// more, and two were right to say what they said:
//
//   /api/report          builds a document and opens it. Its only row is an
//                        export artefact, not her health record, and running it
//                        twice gives her two reports rather than two lunches.
//   /api/parse-document  reads a photographed document and hands back a card to
//                        be confirmed. It writes nothing at all, so "nothing was
//                        saved" is simply TRUE.
//
// The third, /api/log-working-weight, was the real thing: a write to her record
// whose catch said "Couldn't save that. Try again", with no dedupe guard
// underneath it. Routes that do not touch her record are listed below, so the
// exemption is a stated fact rather than a silence.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'mobile/src';
const EXTS = new Set(['.ts', '.tsx']);

// Sentences that claim a write did not happen. A catch block around a network
// call must not contain one.
const CLAIMS_NO_SAVE = [
  /did\s*n[o']?t\s+save/i,
  /did\s+not\s+save/i,
  /nothing\s+(?:was\s+)?saved/i,
  /failed\s+to\s+save/i,
  /was\s*n[o']?t\s+saved/i,
];

// And an invitation to do it again, which is what turns a false failure into a
// duplicate row.
const INVITES_RETRY = /worth\s+(?:trying|tapping)\s+again|try\s+again|send\s+it\s+again|once\s+more/i;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.has(path.extname(name))) out.push(full);
  }
  return out;
}

// The body of every `catch` that sits in a function which posts to the server.
// Anchored on the brace depth rather than on a regex over the whole block,
// because a catch can contain anything and a greedy match would swallow the
// rest of the file.
function catchBodies(src) {
  const out = [];
  const re = /\bcatch\s*(?:\([^)]*\))?\s*\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') depth -= 1;
      i += 1;
    }
    out.push({ body: src.slice(start, i - 1), at: m.index });
  }
  return out;
}

function lineOf(src, index) {
  return src.slice(0, index).split('\n').length;
}

// Routes that do not write to her record, and so may say plainly that nothing
// was saved. Each one is here because it was checked, not because it was
// convenient. See the note at the top.
const NON_RECORD = [
  '/api/report',
  '/api/parse-document',
  '/api/movement-demo',
  '/api/movement-illustration',
];

/**
 * The routes called in the try block this catch belongs to.
 *
 * Read backwards from the catch rather than forwards from the try, because a
 * function can hold several try blocks and the one that matters is the nearest
 * above. A catch naming no route at all is judged, not skipped: an unknown call
 * is not an exemption.
 */
function routesBefore(src, at) {
  const from = Math.max(0, at - 2000);
  const window = src.slice(from, at);
  const tryAt = window.lastIndexOf('try {');
  const body = tryAt >= 0 ? window.slice(tryAt) : window;
  return [...body.matchAll(/['"`](\/api\/[a-z0-9/-]+)['"`]/gi)].map((m) => m[1]);
}

const files = walk(ROOT);
const offences = [];
let inspected = 0;
let exempt = 0;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  // Only files that actually talk to the server. A catch in a pure helper is
  // not what this is about.
  if (!/authedPost|authedGet|\bfetch\s*\(|classifyAndLog/.test(src)) continue;

  for (const { body, at } of catchBodies(src)) {
    // A comment explaining the old behaviour is not the old behaviour. Strip
    // comments before judging, or every fix that documents itself fails.
    const code = body
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    if (!code.trim()) continue;

    // A try block that only calls routes which write nothing may say so.
    const routes = routesBefore(src, at);
    if (routes.length > 0 && routes.every((r) => NON_RECORD.includes(r))) {
      exempt += 1;
      continue;
    }
    inspected += 1;

    const claims = CLAIMS_NO_SAVE.find((re) => re.test(code));
    if (claims) {
      offences.push({
        file,
        line: lineOf(src, at),
        why: 'asserts the save did not happen',
        text: (code.match(claims)?.[0] ?? '').trim(),
      });
      continue;
    }
    if (INVITES_RETRY.test(code)) {
      offences.push({
        file,
        line: lineOf(src, at),
        why: 'invites a re-send, which is how a lost reply becomes a duplicate row',
        text: (code.match(INVITES_RETRY)?.[0] ?? '').trim(),
      });
    }
  }
}

console.log('  A LOST REPLY IS NOT A LOST SAVE\n');
console.log(`  inspected ${inspected} catch block(s) around calls that write to her record`);
console.log(`  skipped ${exempt} around routes that write nothing (see NON_RECORD)`);

if (offences.length === 0) {
  console.log('  none of them claims a write failed or asks for a re-send\n');
  console.log(`  ${inspected} checked, 0 offending`);
  process.exit(0);
}

console.log('');
for (const o of offences) {
  console.log(`  OFFENDING  ${o.file}:${o.line}`);
  console.log(`             ${o.why}`);
  console.log(`             found: ${JSON.stringify(o.text)}`);
}
console.log('');
console.log('  A catch around a network call knows only that no answer arrived. It');
console.log('  cannot tell a lost request from a lost reply. Re-read the record and');
console.log('  say to look at it; never claim the write failed, and never ask for a');
console.log('  re-send - that is what produced the duplicate food logs.');
console.log('');
console.log(`  ${inspected} checked, ${offences.length} offending`);
process.exit(1);
