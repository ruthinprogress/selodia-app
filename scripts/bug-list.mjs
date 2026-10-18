// THE BUG LIST, AS A PAGE SHE CAN READ WITH HER MORNING COFFEE.
//
//   node scripts/bug-list.mjs        (or double-click Review bug reports.cmd)
//
// Ruth, 18 October 2026, scoping the in-app report button: the bug list "needs
// reviewing daily at this stage".
//
// Nothing existed to read it with. Reports have been landing in
// feedback_reports since 28 September with their build context attached, and
// the only way to see one was to go and write SQL - which is the reliable way
// for a daily habit to not happen. A list nobody reads is a slower version of
// the mailto: link this table was built to replace.
//
// WHY A PAGE AND NOT A TERMINAL DUMP. Her standing rule, and it is not about
// preference: a hand-run step she will actually run is a double-click and a
// browser, never a prompt she has to type into. The .cmd beside this file is
// the double-click; this writes the page and opens it.
//
// THE SCREENSHOTS ARE THE POINT OF REBUILDING IT NOW. They live in a PRIVATE
// bucket because a picture of this app is a picture of somebody's health
// record. They are fetched here with short-lived signed URLs, minted at the
// moment the page is written and expiring within the hour - so the page is
// useful this morning and inert if it is still lying about next week.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

function env() {
  const out = {};
  const p = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.trim().match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return { ...out, ...process.env };
}

const e = env();
const url = e.NEXT_PUBLIC_SUPABASE_URL;
// THE SERVICE KEY, because RLS on feedback_reports lets somebody read their own
// reports and this is the one place that has to read everybody's. It never
// leaves this machine and the page it writes holds no key.
const key = e.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log('\n  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.\n');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const SIGNED_URL_SECONDS = 3600;

function escapeHtml(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

function when(iso) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `today ${time}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `yesterday ${time}`;
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`;
}

const { data: rows, error } = await db
  .from('feedback_reports')
  .select('id, created_at, message, screen, update_id, runtime_version, channel, platform, os_version, status, note, screenshot_path')
  .order('created_at', { ascending: false })
  .limit(200);

if (error) {
  console.log(`\n  Could not read the bug list: ${error.message}\n`);
  process.exit(1);
}

// Signed one at a time rather than in a batch, so one bad path cannot take the
// whole page down with it. A report whose picture will not sign still shows.
const shots = new Map();
for (const r of rows ?? []) {
  if (!r.screenshot_path) continue;
  const { data } = await db.storage
    .from('beta-feedback')
    .createSignedUrl(r.screenshot_path, SIGNED_URL_SECONDS);
  if (data?.signedUrl) shots.set(r.id, data.signedUrl);
}

const open = (rows ?? []).filter((r) => r.status !== 'fixed' && r.status !== 'closed');
const done = (rows ?? []).filter((r) => r.status === 'fixed' || r.status === 'closed');

function card(r) {
  const shot = shots.get(r.id);
  const facts = [
    r.screen && `on <b>${escapeHtml(r.screen)}</b>`,
    r.platform && `${escapeHtml(r.platform)} ${escapeHtml(r.os_version ?? '')}`.trim(),
    r.runtime_version && `build ${escapeHtml(r.runtime_version)}`,
    r.channel && escapeHtml(r.channel),
    r.update_id && `update ${escapeHtml(String(r.update_id).slice(0, 8))}`,
  ]
    .filter(Boolean)
    .join(' &middot; ');
  return `<article class="card">
  <header><span class="when">${escapeHtml(when(r.created_at))}</span><span class="status s-${escapeHtml(r.status)}">${escapeHtml(r.status)}</span></header>
  <p class="msg">${escapeHtml(r.message)}</p>
  <p class="facts">${facts || 'no context attached'}</p>
  ${r.note ? `<p class="note">${escapeHtml(r.note)}</p>` : ''}
  ${
    shot
      ? `<a href="${shot}" target="_blank" rel="noreferrer"><img src="${shot}" alt="What they were looking at"></a>`
      : r.screenshot_path
        ? '<p class="facts">a picture was attached but would not load</p>'
        : ''
  }
</article>`;
}

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Selodia bug reports</title>
<style>
  :root { --bg:#faf5ef; --fg:#170d09; --quiet:#7a6a60; --line:#e4d8cc; --accent:#9c4221; }
  body { margin:0; background:var(--bg); color:var(--fg);
         font:16px/1.5 "Segoe UI", system-ui, sans-serif; padding:24px 16px 64px; }
  .wrap { max-width:760px; margin:0 auto; }
  h1 { font-size:28px; margin:0 0 4px; }
  .sub { color:var(--quiet); margin:0 0 28px; }
  h2 { font-size:18px; margin:32px 0 12px; }
  .card { border:1px solid var(--line); border-radius:14px; padding:16px; margin-bottom:14px;
          background:#fff; }
  .card header { display:flex; justify-content:space-between; align-items:center; gap:12px;
                 margin-bottom:8px; }
  .when { color:var(--quiet); font-size:14px; }
  .status { font-size:12px; text-transform:uppercase; letter-spacing:.06em;
            border:1px solid var(--line); border-radius:999px; padding:2px 10px; color:var(--quiet); }
  .s-new { border-color:var(--accent); color:var(--accent); }
  .msg { margin:0 0 10px; white-space:pre-wrap; }
  .facts { margin:0; color:var(--quiet); font-size:14px; }
  .note { margin:10px 0 0; padding:10px; background:var(--bg); border-radius:8px; font-size:14px; }
  img { max-width:220px; border-radius:10px; margin-top:12px; display:block; border:1px solid var(--line); }
  .none { color:var(--quiet); }
</style></head><body><div class="wrap">
<h1>Bug reports</h1>
<p class="sub">${open.length} open, ${done.length} closed &middot; read ${escapeHtml(when(new Date().toISOString()))} &middot; pictures in this page stop working within the hour</p>
<h2>Open</h2>
${open.length ? open.map(card).join('\n') : '<p class="none">Nothing open. Good morning.</p>'}
${done.length ? `<h2>Closed</h2>\n${done.map(card).join('\n')}` : ''}
</div></body></html>`;

const out = path.join(os.tmpdir(), 'selodia-bug-reports.html');
fs.writeFileSync(out, page, 'utf8');
console.log(`\n  ${open.length} open, ${done.length} closed. Opening the page...\n`);
// start needs the empty "" title argument or it treats the path as the title.
spawn('cmd', ['/c', 'start', '', out], { detached: true, stdio: 'ignore' }).unref();
