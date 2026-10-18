// WHAT TO MAKE NEXT, IN THE ORDER PEOPLE ACTUALLY ASKED FOR IT.
//
//   node scripts/what-to-make-next.mjs
//   node scripts/what-to-make-next.mjs --all      (including ones already dealt with)
//
// Ruth, 18 October 2026: "When an excersise is genuinely required but wasnt
// there, it needs to be recorded as 'to be built/illustrated' and this creates
// the list of what's needed over time."
//
// This reads that list. Every row got there because a plan was saved containing
// a movement with neither a clip nor a drawing, and somebody was handed words
// instead of a picture. The count is how many times that has happened.
//
// WHY IT REPLACES GUESSING. The drawing list before this came from sweeping
// Ruth's own saved plans, which describes where SHE has been. This describes
// what everybody asked for and did not get, weighted by how often - so the
// thing drawn next is the thing most people keep missing, and the library grows
// toward its users rather than toward whoever last had an idea.
//
// EACH ROW IS CHECKED AGAIN BEFORE IT IS PRINTED. A gap recorded last week may
// have been filled since, by a drawing or by an alias onto an existing clip, so
// anything that now resolves is reported as closed rather than listed as work.

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) {
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const all = process.argv.includes('--all');

let q = supabase
  .from('movement_gaps')
  .select('match_key, name, times_asked, first_seen, last_seen, last_plan, status')
  .order('times_asked', { ascending: false })
  .order('last_seen', { ascending: false });
if (!all) q = q.eq('status', 'wanted');

const { data: gaps, error } = await q;
if (error) throw error;

if (!gaps || gaps.length === 0) {
  console.log(
    '\n  Nothing recorded yet.\n\n' +
      '  This list fills itself as plans are saved: a movement with no clip and\n' +
      '  no drawing is written down the moment somebody is handed it as words.\n'
  );
  process.exit(0);
}

// Has anything been covered since it was recorded?
const names = gaps.map((g) => g.name);
const [clips, drawings] = await Promise.all([
  supabase.rpc('resolve_movement_refs', { names }),
  supabase.rpc('resolve_illustration_refs', { names }),
]);
const hasClip = new Map((clips.data ?? []).map((r) => [r.input_name, r.join_key]));
const hasDrawing = new Map((drawings.data ?? []).map((r) => [r.input_name, r.join_key]));

const open = [];
const closed = [];
for (const g of gaps) {
  const covered = hasClip.get(g.name) || hasDrawing.get(g.name);
  (covered ? closed : open).push({ ...g, covered });
}

const day = (s) => new Date(s).toISOString().slice(0, 10);

console.log(`\n  TO BE BUILT OR ILLUSTRATED  (${open.length})\n`);
if (open.length === 0) {
  console.log('    Nothing outstanding.\n');
} else {
  console.log('    asks  movement                                   last asked  for');
  console.log('    ----  -----------------------------------------  ----------  ---------------------');
  for (const g of open) {
    console.log(
      `    ${String(g.times_asked).padStart(4)}  ${g.name.slice(0, 41).padEnd(41)}  ` +
        `${day(g.last_seen)}  ${(g.last_plan ?? '').slice(0, 21)}`
    );
  }
  console.log();
}

if (closed.length > 0) {
  console.log(`  COVERED SINCE IT WAS RECORDED  (${closed.length})\n`);
  for (const g of closed) {
    const how = hasDrawing.get(g.name) ? 'drawing' : 'clip';
    console.log(`    ${g.name}  ->  ${g.covered}  (${how})`);
  }
  console.log(
    `\n  Mark them so they stop appearing:\n` +
      `    update public.movement_gaps set status = '<drawn|clipped>' where match_key in (...);\n`
  );
}
