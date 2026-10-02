// NO EM DASHES IN ANYTHING SHE READS.
//
//   node scripts/check-screen-copy.mjs
//
// Ruth, finding 3 of 1 October: "The new step 7 note contains an em dash. Screen
// copy uses no em dashes. Fix it and check the other new strings." And again in
// item 5 on 2 October, because one survived - the Today line, "No calorie target
// yet - say what you are working towards".
//
// TWICE IS WHY THIS IS A CHECK AND NOT A CAREFUL READ. She asked, I fixed the one
// she pointed at, and the next new string had one again. A rule about every
// string in a growing folder is not something anybody can hold in their head, and
// the only reason she found the second one is that she was looking at her phone.
//
// WHAT IS PROSE AND WHAT IS NOT. An em dash standing alone IS allowed: it is the
// placeholder for a figure that does not exist yet, as in "64.2 kg - muscle -",
// and she has looked at that and not objected. What is forbidden is an em dash
// used as punctuation inside a sentence, which is the thing that reads as written
// by a machine. The test is whether there is a letter on both sides of it.
//
// COMMENTS ARE NOT COPY. This reads string and template literals only. The files
// are full of em dashes in prose written for whoever reads the code next, and
// none of it reaches a screen.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOTS = ['mobile/src/app', 'mobile/src/components', 'mobile/src/lib'];
const EM = '—';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * Strip comments so only code remains.
 *
 * Deliberately crude, and safe in the one direction that matters: a string
 * containing "//" would be truncated here, which can only HIDE copy from the
 * check, never invent a failure. The alternative - no stripping - reports every
 * comment and gets the check switched off.
 */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => {
      const at = line.indexOf('//');
      if (at < 0) return line;
      // Keep the line if the // is inside a string, which this approximates by
      // counting quotes before it.
      const before = line.slice(0, at);
      const quotes = (before.match(/['"`]/g) ?? []).length;
      return quotes % 2 === 1 ? line : before;
    })
    .join('\n');
}

/** Every string and template literal in the code. */
function literals(code) {
  const found = [];
  const re = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
  let m;
  while ((m = re.exec(code)) !== null) found.push({ text: m[0], index: m.index });
  return found;
}

const offenders = [];
let scanned = 0;
let markers = 0;

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const code = codeOnly(readFileSync(file, 'utf8'));
    for (const lit of literals(code)) {
      if (!lit.text.includes(EM)) continue;
      scanned += 1;
      // A LETTER OR DIGIT ON BOTH SIDES means it is punctuation in a sentence.
      // A bare dash, or one with only spaces and punctuation around it, is the
      // missing-value marker and is allowed.
      const prose = new RegExp(`[\\p{L}\\p{N}]\\s*${EM}\\s*[\\p{L}\\p{N}]`, 'u').test(lit.text);
      if (prose) {
        const line = code.slice(0, lit.index).split('\n').length;
        offenders.push(`${file}:${line}  ${lit.text.slice(0, 90)}`);
      } else {
        markers += 1;
      }
    }
  }
}

console.log('\n  EM DASHES IN SCREEN COPY\n');
if (offenders.length === 0) {
  console.log(
    `  PASS  no em dash is used as punctuation in any string she reads.\n` +
      `        ${markers} standalone dash(es) kept, which are the missing-value marker.`
  );
  console.log('\n  1 passed, 0 failed\n');
} else {
  for (const o of offenders) console.log(`  FAIL  ${o}`);
  console.log(
    `\n  ${offenders.length} string(s) use an em dash as punctuation. Screen copy uses none;\n` +
      `  split the sentence in two, or use a colon.\n`
  );
  console.log(`  0 passed, ${offenders.length} failed\n`);
  process.exit(1);
}
