// A READ WITH NO LIMIT IS A BUG WITH A DATE ON IT.
//
//   node scripts/check-row-ceiling.mjs
//
// WHAT HAPPENED. On 29 September Ruth said "my chat disappeared from chat. No
// way to see what was said or even if logged properly." Every message was in
// the database. None of the last eight days reached the screen.
//
// loadThread read chat_messages with no .limit() and ordered ASCENDING.
// PostgREST caps a response at 1000 rows and reports nothing - no error, no
// flag, an ordinary 200 - so the code's own `if (error || !data) return` guard
// passed. At 1504 rows the app was handed the OLDEST thousand, ending
// 21 September 19:16, and everything after that was unreachable.
//
// THE SHAPE IS THE POINT. It is silent, it is invisible in review, and it
// arrives on a THRESHOLD rather than on a change: nothing was edited on the day
// it broke, the table simply crossed a number. A test written the week before
// would have passed. The only way to catch it is to refuse the shape.
//
// So: any read of a table that can grow without bound must say how many rows it
// wants. Either an explicit .limit(), or one of the forms that is already
// bounded - .single(), .maybeSingle(), a head/count query.
//
// WHICH TABLES. Only ones that grow with use, listed with the reason, because a
// check that fires on a 12-row lookup table is a check nobody runs. Row counts
// were read from pg_stat_user_tables on 29 September 2026.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Tables that grow with use. The number is what was there on 29 Sept 2026. */
const UNBOUNDED = {
  chat_messages: 1583, // already over; this is the one that bit
  food_composition: 2886, // already over
  movement_assets: 924, // crosses 1000 the moment Exercise Animatic delivers
  food_logs: 125,
  food_items: 192,
  activity_logs: null,
  personal_metrics: null,
  body_measurements: null,
  almanac_entries: null,
  water_logs: null,
  daily_ratings: null,
  model_usage: 157,
};

const DIRS = ['app', 'mobile/src'];
const SUFFIXES = new Set(['.ts', '.tsx']);
const SKIP = new Set(['node_modules', '.next', '.expo', 'dist', 'build']);

/** Forms that state how many rows they want. */
const BOUNDED = [
  /\.limit\s*\(/,
  /\.single\s*\(/,
  /\.maybeSingle\s*\(/,
  /head\s*:\s*true/,
  /count\s*:\s*['"]exact['"]/,
  /\.range\s*\(/,
];

/**
 * Filters that bound the result even without a limit.
 *
 * NOT every filter counts, and that distinction is the whole value of this
 * check. The read that broke the chat carried `.eq('source', 'chat')` - a
 * filter that matches almost every row in the table. A filter only bounds a
 * result when the thing it matches is itself small:
 *
 *   .in(list)          as many rows as the list has
 *   a time window      both ends, so it cannot widen with use
 *   .eq on an id       the children of one parent
 *
 * The first version of this check skipped this and used table SIZE alone,
 * which flagged two reads that were already safe - a drinks lookup bounded by
 * an .in() of a handful of names, and a supersede window of a few seconds -
 * while telling me they were bugs. A check that is wrong about the two cases
 * you can verify by eye is a check you stop believing.
 */
const NARROWING = [
  /\.in\s*\(/,
  /\.eq\s*\(\s*['"](?:id|[a-z_]+_id)['"]/,
  /\.contains\s*\(/,
  /\.textSearch\s*\(/,
];

/** A window needs BOTH ends; an open-ended `gte` grows for ever. */
const hasTimeWindow = (chain) =>
  /\.(gte|gt)\s*\(/.test(chain) && /\.(lte|lt)\s*\(/.test(chain);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (SUFFIXES.has(path.extname(name))) out.push(full);
  }
  return out;
}

/**
 * Every supabase chain that reads one of the listed tables.
 *
 * A chain is taken from `.from('table')` to the end of its statement. Crude on
 * purpose: a real parser here would be more code than the thing it guards, and
 * the failure mode of this approximation is a false positive that a human reads
 * once - not a missed one, because the chain always ends in a semicolon.
 */
function chainsIn(src) {
  const out = [];
  const re = /\.from\(\s*['"]([a-z_]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const table = m[1];
    if (!(table in UNBOUNDED)) continue;
    const rest = src.slice(m.index);
    // The statement ends at the first semicolon that is not inside the chain's
    // own parentheses. Depth counting rather than a regex, because a select
    // list can contain anything.
    let depth = 0;
    let end = rest.length;
    for (let i = 0; i < rest.length; i += 1) {
      const c = rest[i];
      if (c === '(') depth += 1;
      else if (c === ')') depth -= 1;
      else if (c === ';' && depth <= 0) {
        end = i;
        break;
      }
    }
    const chain = rest.slice(0, end);
    const line = src.slice(0, m.index).split('\n').length;
    out.push({ table, chain, line });
  }
  return out;
}

export function findUnbounded(src) {
  const bad = [];
  for (const { table, chain, line } of chainsIn(src)) {
    // Only READS. An insert, update or delete has no row ceiling to hit.
    if (!/\.select\s*\(/.test(chain)) continue;
    if (/\.(insert|update|upsert|delete)\s*\(/.test(chain)) continue;
    if (BOUNDED.some((re) => re.test(chain))) continue;
    if (NARROWING.some((re) => re.test(chain))) continue;
    if (hasTimeWindow(chain)) continue;
    bad.push({ table, line });
  }
  return bad;
}

// ------------------------------------------------------------------- running

const findings = [];
for (const dir of DIRS) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) continue;
  for (const file of walk(full)) {
    const src = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    for (const hit of findUnbounded(src)) {
      findings.push({ file: path.relative(ROOT, file), ...hit });
    }
  }
}

// ------------------------------------------------------------------ MUTATION
//
// PROVE IT CAN FAIL. The real loadThread is re-checked with its .limit()
// removed; if the check still passes, it is not testing what it claims to.
const PROOF = `
  const { data } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('source', 'chat')
    .order('created_at', { ascending: false });
`;
const PROOF_FIXED = PROOF.replace(
  ".order('created_at', { ascending: false })",
  ".order('created_at', { ascending: false })\n    .limit(300)"
);

const catchesIt = findUnbounded(PROOF).length === 1;
const allowsTheFix = findUnbounded(PROOF_FIXED).length === 0;

// TWO TIERS, BECAUSE A CHECK THAT FIRES THIRTY TIMES IS ONE NOBODY RUNS TWICE.
//
// Its first run found 42 unbounded reads. All 42 are real, and most are
// narrowed by a date window or a parent id and will not see a thousand rows
// this decade. The ones that matter are reads of tables that are AT the ceiling
// now: those are not a risk, they are a date.
//
// closeout_check.py already carries this shape and the reason for it - its
// predecessor cried wolf on its first run and would not have been run twice.
const AT_CEILING = Object.entries(UNBOUNDED)
  .filter(([, rows]) => typeof rows === 'number' && rows >= 800)
  .map(([t]) => t);

const blocking = findings.filter((f) => AT_CEILING.includes(f.table));
const eventual = findings.filter((f) => !AT_CEILING.includes(f.table));

for (const f of blocking) {
  console.error(
    `  AT THE CEILING  ${f.file}:${f.line}  reads ${f.table} (${UNBOUNDED[f.table]} rows) with no limit`
  );
}
if (eventual.length > 0) {
  console.log('');
  console.log(`  ${eventual.length} other unbounded read(s), none near 1000 rows yet:`);
  for (const f of eventual) console.log(`    ${f.file}:${f.line}  ${f.table}`);
}
if (!catchesIt) console.error('  USELESS  it does not catch a read with no limit');
if (!allowsTheFix) console.error('  USELESS  it still complains once a limit is added');

const broken = blocking.length + (catchesIt ? 0 : 1) + (allowsTheFix ? 0 : 1);
console.log('');
console.log(
  `  ${blocking.length} read(s) of a table already at the 1000-row ceiling.` +
    `  Proof: catches a missing limit = ${catchesIt}, accepts one = ${allowsTheFix}`
);
if (broken > 0) process.exit(1);
