// THE APP GUIDE DESCRIBES THE APP THAT EXISTS.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-app-guide.mjs
//
// Ruth, 13 October 2026: the chat should know "the report builder and all
// features of the app so it can explain how to use the app to its full
// potential". The promise made to her when she agreed it: it can never describe
// something that is not there. This is that promise, both ways - every route the
// guide names exists, and every screen is either in the guide or deliberately
// left out with a reason.

import assert from 'node:assert';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const G = await import(root + '/app/lib/app-guide.ts');

const APP = 'mobile/src/app';
function screens(dir, prefix = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...screens(full, `${prefix}${name}/`));
    else if (/\.tsx$/.test(name) && !/^_layout|^\+/.test(name)) out.push(`${prefix}${name.replace(/\.tsx$/, '')}`);
  }
  return out;
}
const ALL = screens(APP);

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

console.log('\n  THE APP GUIDE DESCRIBES THE APP THAT EXISTS\n');

check('every screen the guide names exists', () => {
  const missing = G.APP_GUIDE.filter((e) => !ALL.includes(e.route)).map((e) => e.route);
  assert.deepStrictEqual(missing, [], `the guide describes screens that do not exist: ${missing.join(', ')}`);
  return `${G.APP_GUIDE.length} screens described`;
});

check('every screen is in the guide or left out on purpose', () => {
  const described = new Set(G.APP_GUIDE.map((e) => e.route));
  const left = Object.keys(G.NOT_IN_GUIDE);
  const unaccounted = ALL.filter(
    (r) => !described.has(r) && !left.includes(r) && !G.NOT_IN_GUIDE_PREFIXES.some((p) => r.startsWith(p))
  );
  assert.deepStrictEqual(unaccounted, [], `screens nobody decided about: ${unaccounted.join(', ')}`);
  const stale = left.filter((r) => !ALL.includes(r));
  assert.deepStrictEqual(stale, [], `left out, but no longer exist: ${stale.join(', ')}`);
  return `${ALL.length} screens accounted for`;
});

check('the report builder is in it, by its name on screen', () => {
  const rb = G.APP_GUIDE.find((e) => e.route === 'settings/report');
  assert.ok(rb && rb.name === 'Build a report', 'the report builder is missing or misnamed');
  assert.ok(/print|PDF/.test(rb.use), 'it does not say what a report is for');
  return 'Build a report';
});

check('the block the chat reads names every entry', () => {
  const b = G.appGuideBlock();
  for (const e of G.APP_GUIDE) assert.ok(b.includes(e.name), `${e.name} is missing from the block`);
  assert.ok(/Never describe a feature that is not in this list/.test(b));
  return 'all names present';
});

check('and this check can fail', () => {
  const fake = [...G.APP_GUIDE, { route: 'settings/teleporter', name: 'Teleporter', reach: '', use: '' }];
  assert.ok(fake.some((e) => !ALL.includes(e.route)), 'an invented screen reads as real');
  return 'an invented screen is caught';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
