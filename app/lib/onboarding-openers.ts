// The line each onboarding phase opens with (build item 49).
//
// THIS IS A MIRROR of the OPENING_LINE constant in each screen under
// mobile/src/app/onboarding/. It is duplicated across the Next/Expo boundary
// for the same reason body-metrics.ts and cycle.ts are, and it is kept honest
// by a parity test rather than by discipline.
//
// WHY THE SERVER NEEDS THESE AT ALL. Each screen rendered its opener purely on
// the client - never persisted, never sent - so the model received the person's
// ANSWER with no visible QUESTION. On 2026-08-23 that produced a real failure:
// asked "what does a normal week look like for you?", the reply "Just yoga and
// a run" reached the model directly after a turn about what she had eaten
// today, and was read as a log of today's activity rather than her weekly
// pattern. She had to correct it and re-explain. Given the context the model
// actually had, that reading was the reasonable one.
//
// Persisting the opener - rather than quoting it into each phase prompt, which
// only INTRO_ROLE ever did, and which the other five all forgot - also makes
// the stored transcript honest. It previously omitted messages the person
// demonstrably saw, which matters for anything that reads chat history back.

export const PHASE_OPENERS: Record<string, string> = {
  "intro": "Hi, I'm Unflump. What brings you here today?",
  "equipment": "Now, the first step is just getting a little visibility on your body \u2014 that's what makes the numbers mean something later on. To start: do you have bioimpedance scales? The kind that read body fat and muscle, not just weight.",
  "goals": "Let's talk about what you're hoping to get out of this \u2014 how are you feeling about things right now?",
  "technical_targets": "There are a couple of ways to keep an eye on body fat. Bioimpedance scales \u2014 the kind that read body composition \u2014 give a useful estimate, and they're most valuable as a trend: any single reading has a fairly wide margin (roughly \u00b13\u20135% next to a DEXA scan), so what it's doing over weeks matters far more than any one number. Waist measurement is another simple, meaningful marker. If there's a particular area you'd like to keep an eye on, we can note that too.",
  "nutrition_targets": "Now that I understand where you're headed, we can work out a daily protein target that fits you \u2014 it's one of the most useful numbers to have on hand. Want to do that now?",
  "activity_tdee": "Last thing for now \u2014 I'd love a feel for how you move in a typical week. Nothing structured, just what your days actually look like. What does a normal week look like for you?",
};
