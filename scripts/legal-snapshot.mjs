// SNAPSHOT THE LIVE PRIVACY POLICY AND TERMS INTO THE LEGAL FOLDER.
//
// The two Word copies in Build Specs/Legal are named "as live 2026-09-28", and
// a file that claims to be a snapshot of a live page has one job: to actually be
// one. They were made by hand, which means the next edit to either page leaves
// them quietly wrong and nothing says so.
//
// So this takes them FROM THE LIVE SITE rather than from the source. The source
// is what will be live; the site is what is. For a document whose whole value is
// evidence of what a user was shown, that distinction is the point.
//
// It writes Markdown next to itself; scripts/md2docx.py turns it into the Word
// file Ruth can read. Run both when either page changes.
//
//   node scripts/legal-snapshot.mjs <outputDirectory>

import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
if (!OUT) {
  console.error('Where to? node scripts/legal-snapshot.mjs <outputDirectory>');
  process.exitCode = 1;
}

const PAGES = [
  { url: 'https://selodia.app/privacy', file: 'privacy-policy-live.md' },
  { url: 'https://selodia.app/terms', file: 'terms-live.md' },
];

// The pages are server-rendered with no client JavaScript, so the HTML that
// arrives IS the document. Headings, paragraphs and list items in source order
// is the whole structure - there is nothing else on them.
const TAGS = /<(h1|h2|p|li)\b[^>]*>([\s\S]*?)<\/\1>/g;

function plain(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

if (OUT) {
  for (const page of PAGES) {
    const res = await fetch(page.url, { headers: { 'User-Agent': 'selodia-legal-snapshot' } });
    if (!res.ok) {
      console.error(`${page.url} answered ${res.status}. Nothing written.`);
      process.exitCode = 1;
      continue;
    }
    const html = await res.text();
    const lines = [];
    let match;
    while ((match = TAGS.exec(html)) !== null) {
      const text = plain(match[2]);
      if (!text) continue;
      if (match[1] === 'h1') lines.push(`# ${text}`);
      else if (match[1] === 'h2') lines.push(`## ${text}`);
      else if (match[1] === 'li') lines.push(`- ${text}`);
      else lines.push(text);
    }

    // A snapshot with no body is a silent failure dressed as a success, and it
    // would overwrite a good copy with an empty one.
    if (lines.filter((l) => l.startsWith('#')).length < 3) {
      console.error(`${page.url}: only ${lines.length} blocks found. Refusing to write.`);
      process.exitCode = 1;
      continue;
    }

    const stamp = new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London',
    });
    const body =
      `*Taken from ${page.url} on ${stamp}. This is what the page served, ` +
      `not what the repository says it should serve.*\n\n` +
      lines.join('\n\n') + '\n';

    fs.writeFileSync(path.join(OUT, page.file), body, 'utf8');
    console.log(`${page.file}  ${lines.length} blocks`);
  }
}
