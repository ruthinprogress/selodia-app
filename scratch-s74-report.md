# Session 74 — the prompt gets measured

*15 October 2026*

## The short version

The app's instructions had never been measured. Now they have been, and the
deciding call reads **117,910 characters** before your message: a 75,000-character
system prompt plus a 42,878-character tool description that is not even part of
it. One block, GENERAL_CONDUCT, is 68% of the prompt and holds **59 separate
instructions** that have built up since August.

Three cuts were made and all three were proved harmless. The third one turned up
a live bug rather than fat, and it is the finding of the day.

## What broke, and what was fixed

**Replies arriving as a wall of text.** Your words: *"I almost put the app away
and give up to avoid reading such awful formatting."* The rule telling it to lay
things out already existed, in section five of six, and had been obeyed three
times that morning and ignored once. A rule obeyed three times out of four is
not a rule, so it moved into the code. It is done with arithmetic rather than a
model, because a model asked to re-lay a reply changed a word on two runs out of
three, and the one that did not cost nine seconds.

**The report you take to your specialist.** Five movements and their sets were
printed as one run-on paragraph. The structure was being built correctly and
then flattened by the last function to touch it.

**Exercises with no video.** Thirteen of your forty-five movements had a
demonstration. Thirty-two now carry written instructions instead — set up, do,
feel it — so every movement can be watched or read. Your knee plan went from one
of five to five of five.

**Your own name in your standing details.** You asked for the numbers you need
regularly and got your name, address, date of birth and mobile back. The
instruction had offered "a date of birth" as an example of what to keep, which is
precisely what it then kept. Blocked now where the row is written, and you can
swipe any row away.

**A weigh-in that invented a hard session.** Four cards in a row told you that
you had trained hard when your last logged session was fifteen minutes of light
running three days earlier, while you had a fever. The reason it could not say
anything useful instead: the week was computed over a single seven-day window
with nothing to compare it against, so "a bit of a drop" was not a sentence it
could write. It now has a four-week baseline, and it checks your care record
before deciding a quiet stretch is unexplained — your movement log stopped on the
12th, and the knee referral in your care record is dated the 12th.

## The finding of the day

Your diagnosis was: *"maybe there's too much architechture around it, limiting
it's thinking."*

That was tested rather than argued with. The same weigh-in, the same model, your
real record, with 792 tokens of instruction instead of 45,000: it did not invent
a session, it used the figure the app had already worked out, and it described
your record accurately.

Then, while cutting, the mechanism showed itself. At nine o'clock the chat gained
the ability to see which movements have a video. At midnight it still said it
could not, because nine thousand characters further down an older sentence still
read *"you cannot tell which movements have one, so never promise a
demonstration"*. The fix had not replaced anything. It had opened an argument
with a more emphatic sentence, and lost.

**In a prompt this size, adding the truth is not the same as removing the
falsehood.** That is why the inventory exists: at 76,000 characters the
contradiction cannot be found by reading, only by measuring.

## Where it leaves us

Honestly, the prompt is only about 2% smaller tonight. The yield was not the
cutting — it was building the two things that make cutting safe:

- **An inventory** that re-measures on demand, block by block, and says which
  path reads each one.
- **An eval of thirteen cases**, every one a failure you have actually had, and
  every check proved able to fail before it was trusted. Safety is reported on
  its own and never averaged into a score.

The next real saving is sized and waiting: the deciding call does not need the
9,400-character map of the app's screens at all. It routes the turn and sets the
highlight; the *reply* call is what does the explaining. That is a genuine
architectural change — it moves text from cached to uncached — and it was left
for daylight rather than made at midnight.

## Also done

- The animatics delivery problem has a root cause at last. A shared Dropbox
  folder counts against the receiving account's storage, and 1,650 videos in 4K
  and 1080p will never fit a free one. No amount of fixing the connection was
  ever going to work. An email asking for Google Drive, a per-release link, or
  any zip has gone to the vendor from the Selodía address, so that anything new
  is set up in the right name.
- The chat now shows what it has done about seven seconds in, while the words
  are still being written, instead of leaving you watching a spinner.
- A cheaper model for the deciding call was measured and refused: it dropped your
  NHS number.

## Still yours

- A fresh-account walk-through, which is the last thing standing between
  onboarding and sign-off.
- Whether to keep the plan card's caution at the bottom once video coverage
  improves. It was moved tonight at your request, and that reverses a rule the
  spec sets deliberately.
