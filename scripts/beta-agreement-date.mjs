// STAMP THE VERSION DATE ON THE BETA AGREEMENT.
//
// Ruth, 28 September 2026: "Beta agreement version date: the day it's first
// shown to a tester."
//
// That is a rule, not a value, and the value does not exist yet - nobody has
// been shown it. So the document keeps a [date] placeholder until the day it
// does, and this fills it.
//
// WHY A SCRIPT RATHER THAN TYPING IT. The date on a versioned agreement is
// evidence: a stored acceptance names version 1.1, and version 1.1 has to be a
// document somebody can produce, dated the day it was issued. A date typed by
// hand weeks later is whatever the person typing remembers. This one is read
// from the earliest grant in `beta_members` - granting somebody beta access is
// how they come to see the agreement. Derived rather than remembered.
//
// EXCEPT THE FOUNDER, and the first run of this script is why that line exists.
// Ruth's own account was granted wave zero at 11:47 on 28 September so she could
// see the feedback screen, and the script cheerfully dated the agreement from it.
// She is not a tester and was never shown it. A derived value is only as good as
// the thing it is derived from, and "who is in the beta" is not the same fact as
// "who has been shown the agreement" - the founder is in one and not the other.
//
// It refuses in three directions:
//   - nobody but the founder has been granted, so there is no such day;
//   - a date is already stamped, so stamping again would rewrite history;
//   - the version line is not where it expects, so it does not guess.
//
//   node scripts/beta-agreement-date.mjs

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DOC = path.join(process.cwd(), 'docs', 'beta-agreement.md');
const PLACEHOLDER = '**Version 1.1 · [date]**';

const E = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const doc = fs.readFileSync(DOC, 'utf8');
if (!doc.includes(PLACEHOLDER)) {
  const dated = doc.match(/\*\*Version 1\.1 · (.+?)\*\*/);
  console.error(
    dated
      ? `Already stamped: version 1.1 is dated ${dated[1]}. Nothing to do - a dated\nagreement is not re-dated, it gets a new version number.`
      : `Could not find the version line in ${DOC}. Not guessing where to write.`
  );
  process.exit(1);
}

const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Her own account. In the beta since the day the feedback screen was built, and
// not somebody the agreement gets shown to.
const FOUNDER = '37ce3854-b805-4dd6-95f1-0a670e67d27d';

const { data, error } = await admin
  .from('beta_members')
  .select('granted_at, wave, user_id')
  .neq('user_id', FOUNDER)
  .order('granted_at', { ascending: true })
  .limit(1);

// WRAPPED SO A REFUSAL IS A RETURN, NOT A process.exit. Killing the process
// while the Supabase client still holds a socket trips a libuv assertion on
// Windows and the shell sees 127 instead of 1, which makes the exit code - the
// one thing a caller can check - meaningless.
function stamp() {
if (error) {
  console.error('Could not read beta_members:', error.message);
  process.exitCode = 1;
  return;
}

if (!data || data.length === 0) {
  console.error(
    'Nobody but the founder has been granted beta access, so there is no day the\n' +
      'agreement was first shown to a tester. Grant wave zero - Nikki and Carol -\n' +
      'then run this again.'
  );
  process.exitCode = 1;
  return;
}

  const granted = new Date(data[0].granted_at);
  const stamp = granted.toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/London',
});

  fs.writeFileSync(DOC, doc.replace(PLACEHOLDER, `**Version 1.1 · ${stamp}**`), 'utf8');
  console.log(`Version 1.1 dated ${stamp}, from the first ${data[0].wave ?? 'beta'} grant.`);
  console.log('Now convert it with scripts/md2docx.py and refile the Legal folder copy.');
}

stamp();
