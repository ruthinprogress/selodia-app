// NO UPLOAD CEILING IS SET ABOVE THE LIMIT THAT WILL ACTUALLY STOP IT.
//
//   node scripts/check-an-upload-fits-the-platform.mjs
//
// WHY THIS EXISTS. Ruth, 23 October 2026: "the chat is failing on images
// again". Two images had reached this app's database in its entire history, and
// the most recent was a SCREENSHOT.
//
// A Vercel serverless function REJECTS ANY REQUEST BODY OVER 4.5MB before the
// handler runs. The phone's ceiling was 8MB and the classify route's was 8MB,
// each pointing at the other for justification, and both above a number neither
// could do anything about. So every photo between 4.5MB and 8MB was refused at
// the edge: no log on the server, nothing readable on the phone, and the only
// images that ever worked were the small ones that got under by accident.
//
// A CEILING ABOVE THE REAL LIMIT IS NOT A CEILING. It is a number that makes
// everybody feel the case is handled while the platform quietly does the
// refusing, badly, somewhere nobody is looking.
//
// WHAT THIS CHECKS, and it is deliberately arithmetic rather than opinion:
//
//   1. Every upload ceiling in the app is strictly under the platform limit.
//   2. The CLIENT's ceiling is at or below the SERVER's, so the phone refuses
//      first - with a sentence a person can read - instead of letting the
//      request go and be killed in transit.
//   3. The phone still resizes before sending. The ceilings only matter when
//      something goes wrong; the resize is what makes an ordinary photo small
//      enough that they never come up.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

// https://vercel.com/docs/functions/runtimes#request-body-size - 4.5MB, and it
// is not configurable on any plan this project could be on.
const PLATFORM_LIMIT = 4.5 * 1024 * 1024;

const read = (p) => readFileSync(p, 'utf8').split('\r\n').join('\n');

/** The value of a `const NAME = <n> * 1024 * 1024;` declaration, in bytes. */
function megabyteConst(src, name) {
  const m = src.match(new RegExp(`const\\s+${name}\\s*=\\s*([\\d.]+)\\s*\\*\\s*1024\\s*\\*\\s*1024`));
  return m ? Number(m[1]) * 1024 * 1024 : null;
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)}MB`;

let pass = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    pass += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

// file, const name, and which side of the wire it is on.
const CEILINGS = [
  ['mobile/src/lib/image-logging.ts', 'MAX_BASE64_BYTES', 'client'],
  ['mobile/src/lib/document-pages.ts', 'MAX_ONE_BYTES', 'client'],
  ['mobile/src/lib/document-pages.ts', 'MAX_TOTAL_BYTES', 'client'],
  ['app/api/classify-image/route.ts', 'MAX_BYTES', 'server'],
  ['app/api/parse-document/route.ts', 'MAX_ONE', 'server'],
  ['app/api/parse-document/route.ts', 'MAX_TOTAL', 'server'],
  ['app/api/transcribe/route.ts', 'MAX_BYTES', 'server'],
];

const found = [];
for (const [file, name, side] of CEILINGS) {
  check(`${file} declares ${name}`, () => {
    const value = megabyteConst(read(file), name);
    assert.ok(
      value !== null,
      `${name} is not in ${file} as a "n * 1024 * 1024" constant - this check is anchored on it`
    );
    found.push({ file, name, side, value });
  });
}

for (const c of found) {
  check(`${c.name} in ${c.file} is under the platform limit`, () => {
    assert.ok(
      c.value < PLATFORM_LIMIT,
      `${c.name} is ${mb(c.value)}, at or above the ${mb(PLATFORM_LIMIT)} a Vercel function `
        + 'will accept. Anything between the two is refused at the edge, with no server log '
        + 'and nothing readable on the phone. That is the fault that made photos not work.'
    );
  });
}

check('the phone refuses before the server does', () => {
  const client = found.find((c) => c.name === 'MAX_BASE64_BYTES');
  const server = found.find((c) => c.file.includes('classify-image'));
  assert.ok(client && server, 'both image ceilings are needed for this comparison');
  assert.ok(
    client.value <= server.value,
    `the phone allows ${mb(client.value)} and the classify route allows ${mb(server.value)}, `
      + 'so an image can leave the phone that the server will reject. The phone should refuse '
      + 'first, because it is the end that can say something useful to the person holding it.'
  );
});

check('the phone shrinks a photo before sending it', () => {
  const src = read('mobile/src/lib/image-logging.ts');
  assert.match(
    src,
    /const MAX_EDGE\s*=\s*\d+/,
    'MAX_EDGE is gone, so nothing is bounding the pixel dimensions being sent'
  );
  assert.match(
    src,
    /ImageManipulator\.manipulate\(/,
    'the resize is gone - the ceilings alone only produce a refusal, not a working photo'
  );
  assert.match(
    src,
    /saveAsync\(/,
    'nothing is re-encoding the resized image, so the resize cannot reach the request'
  );
});

check('the picker is not asked for the original as base64', () => {
  const src = read('mobile/src/lib/image-logging.ts');
  const at = src.indexOf('ImagePicker.ImagePickerOptions');
  assert.ok(at > 0, 'the picker options block was not found');
  const block = src.slice(at, at + 400);
  assert.match(
    block,
    /base64:\s*false/,
    'the picker is encoding the ORIGINAL image, which is the multi-megabyte thing being '
      + 'avoided, and it is then encoded again after the resize'
  );
});

// -- every case above must be able to fail ---------------------------------

const useless = [];
function mustFail(name, fn) {
  try {
    fn();
    useless.push(name);
  } catch {
    /* threw, which is the point */
  }
}

mustFail('a ceiling over the limit is caught', () =>
  assert.ok(8 * 1024 * 1024 < PLATFORM_LIMIT)
);
mustFail('client above server is caught', () => {
  const client = 8 * 1024 * 1024;
  const server = 4 * 1024 * 1024;
  assert.ok(client <= server);
});
mustFail('a missing resize is caught', () =>
  assert.match('no manipulator here', /ImageManipulator\.manipulate\(/)
);
mustFail('a missing constant is caught', () =>
  assert.ok(megabyteConst('const OTHER = 1 * 1024 * 1024;', 'MAX_BYTES') !== null)
);

for (const f of failures) console.log(`  FAIL  ${f}`);
for (const u of useless) console.log(`  USELESS  "${u}" passed with its premise inverted`);

console.log('');
console.log(`  platform limit  ${mb(PLATFORM_LIMIT)} (Vercel request body, not configurable)`);
for (const c of found) {
  console.log(`  ${c.side.padEnd(6)} ${mb(c.value).padStart(7)}  ${c.name} in ${c.file}`);
}
console.log('');

const total = pass + failures.length;
console.log(`${pass}/${total} passed, ${failures.length} failed, ${useless.length} useless`);
process.exit(failures.length + useless.length > 0 ? 1 : 0);
