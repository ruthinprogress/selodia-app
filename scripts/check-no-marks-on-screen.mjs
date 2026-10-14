// NO STARS OR UNDERSCORES REACH HER SCREEN.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-no-marks-on-screen.mjs
//
// Ruth, 12 October 2026, on a care record in her Me tab that read "**Seen by**"
// and "_Taken from a document you photographed._": "the awful formatting
// instantly makes me feel like it's a junk app I can't trust."
//
// The record was written with marks on purpose, and the chat bubble had a
// parser for bold. But the parser only ever ran on HER side of the chat, and
// the Me tab drew the record as one plain string. So this checks three things:
// that the parser turns a real record into blocks with no marks left in the
// text, that every place showing app-written text goes through the formatter,
// and that the old render fails the same test.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { blocks, isPlain, runs } = await import(root + '/mobile/src/lib/rich-text.ts');
const { cardBody } = await import(root + '/app/lib/clinical-card.ts');

const read = (p) => readFileSync(p, 'utf8').split('\r\n').join('\n');
const bubble = read('mobile/src/components/chat-bubble.tsx');
const me = read('mobile/src/components/me-protocol.tsx');

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

/** A letter shaped like the knee referral she shared, with nothing of hers in it. */
const LETTER = {
  kind: 'referral',
  title: 'GP referral to Physiotherapy',
  dated: '2026-10-12',
  about: 'Referral to the physiotherapy team for knee symptoms',
  clinician: { name: 'Dr A Example', role: 'GP', department: null, organisation: 'Example Practice' },
  references: [{ label: 'NHS number', value: '000 000 0000', confirmed: true }],
  contact: { phone: '0200 000 0000', secretary: null, email: null, address: '1 Example Road' },
  says: ['Pain at the back of the knee after running.', 'Symptoms recurred on stairs.'],
  plainWords: 'The GP is asking for an assessment.\n\nA graded return to exercise is requested.',
  medications: [],
  plan: ['Physiotherapy assessment requested.', 'Advice on a graded return to exercise.'],
  review: null,
  routeBackIn: null,
  unreadable: ['The Ref field is blank.'],
};

/** Everything a reader would see: the text of every block and run, joined. */
function visible(text) {
  return blocks(text)
    .map((b) => (b.kind === 'heading' || b.kind === 'note' ? b.text : b.runs.map((r) => r.text).join('')))
    .join('\n');
}

const MARKS = /\*\*|(^|\s)_|_($|\s|[.,])/m;

console.log('\n  NO STARS OR UNDERSCORES REACH HER SCREEN\n');

check('a real care record leaves no marks in what is drawn', () => {
  const body = cardBody(LETTER);
  assert.ok(MARKS.test(body), 'the fixture has no marks, so this proves nothing');
  const shown = visible(body);
  assert.ok(!MARKS.test(shown), `marks survived the parser:\n${shown}`);
  return `${blocks(body).length} blocks, no marks`;
});

check('headings, notes, bullets and steps are recognised', () => {
  const b = blocks('**Seen by**\nDr A\n\n_Taken from a photo._\n- one\n• two\n3. three');
  assert.deepStrictEqual(
    b.map((x) => x.kind),
    ['heading', 'para', 'note', 'bullet', 'bullet', 'bullet']
  );
  assert.strictEqual(b[0].text, 'Seen by');
  assert.strictEqual(b[5].marker, '3.');
  return 'six kinds, in order';
});

check('a record keeps its lines, so separate facts stay separate', () => {
  const b = blocks('**Contact**\nPhone: 1\nAddress: 2');
  assert.strictEqual(b[1].kind, 'para');
  assert.strictEqual(b[1].runs.map((r) => r.text).join(''), 'Phone: 1\nAddress: 2');
  return 'line breaks kept inside a paragraph';
});

check('what people type is left alone', () => {
  // A single star, snake_case and a URL with underscores are not formatting.
  for (const s of ['5 * 3 = 15', 'my_file_name', 'see https://x.org/a_b_c', 'Feeling ok*']) {
    assert.ok(isPlain(s), `"${s}" was treated as formatted`);
  }
  assert.ok(isPlain('Just a sentence.'), 'an ordinary sentence left the cheap path');
  return 'single marks stay literal';
});

check('emphasis inside a line', () => {
  const r = runs('Ask about **cover** and _excess_.');
  assert.deepStrictEqual(
    r.map((x) => [x.text, !!x.bold, !!x.italic]),
    [['Ask about ', false, false], ['cover', true, false], [' and ', false, false], ['excess', false, true], ['.', false, false]]
  );
  return 'bold and quiet runs';
});

check('both sides of the chat draw through the formatter', () => {
  const uses = bubble.match(/<FormattedText text=\{children as string\} selectable \/>/g) ?? [];
  assert.strictEqual(uses.length, 2, `the chat bubble formats ${uses.length} of its 2 sides`);
  assert.ok(!/<ThemedText type="small" selectable>\s*\{children\}/.test(bubble), 'a side still prints the raw string');
  return 'assistant and person';
});

check('a Me record draws through the formatter', () => {
  // SINCE 14 OCTOBER the body goes through RecordBody, which cuts a care record
  // at "Seen by" and draws BOTH halves through the formatter. What this holds is
  // unchanged: no part of a record reaches the screen unformatted.
  assert.ok(/<RecordBody text=\{layout\.body\}/.test(me), 'the card body no longer goes through RecordBody');
  const recordBody = me.slice(me.indexOf('function RecordBody('), me.indexOf('function MeCardRow('));
  assert.ok(/<FormattedText text=\{text\} \/>/.test(recordBody), 'a record with no letter in it is printed raw');
  assert.ok(/<FormattedText text=\{front\} \/>/.test(recordBody), 'the front of a record is printed raw');
  assert.ok(/<FormattedText text=\{rest\} \/>/.test(recordBody), 'the letter is printed raw when it is shown');
  assert.ok(/<FormattedText\s+text=\{layout\.latest\}/.test(me), 'the record under the summary is printed raw');
  assert.ok(!/<ThemedText type="detail">\{layout\.body\}<\/ThemedText>/.test(me), 'the old raw body is still there');
  return 'body and record';
});

check('section names are not drawn at the page title size', () => {
  assert.ok(!/<ThemedText type="display" style=\{styles\.heading\}>/.test(me), 'Me sections are still the size of the page title');
  assert.ok(/<ThemedText type="sectionTitle" style=\{styles\.heading\}>/.test(me), 'Me sections do not use the section size');
  return 'sectionTitle, as the rest of the app';
});

check('and this check can fail', () => {
  // THE OLD RENDER: the whole string, as typed. It must fail the first test.
  const body = cardBody(LETTER);
  const oldShown = body;
  assert.ok(MARKS.test(oldShown), 'the raw string reads as clean, so the first test cannot fail');
  // And the old bubble, which formatted only one side.
  const oldBubble = '{hasText && (\n<ThemedText type="small" selectable>\n{children}\n</ThemedText>\n)}';
  assert.ok(/<ThemedText type="small" selectable>\s*\{children\}/.test(oldBubble), 'the raw-bubble pattern does not match the old bubble');
  return 'the old render shows its marks';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
