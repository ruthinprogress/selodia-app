# What the flower explainer has to say

Ruth's own instructions, 20 October 2026, for the collapsible "what this shows"
that goes inside the flower section. Written down rather than carried in a
conversation, because the explainer is being built one step after the window
change and the notes would otherwise live only in a chat scroll.

## Her words

> "Part of the explanation may need to remind the user that some activity may
> not be counted unless it's been logged, and some of daily life like pushing a
> loaded pram up a hill or running up and down tube escalators might be adding
> to the full picture."

> "They're welcome to log it and if it's regular, maybe it can be added to the
> shape of their week."

> "It's hard to remember to do everything or remember what covers what. It's
> also actually encouraging to see that a lot of activities fill up the
> requirements naturally."

## What that means for the text

**The drawing is of what was LOGGED, not of what was done.** This is the honesty
note and it has to be there. Somebody looking at a thin flower should know
whether they had a quiet week or a quiet logging week, and the app cannot tell
the difference. Saying so costs nothing and stops the drawing being read as a
verdict.

**Ordinary life counts, and most of it never gets logged.** Her examples, and
they should be used rather than tidied into "incidental activity": a loaded pram
up a hill, running up and down tube escalators. These are real bone loading and
real cardio and nobody thinks of them as exercise.

**The way in is the Week, not guilt.** If something like that is regular, it can
go in the Week as a card - which is also the route by which it starts counting.
That makes the note actionable rather than a disclaimer, and it connects the two
screens, which is the gap she spotted: "we have a Week Planner, and it doesnt
connect to the Health Flower at all."

**Lead with the reassurance, not the method.** Her sentence is better than
anything written for the purpose: an ordinary life fills more of this than
people expect. Ballet alone reaches four petals. The explainer opens there and
explains the method underneath, rather than opening with arithmetic.

## What it must NOT do

**Do not print the weighting table.** SELODIA_SPEC.md's methodology note is
explicit: the weightings are "evidence-based calibrated estimates, not values
extracted directly from research papers... the starting point for expert review,
not the output of it. Specific weightings should not be cited in marketing
materials until the expert review has been completed and published." An in-app
explainer saying "running is 75% bone loading" is exactly that citation.

**Do not quote the target number.** `WEEKLY_TARGET` is 200 and its own comment
says it is "a choice, not a measurement" that "will want tuning once there is a
real week of data to look at". Say roughly two strong sessions fill a dimension;
a number in prose rots the moment it is tuned.

**Say the weightings are estimates awaiting expert review.** Ruth's call, and
she took it: it is the honest status, and for an app aimed at women who have
been fobbed off, saying "our best estimates, not settled science" is trust
rather than weakness.

## Where the content comes from

The six definitions are in SELODIA_SPEC.md, Part Eight, "The six health
dimensions" - a table of Dimension / Colour / Definition, each with a numbered
citation. `app/lib/activity-weights.ts` is already GENERATED from the weighting
table four lines below it, specifically so the two cannot drift.

The explainer's six names and definitions should be generated from that same
table, with a check asserting they match. An explainer is the longest label in
the app, and this week has been one long lesson in labels that stopped matching
the code.

## One drift already there

The spec calls the fifth dimension **"Bone loading"**. The app's petal says
**"Bone"**. Keep "Bone" on the petal, where there is no room, and use "Bone
loading" in the explainer - with both tracing to the one row rather than being
typed twice.
