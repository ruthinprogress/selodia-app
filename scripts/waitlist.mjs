// WHO IS ON THE WAITING LIST.
//
// Ruth, 28 September 2026: "Tell me where sign-ups are actually stored, how many
// there are, check the form is live and saving, and make sure I can see the list
// easily."
//
// WHERE THEY ARE: the `waitlist` table in Supabase, written by a Next.js Server
// Action on the landing page at selodia.app. Not Jotform - her three Jotform
// forms are the old Unflump beta feedback ones and have nothing to do with this.
//
// WHY SHE COULD NOT SEE IT. The table is the only publicly writable one in the
// schema: RLS allows INSERT to anyone and grants NO SELECT AT ALL, which is the
// right way round for a list a stranger can add themselves to. The consequence
// nobody thought through is that it is unreadable to her as well - the list has
// been quietly collecting since 2 September with no way to look at it short of
// the SQL editor.
//
// So this reads it with the service role, which is the only key that can, and
// prints it. It never writes.
//
//   node scripts/waitlist.mjs           the list, newest first
//   node scripts/waitlist.mjs --csv     the same, as CSV to paste into a sheet

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const E = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await admin
  .from('waitlist')
  .select('email, name, created_at')
  .order('created_at', { ascending: false });

if (error) {
  console.error('Could not read the waiting list:', error.message);
  process.exit(1);
}

const rows = data ?? [];
const when = (iso) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

if (process.argv.includes('--csv')) {
  console.log('Name,Email,Joined');
  for (const r of rows) console.log(`"${(r.name ?? '').replace(/"/g, '""')}","${r.email}","${when(r.created_at)}"`);
  process.exit(0);
}

console.log(`\n  THE WAITING LIST - ${rows.length} ${rows.length === 1 ? 'person' : 'people'}\n`);
if (rows.length === 0) {
  console.log('  Nobody yet. The form is at selodia.app and writes to the `waitlist` table.\n');
  process.exit(0);
}
for (const r of rows) {
  console.log(`  ${(r.name ?? '(no name given)').padEnd(24)} ${r.email.padEnd(36)} ${when(r.created_at)}`);
}
console.log('');
console.log('  Stored in Supabase, table `waitlist`, written by the landing page.');
console.log('  Anyone can add themselves; nobody can read it back through the API,');
console.log('  which is why this script uses the service role. --csv for a sheet.\n');
