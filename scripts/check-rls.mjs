// IS ANY TABLE IN `public` READABLE BY THE ANON KEY?
//
// Written 28 September 2026, the day one was.
//
// WHAT HAPPENED. `chat_messages_duplicates_removed` was created the day before to
// hold duplicate assistant rows before deleting them - a deliberate backup, and
// the right instinct. It was created in `public`, which PostgREST exposes, and
// nobody enabled row-level security on it. The anon key reads a table in that
// state, and the anon key ships inside the mobile app and the landing page's own
// JavaScript. For a day, her conversation with Selodia was public.
//
// Nothing about it looked wrong. It was a backup table, made carefully, with a
// comment explaining why. The security advisor found it while I was looking up
// something else entirely.
//
// SO THE CHECK RUNS ON DEMAND RATHER THAN ON A HUNCH. A table added in a hurry,
// which is what a backup table always is, is exactly the one nobody thinks to
// audit afterwards.
//
// PROVED ABLE TO FAIL, because a check that has only ever printed "all clear" is
// indistinguishable from one that does nothing. On 28 September a table holding
// one harmless row was created in `public` without RLS; this reported it by name
// and exited 1; the table was dropped. That is the whole test, and it took a
// minute. See the migrations temp_rls_check_proof and drop_temp_rls_check_proof.
//
//   node scripts/check-rls.mjs

import fs from 'node:fs';
import path from 'node:path';

const E = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

// The anon key itself, because the real question is not "is RLS on" but "can
// this key read it". A table with RLS on and no policy returns 200 and an empty
// array, which is the locked state; a table with RLS off returns its rows.
const ANON = E.NEXT_PUBLIC_SUPABASE_ANON_KEY || E.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// THE LIST COMES FROM POSTGREST'S OWN SCHEMA, which is exactly the set of tables
// it will serve - the right list to check, rather than every table in the
// database. Read with the SERVICE ROLE, because the publishable key cannot read
// the schema root; that it cannot is not the same as it cannot read the tables,
// which is the whole point of what follows.
const root = await fetch(`${E.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
  headers: {
    apikey: E.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${E.SUPABASE_SERVICE_ROLE_KEY}`,
  },
});
if (!root.ok) {
  console.error(`Could not read the exposed schema: ${root.status}`);
  process.exitCode = 1;
} else {
  const spec = await root.json();
  const tables = Object.keys(spec.definitions ?? spec.components?.schemas ?? {});

  const exposed = [];
  for (const table of tables) {
    const res = await fetch(
      `${E.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`,
      { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } }
    );
    if (!res.ok) continue;
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0) exposed.push({ table, sample: Object.keys(rows[0]).length });
  }

  console.log(`\n  ${tables.length} tables exposed through PostgREST, read with the ANON key\n`);

  if (exposed.length === 0) {
    console.log('  None of them returned a row. Nothing is readable without signing in.\n');
  } else {
    console.error('  READABLE WITHOUT SIGNING IN\n');
    for (const e of exposed) {
      console.error(`    ${e.table}  - returned a row with ${e.sample} columns`);
    }
    console.error(
      '\n  A table in `public` is served by PostgREST, and the anon key ships inside\n' +
        '  the mobile app and the landing page. If any of these hold personal data,\n' +
        '  enable row-level security on them now:\n\n' +
        '    alter table public.<name> enable row level security;\n\n' +
        '  RLS on with no policy is the locked state - the service role still reads it.\n'
    );
    process.exitCode = 1;
  }
}
