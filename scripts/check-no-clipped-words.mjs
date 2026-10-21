// SHORT WORDS DO NOT GET CUT.
//
//   node scripts/check-no-clipped-words.mjs
//
// "Wee". "Mont". "Build a". "across the six". "this". Four years of this app's
// history in five clipped words, and every one of them was a label with plenty
// of room on the screen beside it.
//
// THE CAUSE IS ALWAYS THE SAME and it is not a shortage of space. Android
// measures a short run of text, the measurement comes back smaller than the
// text needs, and whatever the layout does next turns that bad number into
// something visible: with `numberOfLines={1}` it becomes an ellipsis, and
// without it the parent clips the overflow with nothing to show for it.
//
// THE FIRST THREE FIXES TUNED THE MEASUREMENT - remove alignItems, add
// flexShrink: 0, set textBreakStrategy - and each held until it did not.
// segmented-tabs.tsx and report-link.tsx both carry write-ups of their own
// earlier fix, which is how you know the earlier fix did not hold.
//
// SO THIS CHECK DOES NOT TUNE ANYTHING. It bans the single-line cap on the
// labels that have actually been cut. Without a cap, a bad measurement can only
// wrap - which shows every word, and is a safe failure rather than a wrong one.
// A long title that genuinely needs an ellipsis is a different thing and is not
// covered here.

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

const read = (p) => fs.readFileSync(p, 'utf8');

/** Source with its comments removed, so a check cannot match its own prose. */
const withoutComments = (src) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('\n  NO SHORT LABEL IS CAPPED TO ONE LINE\n');

check('BUILD A REPORT CANNOT BECOME "Build a rep..."', () => {
  // COMMENTS STRIPPED FIRST. The first version of this check matched the word
  // "numberOfLines" inside the comment explaining why it is gone, and matched
  // accessibilityLabel={label} rather than the label itself. A check that reads
  // prose is reading the wrong thing.
  const src = withoutComments(read('mobile/src/components/report-link.tsx'));
  const at = src.indexOf('style={styles.label}');
  assert.ok(at > -1, 'the label element moved - this check is testing nothing');
  const el = src.lastIndexOf('<ThemedText', at);
  const close = src.indexOf('>', at);
  assert.ok(
    !/numberOfLines=/.test(src.slice(el, close)),
    'the report link caps its label to one line again, so a short measurement becomes an ellipsis'
  );
  return 'no cap on the label';
});

check('AND WEEK AND MONTH CANNOT BECOME "We..." AND "Mon..."', () => {
  const src = withoutComments(read('mobile/src/components/balance-flower-section.tsx'));
  const at = src.indexOf("{m === 'days7' ? '7 days' : '30 days'}");
  assert.ok(at > -1, 'the mode labels moved - this check is testing nothing');
  const el = src.lastIndexOf('<ThemedText', at);
  assert.ok(
    !/numberOfLines=/.test(src.slice(el, at)),
    'the Week/Month labels are capped to one line again'
  );
  // The number-tuning from the previous attempt stays - it is not wrong, it
  // was just not sufficient on its own.
  assert.ok(/modeLabel: \{ flexShrink: 0/.test(src), 'the earlier flexShrink fix was removed');
  // The labels got shorter on 20 October when the window went rolling - "7
  // days" and "30 days" rather than "Week" and "Month" - which retires the
  // clipping for good. Kept checked anyway: shorter is not the same as safe,
  // and the cap is what did the damage.
  return 'no cap, and the earlier fix kept';
});

check('AND A TAB LABEL IS NOT CLIPPED AT ITS OWN MEASUREMENT', () => {
  // THE FOURTH REPORT OF THIS CONTROL, 20 October 2026. Her screenshot had
  // "Sessions" as "Session", "Rules" as "Rule" and "Week" as "Wee" - one
  // letter each, from three words of different lengths - with "Skills" whole.
  //
  // One glyph lost regardless of length is Android dropping the glyph that
  // falls partly outside the box, so the fix is not a wider word but a wider
  // BOX: the label fills the tab and centres inside it, rather than being laid
  // out at its own mismeasured width. alignItems: 'center' on the tab is the
  // exact line that caused it, so that is what is banned.
  const src = withoutComments(read('mobile/src/components/segmented-tabs.tsx'));
  const at = src.indexOf('tab: {');
  assert.ok(at > -1, 'the tab style moved - this check is testing nothing');
  const tab = src.slice(at, src.indexOf(`
  },`, at));
  assert.ok(
    !/alignItems:\s*'center'/.test(tab),
    "the tab centres its label again, so the label is clipped at its own measured width rather than the tab's"
  );
  assert.ok(/alignItems:\s*'stretch'/.test(tab), 'the label no longer fills the tab');
  // Stretching only helps if the text is still centred in the space it gained.
  const label = src.slice(src.indexOf('label: {'), src.length);
  assert.ok(/textAlign:\s*'center'/.test(label), 'the label is stretched but no longer centred');
  // AND NOTHING CONSTRAINS IT. Any of these turns a bad measurement back into
  // a visible cut, which is what the first three attempts kept rediscovering.
  assert.ok(!/numberOfLines=/.test(src), 'the tab labels are capped to one line again');
  assert.ok(!/adjustsFontSizeToFit/.test(src), 'the labels auto-size again, which mismeasures them');
  assert.ok(!/overflow:\s*'hidden'/.test(src), 'the track clips again');
  return 'the tab is the boundary, not the font';
});

check('A FOLD SUMMARY IS NOT DRAWN WHILE THE FOLD IS OPEN', () => {
  // Ruth crossed it out on her screenshot: "Top right header not needed at
  // all". On Balance it repeated the pager two lines below it, which said
  // "this week" in full while this one had been clipped to "this".
  //
  // MATCHED ON THE GUARD, NOT ON THE EXACT TERNARY. This looked for the literal
  // `{open ? null : (` and broke on 21 October when a second condition joined
  // it for the Now artwork - `{open || hideSummary ? null : (` - which does the
  // same thing and more. What matters is that `open` is one of the reasons the
  // summary is not drawn, never how the expression happens to read.
  const src = read('mobile/src/components/fold-section.tsx');
  // ANCHORED ON THE DRAWN ELEMENT. `{summary}` alone also matches the
  // `${summary}` inside the accessibility label, which is a different thing
  // entirely and is supposed to be there whatever the fold is doing.
  const at = src.indexOf('style={styles.summary}');
  assert.ok(at > -1, 'the summary is no longer drawn at all');
  const guard = src.slice(Math.max(0, at - 200), at);
  assert.ok(/\?\s*null\s*:/.test(guard), 'the summary is no longer guarded by a condition at all');
  assert.ok(/\bopen\b/.test(guard), 'the summary is drawn even when the fold is open');
  return 'shut only';
});

check('AND NO INVISIBLE CHARACTERS GOT INTO THESE FILES', () => {
  // A zero-width space went into fold-section.tsx while this very fix was
  // being written, inside a comment about text rendering. It survives a
  // typecheck, a lint and a review by eye.
  const files = [
    'mobile/src/components/fold-section.tsx',
    'mobile/src/components/report-link.tsx',
    'mobile/src/components/balance-flower-section.tsx',
    'mobile/src/components/segmented-tabs.tsx',
  ];
  for (const f of files) {
    const src = read(f);
    for (const [name, ch] of [
      ['zero-width space', '​'],
      ['zero-width non-joiner', '‌'],
      ['zero-width joiner', '‍'],
      ['byte order mark', '﻿'],
      ['backspace', '\u0008'],
    ]) {
      assert.ok(!src.includes(ch), `${f} contains a ${name}`);
    }
  }
  return `${files.length} files, five characters each`;
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
