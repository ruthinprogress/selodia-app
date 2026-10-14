// THE NUMBERS SHE IS ASKED FOR, REACHABLE WITHOUT OPENING A LETTER.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-standing-details.mjs
//
// Ruth, 14 October 2026: "It might be useful to populate a section where the
// pertinent details always live as they come in from the user, stuff that
// usually stays the same like NHS numbers, axa memebership numbers etc etc.
// easy to access for the user." And: "also anything that can be a live link to
// reduce friction, should be."
//
// WHAT THIS GUARDS, in the order it would break:
//
//  1. ONE ROW PER THING. The whole value of a constant is that there is one of
//     it. Two live NHS numbers is worse than none, because she cannot tell
//     which one the desk will accept. The unique index enforces it; this
//     checks the normaliser that feeds the index, because an index on a key
//     that changes with punctuation enforces nothing.
//  2. A ONE-OFF NEVER GETS IN. A row reading "Appointment: 3pm Tuesday" is
//     wrong by Thursday, and two of those would teach her not to trust the
//     ones that are right.
//  3. THE VALUE ARRIVES UNTOUCHED. "485 777 3456" is how it is printed on the
//     card she reads from. Tidying the spacing would make it harder to read
//     aloud while looking neater.
//  4. THE TWO SIDES AGREE on the shape of a row, because they are two copies
//     of one type and this repository has drifted six such pairs in a
//     fortnight.
//  5. A TAP DOES THE RIGHT THING. A surgery's page opens; a reference number
//     does not get dialled.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const S = await import(root + '/app/lib/care-constants.ts');
const C = await import(root + '/mobile/src/lib/care-constants.ts');

const read = (p) => readFileSync(p, 'utf8').split('\r\n').join('\n');
const serverLib = read('app/lib/care-constants.ts');
const clientLib = read('mobile/src/lib/care-constants.ts');
const migration = read('supabase/migrations/20261014170000_the_numbers_that_stay_the_same_have_a_home.sql');
const me = read('mobile/src/components/me-protocol.tsx');
const screen = read('mobile/src/app/(tabs)/me.tsx');
const commit = read('app/lib/pending-save.ts');
const chat = read('app/api/ask-selodia/route.ts');

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

console.log('\n  THE NUMBERS SHE IS ASKED FOR\n');

check('one row per thing, however the label was written', () => {
  const same = ['NHS number', 'nhs number', 'My NHS no.', 'NHS No', 'nhs  number'];
  const keys = new Set(same.map((l) => S.labelKey(l)));
  assert.strictEqual(keys.size, 1, `${same.length} ways of saying it became ${keys.size} rows: ${[...keys].join(' | ')}`);
  assert.strictEqual([...keys][0], 'nhs number');
  return 'five spellings, one key';
});

check('two different things stay two things', () => {
  // THE DANGEROUS DIRECTION. Merging is silent and overwrites a number with
  // another number, so a normaliser that is too keen is worse than one that is
  // too dull. An insurer's membership and a gym's are not one row.
  const apart = [
    ['AXA membership number', 'Gym membership number'],
    ['NHS number', 'Hospital number'],
    ['Policy number', 'Claim number'],
  ];
  for (const [a, b] of apart) {
    assert.notStrictEqual(S.labelKey(a), S.labelKey(b), `"${a}" and "${b}" became one row`);
  }
  return `${apart.length} pairs kept apart`;
});

check('a one-off cannot get in', () => {
  const refused = [
    { label: 'Appointment time', value: '3pm Tuesday' },
    { label: 'Next appointment', value: '12 November' },
    { label: 'Latest result', value: '5.2' },
    { label: 'Weight', value: '64.2 kg' },
    { label: 'Dose today', value: '10mg' },
  ];
  for (const r of refused) {
    assert.strictEqual(S.coerceConstant(r), null, `"${r.label}" was accepted as a standing detail`);
  }
  // And the real ones still are, or this test is just a wall.
  const kept = [
    { label: 'NHS number', value: '485 777 3456' },
    { label: 'AXA membership number', value: 'AX-99120' },
    { label: 'Date of birth', value: '3 March 1984' },
    { label: 'GP practice', value: 'https://example.nhs.uk/appointments' },
  ];
  for (const k of kept) {
    assert.ok(S.coerceConstant(k), `"${k.label}" was refused`);
  }
  return `${refused.length} refused, ${kept.length} kept`;
});

check('a label is not written in the first person', () => {
  // Ruth, 14 October 2026, reading a line of a test transcript: "why did it say
  // 'my' axa memebership?" The line was my own test input, written in her voice
  // - but nothing stopped the real thing. The model is asked for the label in
  // their words, so "my NHS number" is a label it will write, and in a section
  // that is already hers every row reading "my..." is the app talking about her
  // rather than to her. Same fault check-second-person.mjs exists for.
  const cases = [
    ['my NHS number', 'NHS number'],
    ['My AXA membership number', 'AXA membership number'],
    ['our policy number', 'policy number'],
    // Left alone: no possessive to take off.
    ['NHS number', 'NHS number'],
    // AND AN ACRONYM KEEPS ITS SHAPE. A capital is only restored when the
    // original had one, so "eGFR" is never turned into "EGFR".
    ['my eGFR', 'eGFR'],
  ];
  for (const [given, shown] of cases) {
    const c = S.coerceConstant({ label: given, value: 'X1' });
    assert.ok(c, `"${given}" was refused outright`);
    assert.strictEqual(c.label, shown, `"${given}" is shown as "${c.label}"`);
  }
  // A label that is ONLY a possessive is not silently emptied.
  const bare = S.coerceConstant({ label: 'my', value: 'X1' });
  assert.strictEqual(bare && bare.label, 'my', 'a one-word label was stripped to nothing');
  return `${cases.length} labels`;
});

check('the value arrives exactly as written', () => {
  const c = S.coerceConstant({ label: 'NHS number', value: '485 777 3456' });
  assert.strictEqual(c.value, '485 777 3456', 'the spacing was tidied away');
  const dirty = S.coerceConstant({ label: ' NHS number ', value: ' 485  777 3456 ' });
  // Trimmed and inner runs collapsed, which is whitespace damage rather than
  // formatting: nobody prints two spaces between groups on purpose.
  assert.strictEqual(dirty.value, '485 777 3456');
  return 'grouped digits kept';
});

check('a number said twice in one message corrects itself', () => {
  const out = S.coerceConstants([
    { label: 'NHS number', value: '485 777 3456' },
    { label: 'nhs no.', value: '485 777 3457' },
  ]);
  assert.strictEqual(out.length, 1, `${out.length} rows from one self-correction`);
  assert.strictEqual(out[0].value, '485 777 3457', 'the first value won, so a correction was lost');
  return 'last one wins';
});

check('the database holds one row per label, and says so', () => {
  assert.ok(
    /create unique index[\s\S]*care_constants_one_per_label[\s\S]*\(user_id, label_key\)/.test(migration),
    'nothing stops two rows for one label'
  );
  assert.ok(/on conflict|onConflict/i.test(serverLib), 'a repeat insert fails instead of correcting the value');
  return 'enforced at the write, not in a prompt';
});

check('a note is not erased by a number arriving on its own', () => {
  assert.ok(
    /existing\.get\(key\)\?\.note/.test(serverLib),
    'an arriving row with no note wipes the line explaining what the number is for'
  );
  return 'silence leaves it alone';
});

check('both sides describe the same row', () => {
  const fields = (text, name) => {
    const start = text.indexOf(name);
    assert.ok(start > -1, `${name} is gone`);
    const body = text.slice(start, text.indexOf('};', start));
    return [...body.matchAll(/^\s{2}(\w+)[?]?:/gm)].map((m) => m[1]).sort();
  };
  const server = fields(serverLib, 'export type StoredConstant');
  const client = fields(clientLib, 'export type StandingDetail');
  // StoredConstant is CareConstant plus the stored fields, so the server's own
  // list is split across two declarations; what matters is that nothing the
  // client reads is absent on the server.
  const serverAll = server.concat(fields(serverLib, 'export type CareConstant'));
  const missing = client.filter((f) => !serverAll.includes(f));
  assert.deepStrictEqual(missing, [], `the app reads fields the server does not store: ${missing.join(', ')}`);
  return `${client.length} fields, both sides`;
});

check('a tap opens what can be opened and copies what cannot', () => {
  const cases = [
    ['GP practice', 'https://example.nhs.uk/book', 'open'],
    ['GP practice', 'www.example-practice.co.uk', 'open'],
    ["Consultant's secretary", 'secretary@example.org', 'open'],
    ['Surgery phone', '020 7946 0958', 'open'],
    ['Secretary direct line', '+44 7700 900123', 'open'],
    ['AXA membership number', 'AX-99120', 'copy'],
    ['Date of birth', '3 March 1984', 'copy'],
  ];
  for (const [label, value, kind] of cases) {
    const got = C.tapActionFor(value, label).kind;
    assert.strictEqual(got, kind, `"${label}: ${value}" was treated as ${got}`);
  }
  // Every openable one carries the sentence that says what the tap will do.
  for (const [label, value, kind] of cases) {
    if (kind !== 'open') continue;
    const a = C.tapActionFor(value, label);
    assert.ok(a.verb && a.verb.length > 0, `"${value}" opens something without saying what`);
  }
  return `${cases.length} values`;
});

check('an NHS number is never offered as a phone call', () => {
  // THIS IS THE ONE THAT CAUGHT ME. The first version of tapActionFor read the
  // digits alone, and "485 777 3456" is ten digits, so her NHS number came out
  // as something to dial. The first version of THIS CHECK asserted that too -
  // written against the behaviour instead of against what it is for, which is
  // the failure "a test must be able to fail" is really about.
  //
  // Nothing in the digits separates an NHS number from a landline. Only the
  // label does, so a number whose label does not mention a telephone copies.
  const notPhones = [
    ['NHS number', '485 777 3456'],
    ['Hospital number', '0123456789'],
    ['Policy number', '07700900123'],
  ];
  for (const [label, value] of notPhones) {
    assert.strictEqual(
      C.tapActionFor(value, label).kind,
      'copy',
      `tapping "${label}" would dial it`
    );
  }
  // And with no label at all - the safe default is the dull one.
  assert.strictEqual(C.tapActionFor('020 7946 0958').kind, 'copy', 'an unlabelled number is dialled on a guess');
  return `${notPhones.length} numbers, none dialled`;
});

check('the section is on the Me tab, with the records below it', () => {
  assert.ok(/DETAILS_SECTION/.test(me), 'the Me tab does not render a standing details section');
  const details = me.indexOf('DETAILS_SECTION, rows: []');
  const careLast = me.indexOf('renderSection(care,');
  assert.ok(details > -1 && careLast > -1, 'one of the two trailing sections is gone');
  assert.ok(details < careLast, 'the records are above the details, so the quick reference needs scrolling to');
  // ONE renderer, so the heading size and the chevron sense cannot diverge.
  assert.ok(/instead\?: \{ count: number; subtitle: string; body: React\.ReactNode \}/.test(me),
    'the details section has its own heading markup, which is how two chevrons came to disagree');
  return 'details, then How I Access Care';
});

check('a person whose only entry is a number still sees their tab', () => {
  assert.ok(
    /byTab\.me\.length > 0 \|\| details\.length > 0/.test(screen),
    'the Me tab shows "nothing here yet" over a tab that holds a standing detail'
  );
  assert.ok(/from\('care_constants'\)/.test(screen), 'the screen never reads the details');
  return 'rendered on details alone';
});

check('both ways in are wired: a letter kept, and a number said', () => {
  assert.ok(/recordConstantsFromRecord/.test(commit), 'keeping a care record writes no standing details');
  assert.ok(/proposal\.type === 'care'/.test(commit), 'the write is not limited to a care record');
  assert.ok(/standingDetails/.test(chat), 'chat cannot capture a number said in passing');
  assert.ok(/coerceConstants\(result\.standingDetails\)/.test(chat), 'the field is declared and never read');
  assert.ok(/constantsBlock\(standingDetails\)/.test(chat), 'the chat is never given the list, so it cannot answer from it');
  return 'document and conversation';
});

check('and this check can fail', () => {
  // THE OLD WORLD: a reference existed only as a line of text inside one record.
  const onlyProse = '**To quote**\nNHS number: 485 777 3456';
  assert.strictEqual(S.coerceConstant(onlyProse), null, 'a block of text reads as a standing detail');
  // And a normaliser that ignored punctuation case would merge these.
  assert.notStrictEqual(S.labelKey('AXA membership number'), S.labelKey('Gym membership number'));
  // And the old screen condition.
  const oldScreen = '{byTab.me.length > 0 ? (';
  assert.ok(!/\|\| details\.length > 0/.test(oldScreen), 'the old condition reads as fixed');
  return 'prose is not a row, and the old condition fails';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
