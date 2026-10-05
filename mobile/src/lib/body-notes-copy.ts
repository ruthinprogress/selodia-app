// ANYTHING ELSE ABOUT YOUR BODY: HER FINAL TEXT (Ruth, 5 October 2026).
//
// Pasted as a screen deck headed "6 of 7" before the reorder and rendering as
// 7 of 7 now; the number comes from the chain. "The copy was for that screen,
// whatever the new number it is, apply it."
//
// WHAT HER WORDING CHANGES, beyond the words. Three things worth naming:
//
// 1. THE HEADING IS A QUESTION NOW. "A little about your body" was a label on
//    the most personal screen in setup. "Anything else about your body?" can be
//    answered with nothing, which is what the screen has always allowed and
//    never said.
//
// 2. HER PERIODS NOTE IS ALWAYS SHOWN. "No periods doesn't necessarily mean
//    you're no longer cycling. Selodía won't assume anything from this alone."
//    The screen only said that after she picked the ninth option, so the woman
//    who was about to pick the wrong one never read it. It is the rule the app
//    actually follows - see stageForReasoning in lib/life-stage.ts, which
//    returns null rather than a menopause status - and it belongs where the
//    choice is made.
//
// 3. THE MEDICAL DISCLAIMER CAME OFF THIS SCREEN AND WENT STRAIGHT BACK ON.
//    Her deck replaced "Selodía is not a medical service and does not replace
//    advice from your doctor" with her own closing line, I flagged it as the one
//    removal worth a second look, and she said "re-add medication line" (6
//    October 2026). So the box carries both: her line about her words being kept
//    as she writes them, and the one sentence about what Selodía is not.
//
//    IT IS NOT BOILERPLATE AND THAT IS WHY IT CAME BACK. This box is the only
//    input in setup that takes drug names and the first place anybody types one.
//    The same sentence is on the Body Manual's "What you take regularly" row and
//    in the privacy policy, and the Medications rule in the chat prompt says it
//    to the model.
//
// THE CHIPS ARE NOT IN HER DECK AND ARE NOT CHANGED BY IT. Her Periods line
// names five ("Regular · Irregular · Perimenopause · Menopause · No periods")
// where the screen offers nine, and her Hormones line names four ("HRT · The
// pill · Coil · None") where the screen offers four different ones. Collapsing
// either list is a change to what is STORED and read, not to wording:
//
//   - the ninth period option is the one SHE added on 28 September, for the
//     woman with a coil or a hysterectomy with the ovaries kept, and it opens a
//     second question;
//   - "Prefer not to say" is on both lists and this is the screen it exists for;
//   - surgical, induced and early menopause are three different facts that her
//     single "Menopause" would merge;
//   - a coil may be copper, which is not hormonal at all, so "Coil" as its own
//     chip beside "The pill" would record a hormone that is not there.
//
// So the wording is applied and the options stand, and the difference is hers to
// settle rather than mine to guess at.
//
// THIS FILE IS THE RECORD: copied into scripts/mode-matrix.json by the generator
// and compared both ways by check-body-notes-copy.mjs.
//
// NO EM DASHES. Her standing rule.

export const BODY_NOTES_SCREEN = {
  question: 'Anything else about your body?',
  subtitle:
    'Completely optional. It simply helps Selodía make a little more sense of what you log.',

  periodsHeading: 'Periods',
  periodsQuestion: 'Which feels closest?',
  /** Shown under the chips, always. See point 2 above. */
  periodsNote:
    "No periods doesn't necessarily mean you're no longer cycling. Selodía won't assume anything from this alone.",

  hormonesHeading: 'Hormones',
  hormonesQuestion: 'Are any of these part of your life?',
  hormonesNote: 'These simply help Selodía interpret what you log.',

  takesHeading: 'Anything you take regularly?',
  takesLabel: 'Medication or supplements.',
  takesPlaceholder: 'In your own words...',
  /** What is already kept, so a redo shows it rather than looking empty. */
  takesAlreadyLabel: 'Already kept:',

  closing: 'Kept exactly as you write it, and you can change it at any time.',
  /**
   * BACK AT HER ASK (6 October 2026), as its own line rather than folded into
   * hers: her sentence is about her words and this one is about what Selodía is
   * not, and running them together would make one sentence do two jobs.
   */
  medicalLine:
    'Selodía is not a medical service and does not replace advice from your doctor.',

  /**
   * The second question, which only exists where a woman has no periods for a
   * reason that is not menopause. Her deck does not reach it, because her deck
   * does not carry the option that opens it - see the chip note above.
   */
  reasonQuestion: 'Which of these is closest?',
} as const;
