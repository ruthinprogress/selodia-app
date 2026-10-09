// DOES "ASK ABOUT THIS" ACTUALLY ASK?
//
//   node scripts/check-ask-about-this.mjs
//
// Ruth, 4 October 2026: "Many screens say 'ask about this' and they are meant to
// create a card in chat so chat refers to it and begins the conversation. This
// doesn't work anywhere."
//
// TWO FAULTS, AND THE SECOND IS WHY IT WAS *ANYWHERE*.
//
// 1. THE SEND WAS GATED ON HAVING AN ENTRY TO TAG.
//
//        if (askNow === '1' && tag) setAutoAsk(...)
//
//    Three of the five callers have no entry: "Change goal" and both "add
//    something to my week" buttons open a conversation about nothing in
//    particular. Their text was dropped into the composer and left there, which
//    is precisely the behaviour a button called "Ask about this" was renamed to
//    stop doing on 16 September. handleSend's tag argument has always been
//    optional; the tag says WHICH entry, and was never a reason to withhold the
//    message.
//
// 2. THE GUARD WAS KEYED ON THE PREFILL TEXT, which is identical every time a
//    given button is pressed. So the first tap worked and every tap after it in
//    the same session did nothing at all - not even filling the box - because
//    `prefill !== lastPrefill` was false and the whole block was skipped. A
//    guard written to stop a re-render re-sending was also stopping her asking
//    twice, which is the "doesn't work anywhere" part: anything she tried more
//    than once was dead on the second go.
//
// The sender now supplies a nonce. That is the only thing that distinguishes one
// navigation from a second render of the same one, so it cannot be derived in
// the receiver - which is exactly why this check exists: a new button that
// forgets it inherits the old bug silently.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const CHAT = 'mobile/src/app/(tabs)/index.tsx';

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

// Every file under mobile/src, so a button added anywhere is covered.
function sources(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...sources(p));
    else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

const files = sources('mobile/src');
// COMMENTS ARE NOT CODE, AND THIS CHECK COULD NOT TELL. The fix below carries a
// note quoting the condition it replaced - `askNow === '1' && tag` - and the
// first run of this check failed on its own explanation. The file most likely to
// describe a bug is the one that just fixed it. Same lesson as
// check-setup-destroys-nothing.mjs, which hit this on the same class of note.
const strip = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const chat = strip(readFileSync(CHAT, 'utf8'));

console.log('\n  A BUTTON THAT SAYS IT ASKS, ASKS\n');

// ---- 1. every caller supplies a nonce ------------------------------------
check('every button that auto-sends carries a nonce', () => {
  const offenders = [];
  for (const file of files) {
    if (path.resolve(file) === path.resolve(CHAT)) continue;
    const src = strip(readFileSync(file, 'utf8'));
    let at = src.indexOf("askNow:");
    while (at >= 0) {
      // The params object this askNow belongs to: back to the opening brace,
      // forward to the closing one, which is enough to see its siblings.
      const start = src.lastIndexOf('params:', at);
      const end = src.indexOf('});', at);
      const block = src.slice(start < 0 ? Math.max(0, at - 400) : start, end < 0 ? at + 400 : end);
      // Only the ones that actually send. `askNow: ''` is the correction path.
      if (/askNow:\s*(?:'1'|mode === 'ask' \? '1' : '')/.test(block) && !block.includes('askNonce')) {
        offenders.push(`${file} (around "${src.slice(at, at + 24).replace(/\s+/g, ' ')}")`);
      }
      at = src.indexOf('askNow:', at + 1);
    }
  }
  ok(
    offenders.length === 0,
    offenders.join('\n          ') +
      '\n          Without a nonce the chat screen cannot tell a second tap from a ' +
      're-render, so the button works once per session and then silently stops.'
  );
  return `${files.length} files scanned, every sender carries one`;
});

// ---- 2. the receiver no longer requires a tag ----------------------------
check('a question with nothing to anchor it is still sent', () => {
  ok(
    !/askNow === '1' && tag/.test(chat),
    'the send is still gated on there being an entry to tag, so "Change goal" and ' +
      '"add something to my week" drop their text in the box and stop'
  );
  ok(
    /if \(askNow === '1'\) setAutoAsk\(/.test(chat),
    'the auto-send condition has changed shape - check it still fires without a tag'
  );
  return 'the tag is carried when there is one, never required';
});

// ---- 3. the guard keys on the navigation, not the words ------------------
check('the same button works twice', () => {
  ok(
    /const askKey =/.test(chat) && /askKey !== lastPrefill/.test(chat),
    'the block is still keyed on the prefill text, so pressing a button a second ' +
      'time in one session does nothing at all'
  );
  ok(
    /sentAskRef\.current === autoAsk\.key/.test(chat),
    'the send guard is still keyed on the text rather than the navigation'
  );
  return 'keyed on the nonce';
});

// ---- 4. a tag still travels when there is one ----------------------------
check('an entry still tags its conversation', () => {
  // The whole point of the mechanic: a card in the thread naming what is being
  // discussed. Dropping the requirement must not drop the feature.
  ok(
    /setAutoAsk\(\{ key: askKey, text: prefill, tag \}\)/.test(chat),
    'the tag is no longer passed to the send at all, so the entry card will not render'
  );
  ok(
    /handleSend\(autoAsk\.text, autoAsk\.tag \?\? undefined\)/.test(chat),
    'the tag is not handed to handleSend with the text - the race that left the ' +
      'card off her turn while the request carried the tag'
  );
  return 'carried with the text, in one call';
});

// ---- 5. a correction remembers which entry it is correcting ---------------
check('tapping "change or ask about this" keeps the entry, and shows it', () => {
  // 7 OCTOBER 2026, 09:11. The one mode that exists only to talk about a
  // particular entry was the one mode that forgot which entry it was. Ruth
  // tapped through from TUESDAY's chicken sandwich, got no card, typed the
  // sandwich out fresh, and it logged to WEDNESDAY as a brand new meal.
  //
  // The tag was dropped on arrival whenever the tap did not auto-send, which is
  // every correction, because a correction is a half-sentence SHE has to finish
  // and must never be sent for her.
  ok(
    /setPendingTag\(tag\);/.test(chat),
    'a correction still throws its tag away, so the turn cannot know which entry she meant'
  );
  ok(
    !/setPendingTag\(askNow === .1. \? tag : null\)/.test(chat),
    'the old auto-send-only condition is still there'
  );
  // VISIBLE, OR IT IS THE 7 SEPTEMBER TRAP AGAIN. What made a kept tag dangerous
  // was never that it was unsent. It was that she could not see it or detach it.
  ok(
    /setAnchor\(\{ id: tag\.entryId, name: tag\.seed\?\.title \?\? null \}\)/.test(chat),
    'the card is not drawn on arrival, so the kept tag is invisible - which is the trap, not the fix'
  );
  return 'kept, and named above the box before she types';
});

check('closing the card drops the tag as well as the card', () => {
  // Otherwise she detaches the thing she can see and her next message is still
  // filed against the entry underneath it.
  const closeAt = chat.indexOf('setCloseNext(true);');
  ok(closeAt > 0, 'the Close handler has moved');
  const handler = chat.slice(closeAt, closeAt + 600);
  ok(/setAnchor\(null\)/.test(handler), 'Close no longer clears the card');
  ok(/setPendingTag\(null\)/.test(handler), 'Close clears the card but leaves the tag attached');
  return 'closed means closed';
});

// ---- 7. a button is a sender or a named stem, never silently neither -----
//
// WHY THIS EXISTS AND THE SIX ABOVE WERE NOT ENOUGH (9 October 2026). Ruth,
// five days after the 4 October fix, in the same words: "absolutely nowhere is
// the 'Ask about this or change this' button working correctly... This was
// built, but it is not happening, which means noone can use it to fix things,
// ask or edit." All six checks above passed while she said it.
//
// They passed because every one of them starts from `askNow` - they verify that
// the buttons which SEND do it correctly. day-log.tsx did not send, so it was
// not a sender, so it was exempt from all of them. It carried `prefill` alone,
// which meant it opened Chat, left half a sentence in the composer and stopped,
// and on a second tap did not even do that. It sits behind the Log's food,
// movement and measurement history - nearly every day card she taps. A check
// that only examines the things already doing it right cannot find the thing
// not doing it at all.
//
// So this one starts from the other end: EVERY navigation into chat carrying a
// prefill. Each must be one of two things on purpose. A sender, or a stem named
// in the list below with a reason. Something that is neither is the bug, and a
// new button cannot be born into it quietly - it fails here until somebody
// decides which it is.
const DELIBERATE_STEMS = {
  'log/cycle.tsx': 'My period started - she finishes it with when.',
  'log/index.tsx': "I've noticed  - the whole point is what she noticed.",
  'settings/almanac.tsx': 'Update an Almanac entry - ends in an ellipsis she completes.',
  'body-manual.tsx': 'A measurement she is about to type a number into.',
};

check('every chat navigation either sends or is a named stem', () => {
  const unclassified = [];
  for (const file of files) {
    if (path.resolve(file) === path.resolve(CHAT)) continue;
    const src = strip(readFileSync(file, 'utf8'));
    let at = src.indexOf('prefill:');
    while (at >= 0) {
      const end = src.indexOf('});', at);
      const block = src.slice(at, end < 0 ? at + 500 : end);
      const sends = /askNow:/.test(block);
      const named = Object.keys(DELIBERATE_STEMS).some((k) => file.replace(/\\/g, '/').endsWith(k));
      if (!sends && !named) {
        unclassified.push(`${file}: ${src.slice(at, at + 70).replace(/\s+/g, ' ')}`);
      }
      at = src.indexOf('prefill:', at + 1);
    }
  }
  ok(
    unclassified.length === 0,
    unclassified.join('\n          ') +
      '\n          Each of these opens chat with text and no askNow, so it fills the ' +
      'composer and stops.\n          Either give it askNow + askNonce, or add it to ' +
      'DELIBERATE_STEMS with the reason it is a half-sentence she finishes.'
  );
  return `${Object.keys(DELIBERATE_STEMS).length} named stems, every other prefill sends`;
});

check('and that check can fail', () => {
  // The assertion is that a list came back empty, and an empty list is also
  // what a scan that finds nothing returns. So: prove it sees prefills at all,
  // and prove an unclassified one would be caught.
  const withPrefill = files.filter(
    (f) => path.resolve(f) !== path.resolve(CHAT) && strip(readFileSync(f, 'utf8')).includes('prefill:')
  );
  ok(withPrefill.length >= 6, `only ${withPrefill.length} files with a prefill found - the scan is blind`);
  // The real day-log line as it was until this morning, which all six checks
  // above passed over.
  const wasBroken = "router.push({ pathname: '/', params: { prefill: subject(day.date) } });";
  ok(!/askNow:/.test(wasBroken), 'the regression case is not actually a non-sender');
  ok(
    !Object.keys(DELIBERATE_STEMS).some((k) => 'mobile/src/components/day-log.tsx'.endsWith(k)),
    'day-log is on the stem list, which would exempt the bug this check exists for'
  );
  return `${withPrefill.length} files carry a prefill, and the old day-log line would fail`;
});

// ---- 8. a tag the receiver cannot read is not a tag ----------------------
check('every discussType passed is one the chat screen can read', () => {
  // 'me' was passed from the Me tab from 7 October and matched neither branch
  // in index.tsx, so the tag was dropped on arrival and never reached a turn.
  // The union lives in three places that have to agree; this checks the two in
  // the repo. Known and deliberate exceptions are listed, so the gap is a
  // decision rather than a silence.
  const KNOWN_UNREADABLE = { 'me-protocol.tsx': "'me' has no card that can draw a Me row yet" };
  const readable = ['food', 'activity', 'measurement', 'plan'];
  const offenders = [];
  for (const file of files) {
    if (path.resolve(file) === path.resolve(CHAT)) continue;
    const src = strip(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(/discussType:\s*'([a-z]+)'/g)) {
      if (readable.includes(m[1])) continue;
      if (Object.keys(KNOWN_UNREADABLE).some((k) => file.replace(/\\/g, '/').endsWith(k))) continue;
      offenders.push(`${file}: discussType '${m[1]}' is not one of ${readable.join(', ')}`);
    }
  }
  ok(offenders.length === 0, offenders.join('\n          '));
  // And the receiver really does only read those four.
  ok(/entryType === 'food'/.test(chat), 'the food branch has moved');
  ok(
    /entryType === 'activity'/.test(chat) && /entryType === 'plan'/.test(chat),
    'the non-food branch has moved'
  );
  return `4 readable types, ${Object.keys(KNOWN_UNREADABLE).length} known gap`;
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
