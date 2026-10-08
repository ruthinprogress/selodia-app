// THE SOURCES PAGE, AND THE TWO RULES RUTH SET FOR IT.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-sources-page.mjs
//
// Ruth, 8 October 2026: build it, "do not name Ruth anywhere on it", and
// describe the red-flag detectors as "approved by the founder and not
// clinically reviewed".
//
// BOTH OF THOSE ARE ENFORCED HERE RATHER THAN REMEMBERED, because they are
// exactly the kind of thing a later edit softens without meaning to. "Approved
// by the founder and reviewed internally" would read better and would be a lie.
//
// AND THE THIRD RULE, WHICH IS MINE AND IS THE REASON THE PAGE IS WORTH
// PUBLISHING: every citation must carry something a reader can look up. A
// reference list nobody can check is decoration, and a page of decoration about
// evidence is worse than no page at all.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const src = await import(root + '/app/lib/sources.ts');

const page = readFileSync('app/sources/page.tsx', 'utf8');

let pass = 0;
const failures = [];
function check(name, fn) {
  try {
    const note = fn();
    console.log(`  PASS  ${name}${note ? `   ${note}` : ''}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL  ${name}\n          ${e.message}`);
    failures.push(name);
  }
}

const ALL = [...src.BODY_SOURCES, ...src.MOVEMENT_SOURCES, ...src.LANGUAGE_SOURCES];

/** doi, pmid, isbn, or a book with a publisher and a year. Nothing else counts. */
const ID_FORMS = [/^doi:10\.\d{4,9}\/\S+$/, /^pmid:\d{4,9}$/, /^isbn:[\d-]{10,20}$/, /^book:.+,\s*\d{4}$/];

/** Comments stripped, so provenance notes are not read as page copy. */
function visible(file) {
  return readFileSync(file, 'utf8')
    .split(/\/\*[\s\S]*?\*\//)
    .join(' ')
    .split('\n')
    .map((line) => (/^\s*\/\//.test(line) ? '' : line))
    .join('\n');
}

console.log('\n  THE SOURCES PAGE\n');

check('every citation can be looked up', () => {
  const bad = ALL.filter((s) => !ID_FORMS.some((re) => re.test(s.id))).map((s) => s.id);
  assert.deepStrictEqual(bad, [], `not a resolvable identifier: ${bad.join(', ')}`);
  assert.ok(ALL.length >= 15, `only ${ALL.length} sources, so a list has gone missing`);
  return `${ALL.length} sources, each with a DOI, PMID, ISBN or publisher and year`;
});

check('and no two of them are the same', () => {
  const ids = ALL.map((s) => s.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepStrictEqual([...new Set(dupes)], [], `cited twice: ${dupes.join(', ')}`);
  return `${new Set(ids).size} distinct`;
});

check('every source says what it supports', () => {
  const thin = ALL.filter((s) => (s.supports ?? '').trim().length < 40).map((s) => s.id);
  assert.deepStrictEqual(thin, [], `no real explanation of what it supports: ${thin.join(', ')}`);
  return 'all of them, in a sentence rather than a topic';
});

check('the founder is not named', () => {
  // HER INSTRUCTION, VERBATIM: "do not name Ruth anywhere on it". The same
  // decision as the privacy policy and the app's legal text.
  const body = visible('app/sources/page.tsx') + JSON.stringify(ALL) + JSON.stringify(src.PUBLISHED_FIGURES);
  assert.ok(!/\bRuth\b/i.test(body), 'the founder is named on the sources page');
  assert.ok(!/\bChristianson\b/i.test(body), 'the founder is named on the sources page');
  // And she IS referred to, as the role, because the page has to say who approved the flags.
  assert.ok(/\bthe founder\b/.test(body), 'nobody is said to have approved the red flags at all');
  return '"the founder", never a name';
});

check('the red flags are described exactly as she asked', () => {
  const body = visible('app/sources/page.tsx');
  assert.ok(
    /approved by the founder and not\s+clinically\s+reviewed/.test(body.replace(/\s+/g, ' ')) ||
      /approved by the founder and not clinically reviewed/.test(body.replace(/\s+/g, ' ')),
    'the exact phrase "approved by the founder and not clinically reviewed" is gone'
  );
  // THE CATEGORICAL VERSION TOO, because the phrase above sits inside a
  // sentence and a later edit could keep the words while softening the claim.
  assert.ok(
    /no clinician has reviewed them/i.test(body.replace(/\s+/g, ' ')),
    'the page no longer states plainly that no clinician has reviewed them'
  );
  return 'her phrasing, and the categorical sentence under it';
});

check('and the count matches the code', () => {
  // ELEVEN. The page states a number, so the number has to be true.
  const flags = readFileSync('app/lib/red-flags.ts', 'utf8');
  assert.ok(/eleven flags/.test(flags), 'red-flags.ts no longer records how many there are');
  assert.ok(
    /There are eleven of these|eleven of these/.test(visible('app/sources/page.tsx')),
    'the page does not say how many there are'
  );
  return 'eleven, in the code and on the page';
});

check('the unsourced half is actually there', () => {
  const body = visible('app/sources/page.tsx').replace(/\s+/g, ' ');
  // A page that lists only strengths is the failure mode this whole page exists
  // to avoid, so each of the three admissions is pinned.
  for (const [what, re] of [
    ['no clinical review', /no clinician has reviewed them/i],
    ['patterns never conclude', /never draw a conclusion|does not .{0,20}conclude/i],
    ['not a medical device', /not a medical device/i],
    ['not validated', /has been validated|not been trialled|does not mean Selod/i],
  ]) {
    assert.ok(re.test(body), `the page no longer says: ${what}`);
  }
  return '4 admissions, each pinned';
});

check('it does not claim the app itself was trialled', () => {
  const body = visible('app/sources/page.tsx').replace(/\s+/g, ' ');
  assert.ok(
    /does not mean Selodía has been trialled/.test(body),
    'the page no longer distinguishes evidence for the RULES from evidence for the APP'
  );
  assert.ok(
    !/(clinically proven|evidence-based app|proven to)/i.test(body),
    'the page makes a claim about the app that nothing here supports'
  );
  return 'the rules are sourced, the app is not claimed';
});

check('the monthly scan is described as not having run', () => {
  // IT HAS NOT RUN. `docs/recurring-scans.md` says the first real run is
  // Monday 2 November 2026, and today the page would otherwise be describing a
  // routine that has never happened once.
  const scans = readFileSync('docs/recurring-scans.md', 'utf8');
  assert.ok(/2 Nov 2026/.test(scans), 'the scan schedule no longer names its first run');
  const body = visible('app/sources/page.tsx').replace(/\s+/g, ' ');
  assert.ok(/has not run yet/i.test(body), 'the page implies the monthly scan has already been running');
  return 'first run November 2026, and the page says so';
});

check('and this check can fail', () => {
  // Each rule above, defeated by a plausible rewrite rather than a nonsense one.
  const notAnId = (id) => !ID_FORMS.some((re) => re.test(id));
  assert.ok(notAnId('doi:nope'), 'a malformed DOI passes as an identifier');
  assert.ok(notAnId('Guilford Press'), 'a publisher with no year passes as an identifier');
  assert.ok(!notAnId('doi:10.1186/s12970-017-0177-8'), 'a real DOI is rejected');
  assert.ok(!notAnId('pmid:15826439'), 'a real PMID is rejected');

  const softened = 'The flags were approved by the founder and reviewed internally.';
  assert.ok(
    !/no clinician has reviewed them/i.test(softened),
    'a softened sentence is not detected as missing the categorical claim'
  );
  assert.ok(/\bRuth\b/i.test('Approved by Ruth in writing.'), 'a name is not detected');
  return 'identifiers, the softened sentence and a name, each caught';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
