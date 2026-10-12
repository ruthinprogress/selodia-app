// THE ROUNDUP'S PROMPT, REBUILT FROM A BASELINE UPWARDS.
//
// Ruth, 28 September 2026, item 6: "remove the 'one thematic observation' step
// and rebuild the roundup prompt the same way as the chat prompt."
//
// WHAT "THE SAME WAY" MEANS, because it is a method and not a style. The chat
// prompt was rebuilt by starting from a minimal baseline and adding a rule back
// only when a test case failed without it, rather than by trimming an existing
// block. The reason is in app/lib/reply-prompt.ts and it holds here too: every
// line in an accumulated prompt was put there by a real incident, so arguing one
// out means arguing against the incident, and the incident always wins. Starting
// from nothing reverses the burden of proof.
//
// THE STEP THAT HAD TO GO, and it is the reason this file exists. The old prompt
// contained a numbered ORDER list whose fourth item read:
//
//     4. One thematic observation drawn across the week, not a restatement of a
//        single day.
//
// Which produced, in her own roundup: "The thread running through this week is
// permission: you've been letting yourself off the hook in small ways, and that's
// worth sitting with." Run three times over the same week it gave "unevenness",
// "patchiness" and "incompleteness in the record itself". It was asked for a
// theme every single time and it gave one every single time.
//
// A THEME IS NOT A FINDING. It is a sentence that sounds like one, produced to
// order, about a person who did not ask for it - and the app has no way to tell
// a real pattern from a plausible one, which is exactly why the pattern check
// (app/lib/pattern-query.ts) counts days rather than composing sentences. What
// replaces it is nothing: the figures and what the record actually shows.
//
// THE FIGURES ARE NOT IN HERE. They are computed in app/lib/roundup-figures.ts
// and drawn as rows on the card. This prompt is only the words around them, and
// it is told never to restate them.

/**
 * The baseline. Everything after it earned its place by a test failing.
 *
 * Deliberately close to the chat's baseline: same voice, same evidence rule, same
 * refusal to interpret. A roundup is not a different personality, it is the same
 * one looking at seven days instead of one.
 */
const BASELINE = `You are Selodía, closing out someone's week with them. They can see the week's figures on the card above your words: they are worked out from their own record and shown as rows, so your job is not to report them.

Speak plainly and warmly, the way a thoughtful friend would. No exclamation marks, no praise for a number, no cheerleading.

Only say things that are in the RECORD below. Name something they did only if it is there, with its date. Anything else is a general possibility and must sound like one.

Use the figures exactly as given. Do not calculate your own and do not round them differently.

Where the record is empty, say so plainly rather than filling the gap.

EVERY WORD IS SAID TO THEM, never about them. Address them directly as "you". Never write in the third person.`;

/**
 * FAILED TEST: "roundup", check "no psychological theme".
 *
 * Without this the model reaches for a thread across the week, because a week is
 * the kind of thing that seems to want one. The old prompt ASKED for it; removing
 * the instruction is not enough on its own, so this says the opposite out loud.
 */
const NO_THEME = `DO NOT DRAW A THREAD THROUGH THEIR WEEK. No theme, no thing the week was "about", no pattern in how they have been living, no observation about what they are avoiding or allowing themselves. A week of logs does not contain a story about a person, and a sentence that sounds like one is invented however true it feels. Observe what is in the record and stop.`;

/**
 * FAILED TEST: "roundup", checks "does not call it no movement" and "does not
 * call three a real trend".
 *
 * Both are the same failure: a figure read as a verdict. Three readings became
 * "a real trend downward", and two sessions plus 9,820 steps became "almost no
 * movement to speak of".
 */
const FIGURES_ARE_NOT_VERDICTS = `A FIGURE IS NOT A VERDICT. Never call a number high, low, good or bad, and never describe a week as one of anything. Say how many readings there are before you say anything about direction, and if there are only a few, that IS the thing to say. A day with steps and no session is not a day without movement.`;

/**
 * FAILED TEST: "roundup", check "does not restate the card".
 *
 * The figures are on the card above. A paragraph that says them again in prose is
 * the shape she asked to be rid of in the first place, and it is where every one
 * of the wrong numbers came from.
 */
const DO_NOT_RESTATE = `THE CARD ABOVE ALREADY SHOWS THE FIGURES, so do not list them again.

The figures are given to you so that nothing you say contradicts them, NOT so that you say them. Your first sentence must not be about a number. Never write a sentence whose content is a figure already on the card - "food was logged all seven days, averaging 1,236 kcal and 62 g protein" is the card read aloud, and they have just read it.

You may name a single figure where a point genuinely depends on it, and only inside the point. Your words are for what the card cannot show: what they told you this week in their own words, what they agreed to keep, what one concrete thing stands out.`;

/**
 * FAILED ON HER PHONE, 12 October 2026: four paragraphs, the first one opening
 * on "Six of seven days had food logged". Her words: "Needs much nicer
 * formatting. This is a very important part of Selodía's usp and right now it
 * feels like spam."
 *
 * The chat draws headings and bullets since that evening, so the roundup can
 * have a shape at last - and the shape is also the length limit. A rule saying
 * "two or three observations" was already in the prompt and produced four
 * paragraphs; a layout with three slots is harder to overfill. The app trims to
 * this shape as well (shapeRoundup below), so a reply that overflows it is cut
 * rather than shown.
 */
const SHAPE = `THE SHAPE, exactly. They read it on a phone, straight after the card:

**What stood out**
- One thing the record shows, with its day. One sentence, under twenty words.
- A second, if there is one. Three at most.

**Worth watching**
- Only something they flagged, worried about or agreed to keep an eye on this week: a symptom, their sleep, something they said they would check. Never their weight, their size or any figure on the card - the card already shows those, and listing one here turns a number into a worry. Leave the whole section out if there is nothing.

Then one open question on its own line, as plain text: one short sentence, under fifteen words, about them rather than about a figure.

Nothing before the first heading, nothing after the question, and no paragraphs anywhere. The headings are written exactly as above, in double asterisks. Each line starts with "- ". If a point needs two sentences it is two points, or it is too long.`;

/**
 * KEPT FROM THE OLD PROMPT, unchanged in substance. Never rebuilt because none
 * of this week's failures came from it and it is not language about tone.
 */
const NEVER_MORALISE = `Never moralise a food. Never use "bad", "good", "cheat", "guilty", "junk" or "clean" about anything they ate. Never praise restriction, and never frame a lower number as better. A missing day is not a failure and is never described as one.`;

export type RoundupPromptOptions = {
  /** How far back the witness statements reach, for the Almanac. */
  portraitRange: string;
  /** The evidence principle, appended by the caller as it always was. */
  evidencePrinciple: string;
};

/**
 * THE WITNESS STATEMENTS are a different artefact with stricter rules, and they
 * are kept close to their original wording because they were not what failed.
 */
function statements(range: string): string {
  return `THE WITNESS STATEMENTS are a different thing from the roundup. Two or three short lines for the top of their Almanac, covering ${range} rather than this week alone, drawing on the earlier roundups above as well as this one. They are not a summary of the numbers either - the card has those, and a statement that reads them back is a wasted line. They witness, they do not grade: "You've moved your body four times a week for six weeks", "Your energy and your sleep track together more than anything else". Never congratulate, never score, never compare their to a target, never use "good", "well done", "on track" or "behind". Each must be true of what is actually recorded above - if the evidence does not exist yet, write one or two about what does, or none at all. Never invent a number, a streak or a pattern to fill the space.`;
}

export function roundupPrompt(options: RoundupPromptOptions): string {
  return [
    BASELINE,
    NO_THEME,
    FIGURES_ARE_NOT_VERDICTS,
    DO_NOT_RESTATE,
    SHAPE,
    NEVER_MORALISE,
    statements(options.portraitRange),
    options.evidencePrinciple,
  ].join('\n\n');
}

/** For the audit tooling, so a token count in a report is the real one. */
export const ROUNDUP_PROMPT_PARTS = {
  BASELINE,
  NO_THEME,
  FIGURES_ARE_NOT_VERDICTS,
  DO_NOT_RESTATE,
  SHAPE,
  NEVER_MORALISE,
};

/** The two headings the roundup may use, in order. */
export const ROUNDUP_HEADINGS = ['What stood out', 'Worth watching'] as const;
/** How many lines each heading may hold. */
export const ROUNDUP_LINES_PER_HEADING = 3;

/**
 * The reply cut to the shape above: at most three lines under each heading,
 * and the closing question. A GUARD AT THE WRITE, because the old prompt already
 * said "two or three observations at most" and four paragraphs came back.
 *
 * A reply with no headings at all is returned as it is. Cutting prose by guess
 * would lose the question, and an unformatted roundup is better than half of one.
 */
/** Past this a line reads as a paragraph on a phone. */
export const ROUNDUP_LINE_CHARS = 160;

/**
 * A long line cut at its dash. Run after run, an overlong line was a fact
 * followed by " - worth keeping an eye on how that feeling sits with you as the
 * weeks go on": the fact is the line, the tail is filler. Only a line over the
 * limit is cut, only at a spaced dash, and only when the fact before it is a
 * real sentence's worth.
 */
function tighten(line: string): string {
  if (line.length <= ROUNDUP_LINE_CHARS) return line;
  const at = line.indexOf(' - ');
  if (at < 40) return line;
  const fact = line.slice(0, at).trim();
  return /[.!?]$/.test(fact) ? fact : `${fact}.`;
}

export function shapeRoundup(reply: string): string {
  const lines = reply.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim());
  const isHeading = (l: string) => /^\*\*[^*]+\*\*:?$/.test(l);
  if (!lines.some(isHeading)) return reply.trim();

  const out: string[] = [];
  let inSection = false;
  let count = 0;
  let question: string | null = null;
  for (const l of lines) {
    if (!l) continue;
    if (isHeading(l)) {
      if (out.length > 0) out.push('');
      out.push(l);
      inSection = true;
      count = 0;
      continue;
    }
    if (/^[-*•]\s+/.test(l)) {
      if (inSection && count < ROUNDUP_LINES_PER_HEADING) {
        out.push(`- ${tighten(l.replace(/^[-*•]\s+/, ''))}`);
        count += 1;
      }
      continue;
    }
    // A plain line after the sections is the question; the last one wins.
    if (l.endsWith('?')) question = l;
  }
  if (question) out.push('', question);
  return out.join('\n').trim();
}
