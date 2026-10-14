// A LETTER SHE PICKED IS READ. A LETTER SHE PHOTOGRAPHED WAITS.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-a-picked-letter-is-read.mjs
//
// Ruth, 14 October 2026, in one complaint with two halves: "fix the image
// upload: 1. wierd screen comes up adking if you want the upload read....
// obviously you do, it's uncessary extra step. 2. doesn't support multiple
// image upload like Claude does"
//
// Both halves came from the same decision. A photographed letter is gathered
// before it is read, because a consultant letter is three sides and the app
// cannot know when she has finished photographing them. That is right for the
// camera and it was applied to everything - so choosing a letter out of her
// gallery, where every page she meant to send was already in her hand, put a
// tray on screen asking her to confirm the choice she had just made. And the
// picker took one image, so a three-page letter meant three trips.
//
// THE RULE NOW, and it is one rule in two places:
//
//   from the gallery   everything chosen, read at once, nothing asked
//   from the camera    one page into the tray, which waits for the others
//
// This checks the rule rather than the wording, and checks it on BOTH screens,
// because Today hands a letter to Chat and the handover is where the intent
// could quietly be dropped.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8').split('\r\n').join('\n');
const chat = read('mobile/src/app/(tabs)/index.tsx');
const quick = read('mobile/src/components/quick-log-bar.tsx');
const handoff = read('mobile/src/lib/document-handoff.ts');
const pages = read('mobile/src/lib/document-pages.ts');

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

console.log('\n  A LETTER SHE PICKED IS READ\n');

check('the gallery takes more than one image', () => {
  assert.ok(
    /allowsMultipleSelection: source === 'library'/.test(pages),
    'the page picker takes one image again, so a three-page letter is three trips'
  );
  assert.ok(/selectionLimit: MAX_PAGES/.test(pages), 'the picker has no limit, so a whole album could be chosen');
  return 'up to MAX_PAGES';
});

check('a gallery pick goes down its own path, not the one-image one', () => {
  assert.ok(/if \(source === 'library'\) \{\s*await readFromGallery\(\);/.test(chat),
    'the gallery still uses the single-image path');
  assert.ok(/await pickPageImages\('library'\)/.test(chat), 'the gallery path does not use the multi picker');
  return 'readFromGallery';
});

check('a picked letter is read with no question in between', () => {
  const fn = chat.slice(chat.indexOf('async function readFromGallery('), chat.indexOf('async function handleReadDocument('));
  assert.ok(fn.length > 0, 'readFromGallery is gone');
  assert.ok(/await readPages\(pages\)/.test(fn), 'a picked letter does not get read');
  // AND IT MUST NOT GO TO THE TRAY ON THE WAY. The tray IS the question.
  assert.ok(!/setDocumentPages/.test(fn), 'a picked letter is put in the tray, which is the step she asked me to remove');
  return 'straight to reading';
});

check('a photographed letter still waits for its other sides', () => {
  const camera = chat.slice(chat.indexOf('const result = await classifyAndLog(picked.image)'), chat.indexOf('async function handleClassified('));
  assert.ok(/setDocumentPages/.test(camera), 'a photographed page no longer waits, so a three-sided letter becomes three records');
  assert.ok(!/readPages\(/.test(camera), 'a photographed page is read before she has taken the rest');
  return 'the tray kept, for the camera';
});

check('the rule survives the handover from Today', () => {
  // The one place the intent could be dropped without anything looking wrong.
  assert.ok(/readNow\?: boolean/.test(handoff), 'the handover cannot carry whether to read it');
  assert.ok(/readNow: source === 'library'/.test(quick), 'Today hands everything over the same way');
  assert.ok(/if \(readNow\) \{\s*void readPages\(handed\);/.test(chat), 'Chat ignores what Today told it');
  // And the box is emptied of the flag too, or the next camera photo would be
  // read on arrival because a gallery pick had been through earlier.
  assert.ok(/readOnArrival = false;/.test(handoff), 'the flag is never cleared, so a later photo is read without being asked');
  return 'both screens, one rule';
});

check('several photographs that are not a letter are each logged', () => {
  const fn = chat.slice(chat.indexOf('async function readFromGallery('), chat.indexOf('async function handleReadDocument('));
  assert.ok(/for \(const page of pages\.slice\(1\)\)/.test(fn), 'only the first of several photographs is logged');
  assert.ok(/await handleClassified\(more\)/.test(fn), 'the rest are classified and then dropped');
  return 'one log each';
});

check('there is one copy of what happens to a classified photo', () => {
  // Two copies would be two answers to "did that save", which is the class of
  // bug this app spent the week on.
  const copies = chat.match(/setSaveToast\(\{ summary: 'Saved from your photo'/g) ?? [];
  assert.strictEqual(copies.length, 1, `${copies.length} copies of the photo-save confirmation`);
  assert.ok(/async function handleClassified\(result: ImageLogResult\)/.test(chat), 'the shared handler is gone');
  return 'handleClassified';
});

check('and this check can fail', () => {
  // THE OLD CHAT PATH: the gallery went through pickImage, one at a time, and
  // a document went to the tray whatever the source.
  const old = `
      const picked = await pickImage(source);
      const result = await classifyAndLog(picked.image);
      if (result.status === 'document') {
        setDocumentPages((pages) => [...pages, { ... }]);
        return;
      }`;
  assert.ok(!/readFromGallery/.test(old), 'the old path reads as fixed');
  assert.ok(/setDocumentPages/.test(old) && !/readPages/.test(old), 'the old path reads as reading the letter');
  // And the old handover, which carried pages and nothing else.
  const oldHandoff = 'export function handOverDocument(pages: DocumentPage[]): void {';
  assert.ok(!/readNow/.test(oldHandoff), 'the old handover reads as carrying the intent');
  return 'the old path asks, as she said it did';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
