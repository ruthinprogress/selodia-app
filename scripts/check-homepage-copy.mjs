// THE RULES THE HOMEPAGE COPY HAS TO KEEP, enforced rather than remembered.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-homepage-copy.mjs
//
// Ruth, 8 October 2026: "No em dashes anywhere a person can read. Grep the
// rendered pages for em dashes and for the words tracker, tracking, dashboard,
// diary and journal before reporting."
//
// A GREP RUN ONCE BY HAND IS NOT A RULE. It is a thing that was true the
// afternoon somebody remembered to run it. These are the same greps, pinned to
// the build, so the next person to write a sentence finds out before she does.
//
// IT CHECKS TWO DIFFERENT THINGS, and the split is the point:
//
//   THE COPY MODULE   every exported string in `app/lib/homepage-copy.ts`,
//                     walked recursively. This is where the homepage's words
//                     live, so this is where the vocabulary rules bite.
//   THE OTHER PAGES   the reader-visible strings in privacy, terms, support and
//                     delete-account, with comments stripped first. The
//                     provenance comments in those files are the most useful
//                     history in the repository and several contain em dashes;
//                     a check that read them would be unrunnable and the
//                     comments would lose.
//
// WHY `score` AND `streak` ARE HANDLED SEPARATELY. They are not banned, they
// are RATIONED: the brief allows them in exactly one supplied sentence, in
// section 5, and nowhere else. A flat ban would delete the sentence that says
// there are none, which is one of the better sentences on the page.

import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const copy = await import(root + '/app/lib/homepage-copy.ts');

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

// ---------------------------------------------------------------------------
// The rules, as functions, so the self-test can run the same ones.
// ---------------------------------------------------------------------------

const EM_DASH = '—';

/** Never, anywhere on the site. The nouns the product is not. */
const BANNED = ['tracker', 'tracking', 'dashboard', 'diary', 'journal'];

/** Allowed only in the one supplied sentence in section 5. */
const RATIONED = ['score', 'streak'];

function hasEmDash(s) {
  return s.includes(EM_DASH);
}

function bannedWordsIn(s) {
  const lower = s.toLowerCase();
  // Word-ish boundaries, so "journalist" would be caught but "trackers" is the
  // same offence as "tracker" and is meant to be.
  return BANNED.filter((w) => lower.includes(w));
}

function rationedWordsIn(s) {
  const lower = s.toLowerCase();
  return RATIONED.filter((w) => lower.includes(w));
}

/** Every index at which `word` appears, case-insensitively. */
function occurrences(text, word) {
  const lower = text.toLowerCase();
  const out = [];
  for (let i = lower.indexOf(word); i !== -1; i = lower.indexOf(word, i + 1)) out.push(i);
  return out;
}

/**
 * Whether the word at `at` is being denied rather than claimed.
 *
 * Looks back far enough to catch "no tracking" and "never used for tracking",
 * and not so far that a negation in the previous clause licences a claim in
 * this one. Deliberately crude: it is a guard on a short list of words in four
 * files, not a parser, and the self-test below proves both directions.
 */
function negatedAt(text, at) {
  const before = text.slice(Math.max(0, at - 28), at).toLowerCase();
  return /\b(no|not|never|nothing|without)\b[^.]*$/.test(before);
}

/** Every string anywhere in the module's exports, with a path to it. */
function strings(value, path = '', out = []) {
  if (typeof value === 'string') out.push({ path, text: value });
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) strings(v, path ? `${path}.${k}` : k, out);
  return out;
}

/** A source file with its comments removed, so provenance notes are not read as copy. */
function withoutComments(file) {
  const src = readFileSync(file, 'utf8');
  const noBlocks = src.split(/\/\*[\s\S]*?\*\//).join(' ');
  return noBlocks
    .split('\n')
    .map((line) => {
      // A `//` inside a string literal is not a comment. Only `//` that starts
      // a line, after whitespace, counts: that is how every comment in these
      // files is actually written, and the alternative is parsing JavaScript.
      const m = line.match(/^\s*\/\//);
      return m ? '' : line;
    })
    .join('\n');
}

const ALL = strings({
  META: copy.META,
  MASTHEAD: copy.MASTHEAD,
  PROBLEM: copy.PROBLEM,
  WHAT_IT_DOES: copy.WHAT_IT_DOES,
  HOW_IT_WORKS: copy.HOW_IT_WORKS,
  REAL_LIFE: copy.REAL_LIFE,
  SEEING_SOMEONE: copy.SEEING_SOMEONE,
  RECORD_STAYS_YOURS: copy.RECORD_STAYS_YOURS,
  WRITING: copy.WRITING,
  WAITING_LIST: copy.WAITING_LIST,
  FOOTER: copy.FOOTER,
});

const PUBLIC_PAGES = [
  'app/privacy/page.tsx',
  'app/terms/page.tsx',
  'app/support/page.tsx',
  'app/delete-account/page.tsx',
];

console.log('\n  THE HOMEPAGE COPY\n');

check('every word on the homepage comes from one file', () => {
  const page = readFileSync('app/page.tsx', 'utf8');
  // A sentence hard-coded in the page would be invisible to every rule below.
  // Looking for prose rather than for strings: a CSS value and a class name are
  // strings too, and neither is copy.
  const prose = [...page.matchAll(/>([A-Z][a-z]+(?:\s+[a-z]+){3,}[.?])</g)].map((m) => m[1]);
  assert.deepStrictEqual(prose, [], `copy is hard-coded in page.tsx: ${prose.join(' | ')}`);
  assert.ok(ALL.length > 40, `only ${ALL.length} strings found, so the walk is not reaching them`);
  return `${ALL.length} strings, all from homepage-copy.ts`;
});

check('no em dashes anywhere a person can read', () => {
  const bad = ALL.filter((s) => hasEmDash(s.text)).map((s) => s.path);
  assert.deepStrictEqual(bad, [], `em dash in: ${bad.join(', ')}`);
  return 'homepage clean';
});

check('and none on the other public pages either', () => {
  const bad = [];
  for (const file of PUBLIC_PAGES) {
    const body = withoutComments(file);
    if (body.includes(EM_DASH)) {
      const line = body.split('\n').findIndex((l) => l.includes(EM_DASH)) + 1;
      bad.push(`${file}:${line}`);
    }
  }
  assert.deepStrictEqual(bad, [], `em dash in: ${bad.join(', ')}`);
  return `${PUBLIC_PAGES.length} pages clean`;
});

check('it is never called a tracker, a dashboard, a diary or a journal', () => {
  const bad = ALL.flatMap((s) => bannedWordsIn(s.text).map((w) => `${w} in ${s.path}`));
  assert.deepStrictEqual(bad, [], bad.join('; '));

  // THE SAME WORDS ON THE OTHER PUBLIC PAGES, WITH ONE DIFFERENCE, and the
  // difference is the whole of why this is not one rule.
  //
  // On the homepage the ban is absolute: the brief says not to call it a
  // tracker AND not to say it is "not a fitness tracker", because a denial
  // still puts the word and the category in the reader's head.
  //
  // The privacy policy is a different document with a different job, and it
  // contains "There is no tracking, no advertising identifier, and no
  // third-party analytics." That is not the product describing itself, it is a
  // promise about analytics, and it is one of the more valuable sentences in
  // the policy. So here a NEGATED occurrence is allowed and a bare one is not.
  const onPages = [];
  for (const file of PUBLIC_PAGES) {
    const body = withoutComments(file);
    for (const w of BANNED) {
      for (const at of occurrences(body, w)) {
        if (!negatedAt(body, at)) onPages.push(`${w} in ${file}`);
      }
    }
  }
  assert.deepStrictEqual(onPages, [], onPages.join('; '));
  return `${BANNED.length} words: none on the homepage, only negated elsewhere`;
});

check('score and streak appear in exactly one sentence', () => {
  const found = ALL.filter((s) => rationedWordsIn(s.text).length > 0);
  assert.strictEqual(
    found.length,
    1,
    `expected one sentence, found ${found.length}: ${found.map((f) => f.path).join(', ')}`
  );
  assert.strictEqual(
    found[0].path,
    'REAL_LIFE.paragraphs[2]',
    `allowed only in section 5, found in ${found[0].path}`
  );
  // And it is the sentence that says there are none, not a sentence offering one.
  assert.ok(
    /no streaks, scores or badges/i.test(found[0].text),
    'the one sentence with those words no longer says there are none'
  );
  return 'section 5 only, and it says there are none';
});

check('no launch date, no price, no platform named', () => {
  const joined = ALL.map((s) => s.text).join(' ');
  assert.ok(!/\b20\d\d\b/.test(joined), 'a year appears in the copy');
  assert.ok(!/[£$€]\s?\d/.test(joined), 'a price appears in the copy');
  assert.ok(
    !/\b(App Store|Google Play|Play Store|iPhone|Android|iOS)\b/.test(joined),
    'a platform is named'
  );
  // "Coming soon" and nothing more, which is the whole of what she will say.
  assert.ok(/coming soon/i.test(joined), 'the page no longer says coming soon');
  return 'coming soon, and nothing more';
});

check('and the founder is not named', () => {
  const joined = ALL.map((s) => s.text).join(' ');
  // The same rule as the app and its legal text: the company speaks, not a
  // person. `check-founder-not-named.py` covers the app; this covers the site.
  assert.ok(!/\bRuth\b/i.test(joined), 'the founder is named on the homepage');
  assert.ok(!/\bChristianson\b/i.test(joined), 'the founder is named on the homepage');
  return 'Selodía Ltd, not a person';
});

check('every internal link goes somewhere real', () => {
  const internal = [...copy.FOOTER.links.map((l) => l.href), '/privacy', '/delete-account'];
  const missing = internal.filter((href) => {
    const route = href.replace(/^\//, '');
    return route !== '' && !existsSync(`app/${route}/page.tsx`);
  });
  assert.deepStrictEqual(missing, [], `no page for: ${missing.join(', ')}`);

  // And the in-page anchors in the nav exist as ids in the page.
  const page = readFileSync('app/page.tsx', 'utf8');
  const anchors = copy.MASTHEAD.nav.map((n) => n.href).filter((h) => h.startsWith('#'));
  const dangling = anchors.filter((a) => !page.includes(`id="${a.slice(1)}"`));
  assert.deepStrictEqual(dangling, [], `nav anchor with no target: ${dangling.join(', ')}`);
  return `${internal.length} routes, ${anchors.length} anchors`;
});

check('the brand assets the page asks for are actually there', () => {
  const page = readFileSync('app/page.tsx', 'utf8');
  const refs = [...page.matchAll(/src="(\/brand\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 3, `expected the mark, the stacked lockup and the footer lockup, found ${refs.length}`);
  const missing = refs.filter((r) => !existsSync(`public${r}`));
  assert.deepStrictEqual(missing, [], `referenced but not in public/: ${missing.join(', ')}`);

  // THE 160px FLOOR. The all-terracotta colourway measures 3.10:1 on cream and
  // Part Fifteen puts a minimum width on it, so it belongs in the hero and
  // nowhere smaller.
  //
  // THIS READ THE WHOLE TAIL OF THE FILE AND TRIPPED ON ITS OWN COMMENT, which
  // is the fault this repository keeps making: a check that greps prose rather
  // than the thing. It now reads the `src` of the footer image, which is the
  // fact in question.
  const footerSrc = page.match(/className="foot__lockup"[\s\S]{0,200}?src="([^"]+)"/);
  assert.ok(footerSrc, 'no footer lockup found in the page');
  assert.ok(
    !footerSrc[1].includes('terracotta'),
    `the footer uses ${footerSrc[1]}, which is below the terracotta colourway's 160px floor`
  );

  // And the one place it IS allowed is the hero, at 168px minimum.
  const heroSrc = page.match(/className="hero__lockup"[\s\S]{0,200}?src="([^"]+)"/);
  assert.ok(heroSrc, 'no hero lockup found in the page');
  assert.ok(
    heroSrc[1].includes('terracotta'),
    'the hero is no longer the all-terracotta lockup she asked for'
  );
  const min = page.match(/\.hero__lockup\s*\{[^}]*clamp\((\d+)px/);
  assert.ok(min, 'the hero lockup has no clamped minimum width to check');
  assert.ok(
    Number(min[1]) >= 160,
    `the hero lockup can render at ${min[1]}px, below the 160px floor`
  );
  return `${refs.length} assets present, terracotta in the hero at ${min[1]}px and nowhere smaller`;
});

check('and this check can fail', () => {
  // EVERY RULE ABOVE, DEFEATED BY A FIXTURE. A check that has never been seen
  // to fail is a check nobody can trust, and this file is otherwise all
  // assertions about absence, which pass just as happily on an empty string.
  assert.ok(hasEmDash(`a sentence ${EM_DASH} with a dash`), 'an em dash is not detected');
  assert.ok(!hasEmDash('a sentence, with a comma'), 'a clean sentence is reported as dirty');

  assert.deepStrictEqual(bannedWordsIn('the best food tracker'), ['tracker'], 'tracker is not detected');
  assert.deepStrictEqual(bannedWordsIn('your daily DASHBOARD'), ['dashboard'], 'case is not handled');
  assert.deepStrictEqual(bannedWordsIn('keep your own record'), [], 'a clean sentence trips the rule');

  assert.deepStrictEqual(rationedWordsIn('build a streak'), ['streak'], 'streak is not detected');
  assert.deepStrictEqual(rationedWordsIn('small, gradual'), [], 'a clean sentence trips the rule');

  // The negation rule, both directions. If this only ever said yes, the other
  // public pages would have no rule at all.
  const denied = 'There is no tracking, and no advertising identifier.';
  assert.ok(negatedAt(denied, denied.toLowerCase().indexOf('tracking')), 'a denial is read as a claim');
  const claimed = 'Selodia is a tracking app for women.';
  assert.ok(!negatedAt(claimed, claimed.toLowerCase().indexOf('tracking')), 'a claim is read as a denial');
  const stale = 'There is no advertising. It is a tracking app.';
  assert.ok(
    !negatedAt(stale, stale.toLowerCase().indexOf('tracking')),
    'a negation in the previous sentence licences a claim in this one'
  );

  // And the comment stripper, which is the one piece of real logic here.
  const stripped = withoutComments('app/privacy/page.tsx');
  assert.ok(stripped.includes('Selod'), 'the stripper removed the page as well as the comments');
  assert.ok(!stripped.includes('// GOOGLE'), 'a line comment survived the stripper');
  return 'em dash, banned, rationed and the stripper, each proven';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
