// A BUG CAN BE REPORTED FROM WHERE IT HAPPENED.
//
//   node scripts/check-bug-report.mjs
//
// Ruth, 18 October 2026: "I think while its in Beta there should be a quick tap
// way for users to report. Tap on icon takes screenshot automatically of where
// they are which is stored with their notes and saved to the bug list which
// needs reviewing daily at this stage."
//
// WHAT SHIPPED AND WHAT DID NOT, because the cut should be checkable and not
// just remembered. The automatic capture needs react-native-view-shot, a native
// module that cannot ship over the air - it waits for the next store build. The
// button, the sheet, the picture and the daily list went out the ordinary way.
//
// The thing most likely to rot here is the privacy posture, because it is three
// separate facts held in three files and none of them fails loudly.

import assert from 'node:assert';
import fs from 'node:fs';

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

const lib = fs.readFileSync('mobile/src/lib/report-bug.ts', 'utf8');
const sheet = fs.readFileSync('mobile/src/components/report-sheet.tsx', 'utf8');
const header = fs.readFileSync('mobile/src/components/settings-link.tsx', 'utf8');
const settingsForm = fs.readFileSync('mobile/src/app/settings/feedback.tsx', 'utf8');
const list = fs.readFileSync('scripts/bug-list.mjs', 'utf8');
const pkg = JSON.parse(fs.readFileSync('mobile/package.json', 'utf8'));

console.log('\n  REPORTING SOMETHING WRONG\n');

check('THE BUTTON IS ON EVERY SCREEN, AND ONLY DURING THE BETA', () => {
  assert.ok(/ReportSheet/.test(header), 'the header cannot open a report');
  assert.ok(/betaStatus\(\)/.test(header), 'the button is not gated on beta membership');
  assert.ok(/useState\(false\)/.test(header), 'it does not fail closed while membership is unknown');
  assert.ok(/\{inBeta \? \(/.test(header), 'it is drawn whether or not she is in the beta');
  // Positioned from the same screen edge as the seeds, which is the whole
  // argument of the long note in that file about four offsets on four screens.
  assert.ok(
    /right: PageInset\.horizontal \+ MARK_SIZE/.test(header),
    'the report mark is positioned independently of the seeds, so they will drift apart'
  );
  return 'beside the seeds, beta only, fails closed';
});

check('AND THE REPORT SAYS WHICH SCREEN IT CAME FROM', () => {
  // THE FIELD THE BUTTON EXISTS FOR, and the first two reports through it both
  // arrived empty. reportBug falls back to lastScreen(), which is only ever
  // written by the More mark - so the beetle, which does not go through More,
  // recorded nothing at all. The argument for putting it on every screen was
  // that the screen name is often the only usable clue in a stranger's report.
  //
  // It never needed the fallback: the sheet opens on top of the screen in
  // question, so the current route is the right answer and the simplest one.
  assert.ok(/from\?: string \| null;/.test(sheet), 'the sheet cannot be told where it opened');
  assert.ok(/screen: from/.test(sheet), 'it knows where it opened and does not send it');
  assert.ok(
    /<ReportSheet from=\{pathname\}/.test(header),
    'the header does not hand the sheet the route it is on'
  );
  return 'the current route, not a remembered one';
});

check('ONE SEND PATH, NOT TWO INSERTS INTO ONE TABLE', () => {
  // The settings form built its own insert field by field. A second copy in the
  // sheet is how one of them quietly stops collecting something, and the fields
  // exist because a report without them is unfixable.
  assert.ok(/reportBug\(/.test(settingsForm), 'the settings form writes its own insert again');
  assert.ok(
    !/from\('feedback_reports'\)\s*\.insert/.test(settingsForm),
    'the settings form inserts directly, so the two paths can diverge'
  );
  const inserts = (lib.match(/from\('feedback_reports'\)/g) ?? []).length;
  assert.strictEqual(inserts, 1, 'there is more than one place that writes a report');
  return 'both doors call reportBug';
});

check('A LOST PICTURE NEVER COSTS THE REPORT', () => {
  // Somebody who has just written out a problem must never be told the whole
  // thing failed because an image did not upload. They wrote the useful part.
  const at = lib.indexOf('export async function reportBug');
  const body = lib.slice(at);
  const uploadAt = body.indexOf('uploadReportScreenshot');
  const insertAt = body.indexOf("from('feedback_reports')");
  assert.ok(uploadAt > -1 && insertAt > uploadAt, 'the row is written before the picture is tried');
  assert.ok(/screenshotLost = screenshotPath === null/.test(lib), 'a lost picture is not noticed');
  assert.ok(
    !/if \(screenshotLost\) return/.test(lib),
    'a failed upload now aborts the report, which loses what they wrote'
  );
  assert.ok(/did not upload, though everything else did/.test(sheet), 'and she is not told');
  return 'row written either way, loss reported';
});

check('THE PICTURE STAYS PRIVATE, AND THE PAGE GOES STALE', () => {
  // A screenshot of this app is a picture of somebody's health record. Three
  // facts in three files, none of which fails loudly on its own.
  assert.ok(/from\('beta-feedback'\)/.test(lib), 'the private bucket is not used');
  assert.ok(
    /\$\{userId\}\//.test(lib),
    'the path no longer starts with the user id, which is what the bucket policy checks'
  );
  assert.ok(
    !/getPublicUrl/.test(lib) && !/getPublicUrl/.test(list),
    'a public URL is minted for a picture of somebody health record'
  );
  assert.ok(/createSignedUrl/.test(list), 'the review page does not sign its image URLs');
  assert.ok(
    /SIGNED_URL_SECONDS = 3600/.test(list),
    'the signed URLs no longer expire within the hour'
  );
  return 'private bucket, user-id path, signed and short-lived';
});

check('and the review page carries no key', () => {
  // It is written to a temp file and opened in a browser. A key in it would be
  // a credential sitting in %TEMP% for anything on the machine to read.
  const at = list.indexOf('const page = `<!doctype html>');
  const page = list.slice(at, list.indexOf('const out ='));
  assert.ok(!/SERVICE_ROLE|supabaseKey|\$\{key\}/.test(page), 'the page embeds a key');
  assert.ok(/service key, because RLS/i.test(list), 'why a service key is needed is not written down');
  return 'key stays in the script';
});

check('AND THE AUTOMATIC CAPTURE IS STILL HONESTLY UNBUILT', () => {
  // The cut, made checkable. If view-shot is ever added, this fails and names
  // the comments that promise the picture is only offered - so the day somebody
  // makes capture possible, the copy saying otherwise is found rather than left.
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const hasCapture = Boolean(deps['react-native-view-shot']);
  if (hasCapture) {
    assert.fail(
      'react-native-view-shot is installed - the sheet still says the picture is offered rather than taken, so update report-sheet.tsx and report-bug.ts'
    );
  }
  assert.ok(
    /offered, not taken|OFFERED, NOT TAKEN/i.test(sheet),
    'the sheet no longer says why the picture is attached rather than captured'
  );
  assert.ok(/Add a picture/.test(sheet), 'there is no way to attach one at all');
  return 'offered, and the reason is written down';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
