// DOES THE RECORD SAY WHAT THE LETTER COMES TO, OR JUST SAY THE LETTER AGAIN?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-letter-verdict.mjs <image...>
//
// Ruth, 14 October 2026, holding this app's record of her consultant's fee
// letter beside the one her other assistant wrote from the same photograph:
// "Selodia is not working well, I don't feel supported, I feel irritated by
// it's waffle."
//
// The other answer ran to about a hundred and fifty words and opened "It's the
// standard fee letter, and nothing in it is a problem". This app's record ran
// to about eight hundred, opened with "What was agreed", and said the letter
// back to her three times - under "What was agreed", "What the letter says" and
// "In ordinary words" - without ever reaching a verdict.
//
// So this runs the real reader on a real letter and prints what it now writes,
// with the two numbers that decide whether the complaint is fixed: how long the
// card is, and whether the first thing on it is a judgement.
//
// It reads a document; it writes nothing anywhere.

import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { readClinicalDocument } = await import(root + '/app/lib/clinical-document.ts');
const { cardBody, offerLine } = await import(root + '/app/lib/clinical-card.ts');

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (files.length === 0) {
  console.log('Give one or more image or PDF paths.');
  process.exit(1);
}

const typeOf = (path) => {
  const ext = path.toLowerCase().split('.').pop();
  if (ext === 'pdf') return null;
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
};

const sources = files.map((path) => {
  const base64 = readFileSync(path).toString('base64');
  const mediaType = typeOf(path);
  return mediaType ? { type: 'image', mediaType, base64 } : { type: 'pdf', base64 };
});

console.log(`\n  reading ${files.length} page(s)…\n`);
const started = Date.now();
const result = await readClinicalDocument(sources);
const took = ((Date.now() - started) / 1000).toFixed(1);

if (!result.ok) {
  console.log(`  could not read it: ${result.reason}`);
  process.exit(1);
}

const doc = result.document;
const body = cardBody(doc);

console.log(`  kind:  ${doc.kind}`);
console.log(`  title: ${doc.title}`);
console.log('\n  ---- the card ----\n');
console.log(body.split('\n').map((l) => `  ${l}`).join('\n'));
console.log('\n  ---- what it says in chat after it ----\n');
console.log(`  ${offerLine(doc)}`);

const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const front = body.split('**Seen by**')[0];
const firstHeading = (body.match(/\*\*([^*]+)\*\*/) ?? [])[1] ?? '(none)';

console.log('\n  ---- the measure ----\n');
console.log(`  read in                ${took}s`);
console.log(`  first heading          ${firstHeading}`);
console.log(`  bottom line            ${doc.bottomLine ? `"${doc.bottomLine}"` : 'MISSING'}`);
console.log(`  worth knowing          ${doc.watchFor.length} item(s)`);
console.log(`  costs                  ${doc.costs.length} line(s)`);
console.log(`  words before Seen by   ${words(front)}   (the part she reads first)`);
console.log(`  words in the whole card ${words(body)}`);
console.log(`  ordinary words         ${doc.plainWords ? `${words(doc.plainWords)} words` : 'none, as it should be for paperwork'}`);
console.log(`  says                   ${doc.says.length} statement(s)`);
console.log(`  could not be read      ${doc.unreadable.length}`);
console.log('');
