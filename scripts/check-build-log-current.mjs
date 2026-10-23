// EVERY DAY THAT HAS COMMITS HAS A BUILD LOG ENTRY - checked on every run, not
// only during a close-out.
//
//   node scripts/check-build-log-current.mjs
//
// WHY THIS EXISTS, AND WHY IT IS HERE RATHER THAN IN closeout_check.py.
//
// On 23 October 2026 Ruth asked why the closing ceremony was not happening and
// what exactly was missing. The answer was 16, 17 and 18 October: thirty-seven
// commits across three days with no paragraph written about any of them. The
// git pushes were all sent and the workbook had every day, so nothing was lost
// except the account of it - which is the part only a person can write and the
// part nobody can reconstruct later.
//
// WORKFLOW.md diagnosed this in September, after Session 54 lost twenty-four
// commits the same way: "the ceremony's steps are automated, its trigger is
// not." That sentence was written down, and then the same thing happened again
// in October, because a diagnosis in a document does not run. This is the
// trigger. check-all.mjs runs many times a day, so a missed day goes red within
// hours instead of surviving a week.
//
// WHAT THE OLD CHECK GOT WRONG, kept here because it is the more interesting
// half. closeout_check.py computes its gaps from the session NUMBERS in the
// build log: every integer between the lowest and highest that is not present.
// On 22 October it reported [75, 76, 77, 78, 79, 81] and FOUR OF THOSE SIX WERE
// WRONG. 76 and 77 are in the workbook and were real sessions; 81 is in the log,
// inside a "Session 80-81" header the parser reads as 80; 75, 78 and 79 appear
// never to have existed at all, because the numbering drifted and nothing says
// it may not. It was testing a numbering convention - a wording - instead of the
// thing anybody actually cares about, which is whether a day of work got
// written down. Four false alarms and two real ones is how a check teaches
// people to scroll past it.
//
// SO THIS COUNTS DAYS, NOT NUMBERS. A day with commits is a day that happened.
// If its date is not covered by a build log entry, that is a real gap, it names
// itself, and writing the entry clears it. Session numbers are not consulted.
//
// THREE DELIBERATE EXEMPTIONS, so it does not cry wolf:
//   - TODAY is never counted. The close-out comes at the end of the day; a day
//     being unlogged while it is still being worked is the normal state, and a
//     check that is red every afternoon is a check nobody reads.
//   - Anything BEFORE the log's own earliest entry is not counted. The log
//     starts where it starts.
//   - AN OVERNIGHT ENTRY COVERS THE MORNING AFTER IT. WORKFLOW.md's own rule is
//     that a run crossing midnight belongs to the session that started it, so
//     Session 58 is headed 28 September and its commits land on the 29th. The
//     first version of this check called that a missing day. It is not missing;
//     it is written down under the date the work began, exactly as the rule
//     says it should be. An entry whose header says "overnight" therefore
//     covers the following day as well.
//
// IF THE H: DRIVE IS NOT THERE it skips and says so, the same way
// check-live-deployment.mjs skips rather than guessing. A check that fails
// because a drive is unmounted is reporting on the drive, not on the work.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// BUILD_LOG_DOCX exists so this check can be pointed at a doctored copy and
// proved to fail. A check nobody has watched fail is a check nobody knows works
// - see "a test must be able to fail" in DECISION_PATTERNS.md. It is not a
// configuration knob; normal runs read the real log.
const SPECS = path.join('H:', 'My Drive', 'Selodia App Project Master Folder', 'Build Specs');
const LOG = process.env.BUILD_LOG_DOCX || path.join(SPECS, 'Selodia-Build-Log.docx');
const WORKBOOK = process.env.CLOSEOUT_XLSX
  || path.join(SPECS, 'Selodia-Session-Closeouts.xlsx');

// A .docx is a zip. Reading the one entry we need directly costs about forty
// lines and no dependency, which is cheaper than adding one to the whole repo
// for a single file.
function unzipEntry(buf, wanted) {
  // The end-of-central-directory record is at the tail, after a comment of
  // unknown length, so scan backwards for its signature.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let i = 0; i < count; i += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(p + 10);
    const compressed = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    if (name === wanted) {
      // The local header repeats the name and extra field with its OWN lengths,
      // which are not always the central directory's. Read them from there.
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(start, start + compressed);
      return method === 0 ? raw : zlib.inflateRawSync(raw);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function iso(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Headers look like "Session 82 · 22 October 2026 · Laptop, home · all day".
// A session that ran over two days writes "20-21 October 2026", and BOTH days
// are covered by it - which is the case the number-based check could not see.
function datesInHeader(line) {
  const out = [];
  const re = /(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s+([A-Za-z]+)\s+(\d{4})/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const month = MONTHS[m[3].toLowerCase()];
    if (month === undefined) continue;
    const year = Number(m[4]);
    const first = Number(m[1]);
    const last = m[2] ? Number(m[2]) : first;
    for (let d = first; d <= last; d += 1) out.push(iso(year, month, d));
  }
  return out;
}

function fail(msg) {
  console.log(msg);
  process.exit(1);
}

if (!fs.existsSync(LOG)) {
  console.log('SKIPPED  the build log is not reachable (no H: drive on this machine).');
  console.log(`         ${LOG}`);
  process.exit(0);
}

const xml = unzipEntry(fs.readFileSync(LOG), 'word/document.xml');
if (!xml) fail(`FAILED   could not read word/document.xml out of ${LOG}`);

// Paragraph by paragraph, because a header's text is split across runs.
const paragraphs = String(xml)
  .split(/<w:p[ >]/)
  .map((p) => (p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [])
    .map((t) => t.replace(/<[^>]+>/g, ''))
    .join(''));

function nextDay(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return iso(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
}

const logged = new Set();
let headers = 0;
let overnight = 0;
for (const p of paragraphs) {
  if (!/^\s*Session\s+\d/.test(p)) continue;
  headers += 1;
  const days = datesInHeader(p);
  for (const d of days) logged.add(d);
  // See the third exemption above. The morning after an overnight run belongs
  // to the entry that started it.
  if (/overnight/i.test(p) && days.length) {
    overnight += 1;
    logged.add(nextDay(days[days.length - 1]));
  }
}

if (headers === 0) fail('FAILED   no "Session N ..." headers found in the build log.');

const earliest = [...logged].sort()[0];
const today = new Date();
const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate());

// --all would drag in dates from branches that were never the project's days of
// work. The first-parent history of the branch in hand is what "a day of work"
// means here.
const commitDays = new Set(
  execFileSync('git', ['log', '--format=%ad', '--date=short'], { encoding: 'utf8' })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean),
);

// THE WORKBOOK IS THE SESSION REGISTER, AND IT IS THE ONE TO CHECK AGAINST.
//
// Its rows are written by a script at every close-out and it has never drifted;
// the build log is written by hand and has, three times now. Checking the
// hand-written record against the script-written one is the whole point, and it
// is the same discipline as generating the macro columns from one list instead
// of typing them out in nine places.
//
// Every session in the workbook must have a build log entry covering its dates.
// That is the failing condition, and it is exact: no commit counting, no
// heuristic about what size of day deserves writing up. It also catches the
// drift the other way, a session closed out in the workbook and never written.
//
// Its cells read "S77: 17-18Oct26", and a session that ran over two days names
// both, exactly like the build log headers.
const WB_MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function workbookSessions() {
  if (!fs.existsSync(WORKBOOK)) return null;
  const buf = fs.readFileSync(WORKBOOK);
  const out = new Map();
  // Each sheet is its own entry in the zip, and the labels are on the first.
  for (const sheet of ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) {
    const xmlSheet = unzipEntry(buf, sheet);
    if (!xmlSheet) continue;
    const re = /(S[\d-]+):\s*(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?([A-Za-z]{3})(\d{2})/g;
    let m;
    while ((m = re.exec(String(xmlSheet))) !== null) {
      const month = WB_MONTHS[m[4].toLowerCase()];
      if (month === undefined) continue;
      const year = 2000 + Number(m[5]);
      const first = Number(m[2]);
      const last = m[3] ? Number(m[3]) : first;
      const days = [];
      for (let d = first; d <= last; d += 1) days.push(iso(year, month, d));
      out.set(m[1], days);
    }
  }
  return out;
}

const sessions = workbookSessions();

function commitsOn(d) {
  return execFileSync(
    'git',
    ['log', '--format=%h', '--date=short', `--since=${d} 00:00`, `--until=${d} 23:59`],
    { encoding: 'utf8' },
  ).split('\n').filter(Boolean).length;
}

// A day with commits and no session in the register at all. Not a failure: no
// ceremony was ever owed for it, because no session was opened. Printed anyway,
// because a run of these would mean the register itself had started slipping.
const registered = new Set();
if (sessions) for (const days of sessions.values()) for (const d of days) registered.add(d);

const strays = [...commitDays]
  .filter((d) => d >= earliest && d < todayIso && !logged.has(d) && !registered.has(d))
  .sort();

console.log(`  build log   ${headers} session headers, ${logged.size} days covered, from ${earliest}`);
console.log(`              ${overnight} of them overnight, each also covering the morning after`);
console.log(`  git         ${commitDays.size} days with commits`);
console.log(`  today       ${todayIso} (never counted - the close-out comes at the end of it)`);

if (sessions === null) {
  console.log('\n  SKIPPED  the close-out workbook is not reachable, so there is no register');
  console.log('           to check the build log against.');
  process.exit(0);
}

const uncovered = [...sessions.entries()]
  .filter(([, days]) => days.some((d) => d < todayIso) && !days.every((d) => logged.has(d)))
  .sort((a, b) => a[1][0].localeCompare(b[1][0]));

// The build log opens at Session 36. Sessions 34 and 35 are in the register and
// were never written up, and never will be: the log did not exist yet. That is
// the "the log starts where it starts" exemption, and it is printed rather than
// hidden so the boundary stays a stated fact instead of a silent one.
const beforeLog = uncovered.filter(([, days]) => days.every((d) => d < earliest));
const unwritten = uncovered.filter(([, days]) => days.some((d) => d >= earliest));

console.log(`  workbook    ${sessions.size} sessions in the register`);

if (beforeLog.length) {
  console.log(`\n  BEFORE THE LOG  ${beforeLog.length} session(s) predating its first entry (${earliest}),`);
  console.log('                  so no entry was ever owed for them.');
  for (const [label, days] of beforeLog) console.log(`                    ${label} ${days.join(', ')}`);
}

if (strays.length) {
  console.log(`\n  NO SESSION  ${strays.length} day(s) with commits that the workbook never`);
  console.log('              registered as a session, so no close-out was owed for them.');
  console.log('              Shown so a run of these cannot pass unnoticed.');
  for (const d of strays) {
    console.log(`                ${d}   ${commitsOn(d)} commit${commitsOn(d) === 1 ? '' : 's'}`);
  }
}

if (unwritten.length === 0) {
  console.log('\n  PASSED  every session in the workbook has a build log entry.');
  process.exit(0);
}

console.log(`\n  FAILED  ${unwritten.length} session(s) closed out in the workbook with no`);
console.log('          build log entry covering them:\n');
for (const [label, days] of unwritten) {
  const missingDays = days.filter((d) => !logged.has(d));
  const n = missingDays.reduce((t, d) => t + commitsOn(d), 0);
  console.log(`    ${label.padEnd(9)} ${missingDays.join(', ')}   ${n} commit${n === 1 ? '' : 's'}, nothing written`);
}
console.log('\n  Write them: python scripts/build_log_append.py <entry.txt> --before <N>');
console.log('  An entry reconstructed afterwards must say so in its own text.');
process.exit(1);
