// READING BETA FEEDBACK, AND SAYING WHAT HAPPENED TO IT.
//
// Ruth's item 6: "Build me a simple way to see all submissions and update their
// status."
//
// WHY A SCRIPT RATHER THAN A SCREEN. An admin screen inside the app would need
// an admin role, a route nobody else can reach, and a second UI to maintain - for
// an audience of one. This reads with the service role, which is the only key
// that can see across accounts, and it is the same shape as scripts/waitlist.mjs.
//
// THE STATUS IS A PROMISE TO THE TESTER. She sees 'sent', 'read' or 'fixed' on her
// own submission, so marking something read when nobody has read it, or fixed
// when nothing was fixed, is lying to somebody who took the trouble to tell you.
//
//   node scripts/beta-feedback.mjs               everything, newest first
//   node scripts/beta-feedback.mjs --new         only the ones nobody has read
//   node scripts/beta-feedback.mjs <id> read     mark one as read
//   node scripts/beta-feedback.mjs <id> fixed "shipped in the 29 Sept update"
//   node scripts/beta-feedback.mjs <id> shot     save its screenshot to look at

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

const args = process.argv.slice(2);
const when = (iso) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

// Emails rather than user ids, because "who said this" is the first question and
// a uuid does not answer it.
async function emails(ids) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const map = new Map((data?.users ?? []).map((u) => [u.id, u.email]));
  return Object.fromEntries(ids.map((id) => [id, map.get(id) ?? id.slice(0, 8)]));
}

// ── updating one ────────────────────────────────────────────────────────────
if (args.length >= 2 && ['read', 'fixed', 'sent'].includes(args[1])) {
  const [id, status, note] = args;
  const { data, error } = await admin
    .from('beta_feedback')
    .update({ status, ...(note ? { note } : {}) })
    .eq('id', id)
    .select('id, status')
    .maybeSingle();
  if (error) {
    console.error('Could not update:', error.message);
    process.exit(1);
  }
  if (!data) {
    console.error(`No submission with id ${id}.`);
    process.exit(1);
  }
  console.log(`\n  ${data.id} is now "${data.status}". She will see that on her own copy.\n`);
  process.exit(0);
}

// ── saving a screenshot ─────────────────────────────────────────────────────
if (args.length === 2 && args[1] === 'shot') {
  const { data: row } = await admin
    .from('beta_feedback')
    .select('screenshot_path')
    .eq('id', args[0])
    .maybeSingle();
  if (!row?.screenshot_path) {
    console.error('That submission has no screenshot.');
    process.exit(1);
  }
  const { data, error } = await admin.storage
    .from('beta-feedback')
    .createSignedUrl(row.screenshot_path, 600);
  if (error) {
    console.error('Could not sign it:', error.message);
    process.exit(1);
  }
  // A SIGNED URL, NOT A PUBLIC ONE, and ten minutes of it. The bucket is private
  // because a screenshot of this app is a picture of somebody's health record.
  console.log(`\n  Ten minutes to open this:\n\n  ${data.signedUrl}\n`);
  process.exit(0);
}

// ── listing ─────────────────────────────────────────────────────────────────
const onlyNew = args.includes('--new');
let q = admin
  .from('beta_feedback')
  .select('id, user_id, created_at, message, feelings, feeling_other, question, screen, app_version, device, screenshot_path, status, note')
  .order('created_at', { ascending: false });
if (onlyNew) q = q.eq('status', 'sent');

const { data, error } = await q;
if (error) {
  console.error('Could not read the feedback:', error.message);
  process.exit(1);
}

const rows = data ?? [];
console.log(`\n  BETA FEEDBACK${onlyNew ? ' - not yet read' : ''}: ${rows.length}\n`);

if (rows.length === 0) {
  console.log('  Nothing yet.\n');
  process.exit(0);
}

const who = await emails([...new Set(rows.map((r) => r.user_id))]);

for (const r of rows) {
  const feelings = [...r.feelings, r.feeling_other].filter(Boolean).join(', ');
  console.log(`  ${when(r.created_at)}  ${who[r.user_id]}  [${r.status}]`);
  if (r.question) console.log(`    asked: ${r.question}`);
  if (r.message) console.log(`    "${r.message.replace(/\s+/g, ' ')}"`);
  if (feelings) console.log(`    felt: ${feelings}`);
  console.log(
    `    from ${r.screen ?? 'unknown screen'} · ${r.device ?? '?'} · ${r.app_version ?? '?'}` +
      (r.screenshot_path ? ' · has a screenshot' : '')
  );
  if (r.note) console.log(`    note: ${r.note}`);
  console.log(`    ${r.id}`);
  console.log('');
}

console.log('  node scripts/beta-feedback.mjs <id> read');
console.log('  node scripts/beta-feedback.mjs <id> fixed "what changed"');
console.log('  node scripts/beta-feedback.mjs <id> shot\n');
