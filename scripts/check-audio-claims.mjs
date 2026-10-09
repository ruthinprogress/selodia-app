// DOES ANYTHING STILL TELL HER THE AUDIO IS NOT KEPT?
//
//   node scripts/check-audio-claims.mjs
//
// Ruth, 1 October 2026, 21:30: "The Voice logging sheet, opened from the chat box
// on Ruth's phone at 9:15pm, still says 'The audio isn't kept.' Your report says
// that sentence was fixed."
//
// IT HAD BEEN FIXED - in one file. I corrected the privacy policy, wrote a report
// saying the claim was gone, and left the app's own copy of the sentence standing
// in voice-consent-sheet.tsx until a later pass. By the time she read it on her
// phone the claim existed in exactly one place, which is the one place a person
// decides whether to speak to the app at all.
//
// THE REAL FAULT IS NOT THE MISSED FILE. It is that "is this claim gone?" was
// answered by remembering which files I had edited. That is not a method. This
// is: every string a person can read is searched, every time, and the answer is a
// pass or a fail rather than a recollection.
//
// WHAT COUNTS AS A CLAIM. Any user-facing text saying audio, voice or a recording
// is not kept, not retained, not stored, deleted, discarded or temporary.
// ElevenLabs delete audio and transcripts after 30 days, since 9 October 2026,
// when reading the agent's own privacy block before the first store uploads
// showed retention_days: -1 - not the published three-year default, but
// forever. Ruth chose 30 days and it was set and read back the same day.
// Zero Retention Mode
// is not on this plan, so every one of those is false.
//
// WHAT IS DELIBERATELY ALLOWED. "Selodía does not keep the audio" is true - the
// app does not - but it is only safe NEXT TO the retention sentence, so the check
// requires the pair rather than banning the half. And a comment is not copy: a
// file explaining the bug is the file most likely to quote it.

import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['mobile/src', 'app'];
const EXT = new Set(['.tsx', '.ts']);

/** Every source file under the roots. */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.expo') continue;
      walk(full, out);
    } else if (EXT.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

/** Comments are not copy. A note describing the bug must not trip the check. */
function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

// The subject words, and the claims. Both have to be in the same sentence.
const SUBJECT = /\b(audio|voice|recording|recordings|what you say)\b/i;
const CLAIM =
  /\b(is ?n[o']?t kept|are ?n[o']?t kept|not kept|never kept|is ?n[o']?t retained|not retained|never retained|is ?n[o']?t stored|not stored|never stored|is deleted|are deleted|deleted straight|discarded|only temporar|not saved)\b/i;

// "Selodía does not keep the audio" is TRUE and allowed, but only beside the
// retention sentence. Checked separately below.
const OURS_ONLY = /selod[ií]a (does not|doesn[o']?t) keep/i;
const RETENTION_NEARBY = /after 30 days|30 days after/i;

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
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

const files = ROOTS.filter((r) => fs.existsSync(r)).flatMap((r) => walk(r));

console.log('\n  NOTHING TELLS HER THE AUDIO IS NOT KEPT\n');

check('no screen claims audio is not kept, retained or stored', () => {
  const offenders = [];
  for (const f of files) {
    const code = codeOnly(fs.readFileSync(f, 'utf8'));
    for (const sentence of code.split(/(?<=[.!?])\s+|\n/)) {
      if (!SUBJECT.test(sentence) || !CLAIM.test(sentence)) continue;
      // The allowed half, when its partner is in the same file.
      if (OURS_ONLY.test(sentence) && RETENTION_NEARBY.test(code)) continue;
      offenders.push(`${f}: ${sentence.trim().slice(0, 90)}`);
    }
  }
  ok(
    offenders.length === 0,
    `\n          ${offenders.join('\n          ')}\n          ` +
      'ElevenLabs keep audio and transcripts for UP TO 3 YEARS and Zero Retention ' +
      'Mode is not on this plan, so every one of these is false.'
  );
  return `${files.length} files`;
});

check('the shared paragraph states BOTH retention facts', () => {
  // TWO FACTS, AND NEITHER COVERS THE OTHER (9 October 2026).
  //
  // retention_days governs the conversation transcript and audio, and is set to
  // 30 days. Their privacy policy separately caps data they GENERATE ABOUT A
  // VOICE at 3 years. The sentence published from 1 October stated only the
  // second and presented it as the first, while the first was actually set to
  // indefinite; the replacement written this afternoon stated only the first
  // and dropped the cap. Both were wrong, in opposite directions, and both read
  // perfectly well.
  //
  // So this asserts both numbers. Dropping either is now a failing build rather
  // than a tidy-up, which is the only thing that has ever stopped this sentence
  // rotting.
  const src = fs.readFileSync('mobile/src/lib/processor-wording.ts', 'utf8');
  const said = codeOnly(src);
  ok(/after 30 days/i.test(said), 'processor-wording.ts no longer states the 30-day deletion');
  ok(/3 years/i.test(said), "processor-wording.ts no longer states their 3-year cap on voice-derived data");
  ok(
    /ElevenLabs/.test(src) && /Anthropic/.test(src),
    'both processors must be named - their DPA requires the people whose voices these are to be told'
  );
  return 'names both, states 30 days and the 3-year cap';
});

check('the screens use the shared paragraph rather than their own copy', () => {
  // Four copies of a sentence is four chances for one to rot, which is exactly
  // what happened tonight.
  for (const f of [
    'mobile/src/app/onboarding/consent.tsx',
    'mobile/src/components/voice-consent-sheet.tsx',
  ]) {
    const src = fs.readFileSync(f, 'utf8');
    ok(/PROCESSOR_WORDING/.test(src), `${f} has stopped using the shared paragraph`);
  }
  return 'consent screen and voice sheet';
});

check('the privacy policy states the retention period too', () => {
  // It cannot import the constant - different workspace - so it is held to the
  // same fact rather than the same string.
  const src = fs.readFileSync('app/privacy/page.tsx', 'utf8');
  const said = codeOnly(src);
  ok(/after 30 days/i.test(said), 'the policy no longer states the 30-day deletion');
  ok(/3 years/i.test(said), 'the policy no longer states their 3-year cap on voice-derived data');
  return 'states 30 days and the 3-year cap';
});

check('and these checks can fail', () => {
  // Every assertion above is "this string is present", and presence passes on
  // any file that happens to contain the words. So prove the opposite case is
  // detectable: a paragraph with one fact and not the other - which is exactly
  // what was published on 1 October, and again this afternoon - must not pass.
  const onlyCap =
    'ElevenLabs keeps the audio and the transcript for up to 3 years.';
  const onlyThirty = 'ElevenLabs delete the audio and the transcript after 30 days.';
  ok(!/after 30 days/i.test(onlyCap), 'the 1 October sentence is not being detected as incomplete');
  ok(!/3 years/i.test(onlyThirty), "this afternoon's sentence is not being detected as incomplete");
  // And the live paragraph really does carry both, rather than passing by luck
  // on a comment.
  const live = codeOnly(fs.readFileSync('mobile/src/lib/processor-wording.ts', 'utf8'));
  ok(/after 30 days/i.test(live) && /3 years/i.test(live), 'the live paragraph is missing a fact');
  return 'each one-sided version is caught, and the live one carries both';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
