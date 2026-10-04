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

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
