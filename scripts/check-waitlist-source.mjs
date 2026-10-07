// WHERE A SIGN-UP CAME FROM, AND WHAT SHE PROMISED THEM.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-waitlist-source.mjs
//
// Ruth, 7 October 2026: each article links to selodia.app with its own tag, and
// the tag is saved with the sign-up so the daily log can say which writing
// brought people in.
//
// THE TAG IS A STRANGER'S QUERY STRING GOING INTO THE ONE PUBLICLY WRITABLE
// TABLE IN THE SCHEMA. waitlist allows INSERT to anyone and grants no SELECT at
// all, which is the right shape for a sign-up form and exactly why what goes in
// has to be bounded.
//
// AND THE CONSENT LINE IS THE OTHER HALF OF THIS. The launch invitation depends
// on having told people they would be emailed. If that sentence is ever softened
// into "we'll let you know", the list is still there and the permission is not.

import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { sourceTag } = await import(root + '/app/lib/source-tag.ts');

const page = readFileSync('app/page.tsx', 'utf8');

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

console.log('\n  WHERE THEY CAME FROM\n');

check('a real tag survives', () => {
  assert.strictEqual(sourceTag('post-01'), 'post-01');
  assert.strictEqual(sourceTag('POST-01'), 'post-01', 'a tag is not lowercased');
  assert.strictEqual(sourceTag('  post-02  '), 'post-02', 'surrounding space is not trimmed');
  return 'post-01, lowercased and trimmed';
});

check('anything else becomes the homepage', () => {
  // NULL IS THE HONEST ANSWER, not a rejected sign-up. Somebody who followed a
  // mangled link still joined, and they did come from somewhere nobody can name.
  for (const bad of [
    undefined, null, '', '   ',
    '-leading-dash',
    'has space',
    'has_underscore',
    'Caps And Space',
    '../../etc/passwd',
    "'; drop table waitlist; --",
    '<script>alert(1)</script>',
    'a'.repeat(41),
  ]) {
    assert.strictEqual(sourceTag(bad), null, `${JSON.stringify(bad)} was accepted as a tag`);
  }
  return '11 bad inputs, all null';
});

check('the database refuses what the app would refuse', () => {
  // TWO GUARDS FOR ONE FACT, on purpose and stated. The app's never rejects a
  // sign-up; the database's holds when the app is wrong.
  const dir = 'supabase/migrations';
  const file = readdirSync(dir).find((f) => f.includes('where_a_sign_up_came_from'));
  assert.ok(file, 'the migration file is missing, so only the remote has this column');
  const sql = readFileSync(`${dir}/${file}`, 'utf8');
  assert.ok(/add column if not exists src text/.test(sql), 'the column is not added');
  assert.ok(/check \(src is null or/.test(sql), 'there is no constraint on the column');
  assert.ok(/length\(src\) between 1 and 40/.test(sql), 'the length is unbounded');
  return file;
});

check('the tag reaches the insert', () => {
  assert.ok(/const src = sourceTag\(formData\.get\('src'\)\)/.test(page), 'the action never reads a tag');
  assert.ok(/\.insert\(\{ email, name: [^}]*, src \}\)/.test(page), 'the tag is read and then dropped');
  // A SERVER ACTION NEVER SEES THE ADDRESS BAR, so the page has to carry it.
  assert.ok(/searchParams: Promise<\{ joined\?: string; src\?: string \}>/.test(page), 'the page does not accept a src');
  assert.ok(/<input type="hidden" name="src" value=\{tag\} \/>/.test(page), 'nothing carries the tag into the form');
  return 'query string, hidden field, action, insert';
});

check('old rows are left alone', () => {
  const dir = 'supabase/migrations';
  const file = readdirSync(dir).find((f) => f.includes('where_a_sign_up_came_from'));
  const sql = readFileSync(`${dir}/${file}`, 'utf8');
  assert.ok(!/update public\.waitlist/i.test(sql), 'the migration backfills rows she said to leave');
  assert.ok(!/default 'homepage'/i.test(sql), "the column defaults to 'homepage', which invents a provenance");
  return 'no backfill, no default';
});

console.log('\n  WHAT SHE PROMISED THEM\n');

check('the form says they will be emailed', () => {
  // THE LAUNCH INVITATION DEPENDS ON THIS SENTENCE. Without it there is a list
  // and no permission to use it.
  assert.ok(/we&rsquo;ll email you when/.test(page), 'the form no longer says they will be emailed');
  assert.ok(
    !/we&rsquo;ll let you know when\s*\n\s*it&rsquo;s ready\./.test(page),
    'the wording has gone back to "let you know", which does not name the email'
  );
  return '"leave your email and we\'ll email you when it\'s ready"';
});

check('and it says what else it will not do', () => {
  assert.ok(/Nothing else/.test(page), 'nothing bounds what the address is used for');
  assert.ok(/remove you at any time/.test(page), 'there is no way out stated');
  return 'nothing else, and a way out';
});

check('and this check can fail', () => {
  const asShipped = "Leave your email and we&rsquo;ll let you know when it&rsquo;s ready.";
  assert.ok(!/email you/.test(asShipped), 'the fixture is not the old wording');
  assert.ok(sourceTag('post-01') !== null && sourceTag('post 01') === null, 'the sanitiser does not discriminate');
  return 'the old wording and a bad tag are both detected';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
