// What Selodia is allowed to point at (Part Six, build item 23 — Tier A).
//
// THIS LIST IS THE CODE-LEVEL VERSION OF "NEVER INVENT A CONTROL". The prompt
// rule in app-structure.ts asks the model not to fabricate a screen; this list
// makes fabrication impossible to act on. A navigationTarget that is not exactly
// one of these ids is DROPPED, silently, and the reply still goes out as plain
// words. A wrong pointer is worse than no pointer: someone follows a glowing
// circle to a control that is not there and concludes they are the problem.
//
// UPDATED 2026-09-03 for the navigation rewrite. The Body tab was one screen
// holding four views behind a row of segment buttons; it is now a stack whose
// landing screen carries three tappable headings. The four `body.*` segment
// buttons no longer exist, so `body.overview` is gone entirely (Overview is the
// screen now, not a button on it) and the other three point at the headings.
//
// TAB ICONS ARE DELIBERATELY ABSENT, and no id here names one. NativeTabs
// renders a real UITabBarController / BottomNavigationView with no ref, no
// onLayout and no frame API in JS, so the icons cannot be measured and an
// in-screen overlay cannot draw over them. See SELODIA_SPEC.md, Part Six, KNOWN
// PLATFORM CONSTRAINT. For a cross-tab question Selodia explains in words, which
// is what it already does well — it does not get a made-up button to pulse
// instead.
//
// MAINTENANCE: this is the server half of a two-package pair. The client half is
// mobile/src/lib/spotlight.ts, which maps each id to the element that carries it.
// Ids that exist here but not there simply never fire (the client drops what it
// cannot find, which is the correct failure direction). Ids that exist there but
// not here can never be requested. Keep them in step, and when a screen changes,
// update app-structure.ts in the same pass — a target pointing at a moved
// control is the same failure as a description of a screen that no longer exists.

// The description is written for the MODEL, not the person: it says what the
// element is so the model can decide whether it answers the question asked.
export const SPOTLIGHT_TARGETS = {
  'chat.settings': 'the Settings link at the top of Chat',
  'chat.add': 'the "+" button beside the message box, which offers a photo or a file',
  'chat.composer': 'the message box itself, where they type to you',
  'body.food': 'the "Food" heading on the Body tab, which opens the food detail',
  'body.measurements': 'the "Body" heading on the Body tab, which opens the measurement detail',
  'body.activity': 'the "Activity" heading on the Body tab, which opens the activity detail',
  'overview.stats': 'the weight and muscle figures under the "Body" heading',
  'overview.calories': "today's calorie figure under the \"Food\" heading",
  'overview.protein': "today's protein figure under the \"Food\" heading",
  'overview.water': 'the drink total and the quick-tap beside it, at the foot of the Body tab',
  'food.entries': "today's food entries, where tapping one opens its breakdown",
  'measurements.week': 'the week stepper on Measurements, for moving between weeks',
  'measurements.export': 'the link to your data at the foot of Measurements',
  'almanac.categories': 'the Almanac entries grouped by category - the default Almanac view',
  'almanac.entries': 'the entries inside an opened Almanac category',
  'settings.export': 'the data export in Settings, "Prepare my data"',
  'settings.delete': 'the delete-my-account control in Settings',
} as const;

export type SpotlightTargetId = keyof typeof SPOTLIGHT_TARGETS;

export function isSpotlightTarget(v: unknown): v is SpotlightTargetId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(SPOTLIGHT_TARGETS, v);
}

// Appended to the system prompt. Kept separate from APP_STRUCTURE_PROMPT_BLOCK
// so the description of the app and the list of pointable things cannot drift
// into one another - the app block is what Selodia KNOWS, this is what it can DO.
export const SPOTLIGHT_PROMPT_BLOCK = `

SHOWING SOMEONE WHERE SOMETHING IS. When a question is genuinely about finding something in the app - "where do I...", "how do I get to...", "I can't find...", "I'm lost" - you may set navigationTarget to one of the ids below, and the app will dim the screen and pulse that element so they can see it. Set it ALONGSIDE your reply, never instead of one: the words still have to answer the question on their own, because the person may not be on the screen that holds it.
${Object.entries(SPOTLIGHT_TARGETS)
  .map(([id, description]) => `- ${id} - ${description}`)
  .join('\n')}

Rules for it. Use the id EXACTLY as written; anything else is discarded and nothing is shown. Only set it when someone is actually looking for something - never to decorate an ordinary answer, never to give a tour, and never twice in a row for the same thing. Do not mention the highlight in your words ("see it flashing", "tap the glowing one") - they may be somewhere else in the app, or looking away, and a reply that depends on an animation reads as broken when the animation is not there. Say where the thing is in plain words as though nothing were being highlighted at all.

There is no id for the three tabs themselves, and that is deliberate - do not try to invent one. When what someone needs is on a different tab, just tell them which tab it is on and what to tap once they are there.`;
