// Does removing a plan by name do the right thing to the duplicate case?
//
// The case that matters is the one Ruth hit: two plans with the same title.
// "Delete the duplicate" means remove one and keep one, and getting it
// backwards loses a plan somebody wrote. So this exercises the decision
// against real rows before it is trusted on anybody's data.
//
// Runs on the +store account, never hers. Seeds the shapes, asks, checks.
//
//   node scripts/probe-plan-removal.mjs

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const STORE_EMAIL = 'unflumpapp+store@gmail.com';
if (!STORE_EMAIL.includes('+store')) {
  console.error('Refusing: this only ever runs against the +store account.');
  process.exit(1);
}

const E = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { removePlanTitled } = await import('../app/lib/plan-removal.ts');

const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const uid = users.users.find((u) => u.email === STORE_EMAIL)?.id;
if (!uid) {
  console.error('No +store account found. Run seed-store-account.mjs first.');
  process.exit(1);
}

const plan = (names) => ({
  programType: 'strength',
  goal: 'probe',
  exercises: names.map((n) => ({ name: n, group: 'probe', sets: 3, reps: '8' })),
});

async function reset(rows) {
  await admin.from('almanac_entries').delete().eq('user_id', uid).ilike('title', 'PROBE %');
  if (rows.length) {
    await admin.from('almanac_entries').insert(
      rows.map((r, i) => ({
        user_id: uid,
        kind: 'plan',
        title: r.title,
        content: plan(r.moves),
        // Ordered creation, so "the oldest is the original" is testable.
        created_at: new Date(Date.now() - (rows.length - i) * 86_400_000).toISOString(),
      }))
    );
  }
}

async function titlesLeft() {
  const { data } = await admin
    .from('almanac_entries')
    .select('title, content, created_at')
    .eq('user_id', uid)
    .ilike('title', 'PROBE %')
    .order('created_at', { ascending: true });
  return data ?? [];
}

const CASES = [
  {
    name: 'one match is removed',
    rows: [{ title: 'PROBE Solo Routine', moves: ['squat'] }],
    ask: 'PROBE Solo Routine',
    expect: { done: true, removed: 1, kept: 0, left: 0 },
  },
  {
    name: 'identical duplicates: the later copy goes, the original stays',
    rows: [
      { title: 'PROBE Thigh Routine', moves: ['adductor squeeze', 'side lunge'] },
      { title: 'PROBE Thigh Routine', moves: ['adductor squeeze', 'side lunge'] },
    ],
    ask: 'PROBE Thigh Routine',
    expect: { done: true, removed: 1, kept: 1, left: 1 },
  },
  {
    name: 'three identical copies: two go, one stays',
    rows: [
      { title: 'PROBE Trio', moves: ['a'] },
      { title: 'PROBE Trio', moves: ['a'] },
      { title: 'PROBE Trio', moves: ['a'] },
    ],
    ask: 'PROBE Trio',
    expect: { done: true, removed: 2, kept: 1, left: 1 },
  },
  {
    name: 'same name, DIFFERENT movements: nothing is removed',
    rows: [
      { title: 'PROBE Split', moves: ['squat', 'press'] },
      { title: 'PROBE Split', moves: ['deadlift', 'row'] },
    ],
    ask: 'PROBE Split',
    expect: { done: false, reason: 'ambiguous', left: 2 },
  },
  {
    name: 'a name that matches nothing removes nothing',
    rows: [{ title: 'PROBE Kept Safe', moves: ['squat'] }],
    ask: 'PROBE Something Else Entirely',
    expect: { done: false, reason: 'not-found', left: 1 },
  },
  {
    name: 'a partial name matching two plans removes nothing',
    rows: [
      { title: 'PROBE Morning Mobility', moves: ['cat cow'] },
      { title: 'PROBE Morning Strength', moves: ['squat'] },
    ],
    ask: 'PROBE Morning',
    expect: { done: false, reason: 'ambiguous', left: 2 },
  },
  {
    name: 'a partial name matching one plan removes it',
    rows: [
      { title: 'PROBE Evening Mobility', moves: ['cat cow'] },
      { title: 'PROBE Totally Different', moves: ['squat'] },
    ],
    ask: 'PROBE Evening',
    expect: { done: true, removed: 1, kept: 0, left: 1 },
  },
];

console.log('\n  REMOVING A PLAN BY NAME\n');
let failed = 0;

for (const c of CASES) {
  await reset(c.rows);
  const got = await removePlanTitled(admin, uid, c.ask);
  const left = await titlesLeft();

  const checks = [
    ['done', got.done, c.expect.done],
    ...(c.expect.done
      ? [
          ['removed', got.removed, c.expect.removed],
          ['kept', got.kept, c.expect.kept],
        ]
      : [['reason', got.reason, c.expect.reason]]),
    ['rows left', left.length, c.expect.left],
  ];
  const bad = checks.filter(([, a, b]) => a !== b);
  if (bad.length) failed++;
  console.log(`  ${bad.length ? 'FAIL' : 'pass'}  ${c.name}`);
  for (const [what, a, b] of bad) console.log(`          ${what}: got ${a}, expected ${b}`);
}

await reset([]);
console.log(failed === 0 ? '\n  all cases pass\n' : `\n  ${failed} FAILED\n`);
process.exit(failed === 0 ? 0 : 1);
