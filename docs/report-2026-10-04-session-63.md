# Session 63 — Sunday 4 October 2026

Everything from today, in the order it happened. The five-line summary is in chat;
this is the whole thing.

---

## 1. Needs a check on your phone

**Nothing from today's big piece is on your phone yet.** You asked me to stage the
Today card and ship the small fixes, and that is exactly what happened:

- **Already on your phone** (EAS update `3af302f8`, shipped this evening): the
  Movement quick log bar, and "Get stronger" gone from the goals list.
- **Already live on the server** (deployed, commit `b13e323`): chat can now see
  your switches, your Pause, the day you set your activity level, and the macros
  you have switched on.
- **Staged, not published**: the four switches on Today, the new setup question,
  the activity level screen, and the Body Manual's move into More. All committed,
  all green, waiting for you to say publish.

**When you are ready, the check is:**

1. Open **Today**. One line at the top says where you are and what you use.
2. Tap it. Four switches: Lose fat, Maintain my weight, Gain weight, Build
   muscle. Tapping any of the first three should turn the other two off and say
   why they are dim.
3. Tap **Pause**. The figure should become what your body uses, your switches
   should stay exactly as they were, and **Resume** should put them back.
4. Tap the activity level link in "At ___, your body uses around N kcal a day".
   Five plain descriptions, each showing the number it produces, and "Last set
   on". Pick one, and the figure on Today should change.
5. Open **More**. The **Body Manual** is its own row now, not buried in Profile.

---

## 2. The four switches

**What you said, and it started as a complaint about where something lived:**

> This is lovely, if it works, but useless hidden away in profile settings.

**The model, after four rounds of narrowing:**

| Switch | Combines with | What it does to your daily figure |
| --- | --- | --- |
| **Lose fat** | Build muscle | A gentle deficit — 0.5% of bodyweight a week, with a floor |
| **Maintain my weight** | Build muscle | Around what you use |
| **Gain weight** | Build muscle | A small surplus — 0.25% a week, never above 300 kcal |
| **Build muscle** | any of the above, or none | On its own: 5% more than you use. With any weight switch: nothing added |

The three weight switches are mutually exclusive. Build muscle is independent.

**All four off means "nothing chosen", and produces no figure at all.** That was
your improvement on my design, and it is better than mine. I had argued maintain
should be the *absence* of a choice; you made it a switch and made "all off" mean
nothing chosen. Every state now has exactly one expression, and the app can tell
"I have decided to hold steady" from "nobody ever asked me" — which it has not
been able to do since 28 September, when a silent default showed every account a
maintenance target presented as its own.

**One Pause.** Your words: *"NO per-row paused states."* It holds whatever you
have chosen at what your body uses, leaves the switches visible and dimmed, and
Resume restores them exactly. One rule for every combination rather than a second
copy of every row.

**Gain weight carries one calm line** whenever it is on: if you have been losing
weight without meaning to, it is worth telling your doctor. The longer wording
about recovery sits behind a second tap, because putting eating disorders in front
of everybody who taps that switch would be the app deciding something about the
person that it has no way to know.

---

## 3. Setup asks the same question now

**Your words:**

> we already covered that More energy and perimenoause are not the same thing as
> calorie and bosy fat calls.

That is the whole division, and the seven chips were ignoring it. Four of them
decided a calorie figure; three opened a different question and touched no number
at all.

**And four of the seven were one answer wearing overlapping names.** "Lose fat"
and "Less fat, more muscle" share a half — tick both and the second quietly won.
There was no way to say "gain weight". And all seven unticked meant the same thing
as never having been asked.

So setup now has the four switches under **Your body**, and three chips under
**Anything else going on** — a skill, more energy, perimenopause. It is the same
component as the Today card, so the two screens cannot drift apart.

"Keep things steady" is **"Maintain my weight"**, which was your other
instruction.

---

## 4. Why your maintenance read 1,350

You said: *"1350 is nothing!"* You were right, and the cause was worse than the
four hundred calories.

**Your activity level was not something you had said.** It was worked out from the
cadence chips on the activities screen, every single time you opened it, with no
guard — and the function that works it out returns `sedentary` when handed
nothing. Your chips were not saving. So the single biggest term in your daily
figure was being quietly overwritten with "mostly sitting" by the act of visiting
a page.

**Two other things were wrong with the same question.** It asked how much you move
*outside exercise* and fed that answer to a multiplier that is meant to cover the
whole day including exercise — so answering honestly left your ballet, your
training and your 9,847 steps out of your own estimate. And the labels do not
survive contact: you called your week "moderately active", and the figure you
expected is what the app calls `light`.

**It is a stated answer with a date on it now.** Five plain descriptions of a
whole week with training in it, each showing the kcal it produces, and "Last set
on [date]". Nothing derives it, and nothing expires it.

---

## 5. The thing I got wrong today, in the same session you reported it

You asked chat for a week of your saturated fat. It said it could not see it, and
did not tell you it was two taps away in "What I track". You then said the sharper
version of the complaint:

> she should have told me they were available and suggested i turn them on

I built exactly that — read the macros you track, offer the ones you do not —
wired it to a column in the chat context, typechecked it, and shipped it. **The
column is not one the chat context sends.** It had been reading nothing from the
moment it landed. The feature built to answer the complaint could not answer it.

**Three more columns were in the same state**, and one of them matters more:

- `tracked_macros` — the one above.
- `paused_at` — so you could tap Pause on Today, ask chat what to eat, and be told
  your deficit figure. The app contradicting a choice you had just made.
- `body_mode` — Build muscle alone is 5% over what you use and Maintain + Build is
  not; without this chat could not tell them apart.
- `activity_level_set_at` — so "where does 1,550 come from" can name the day you
  chose it.

**The fault was never the missing columns.** There are two hand-maintained lists of
the same thing — the select, in a database migration, and the cast, in TypeScript
— and nothing compared them. A column missing from the select is not an error in
either language: the database never sees the request, TypeScript believes the
cast, and the value arrives as "undefined", which every reader treats as "she has
not set that". The most plausible wrong answer available, and therefore the least
likely to be noticed.

**There is now a check that compares the two lists**, and it proves it can fail
before it reports that it passes — it runs its own comparison against a column
nobody has ever had.

---

## 6. Two other things nobody was watching

**Two migrations existed only in the database.** The columns the new Today card
depends on were applied straight to the remote this evening and never written into
the repository, so a rebuild from the code would have had none of them and the
card would have failed on a missing column. Both files are now recovered verbatim
from what actually ran.

**A check suite had stopped running since this morning.** Nineteen cases on how
food is parsed, dead at import, because an unrelated file began importing a
Next.js module the resolve hook could not follow. A suite that cannot start prints
nothing, and nothing is indistinguishable from passing in a report. That is the
second time this week that exact shape has cost something, and the hook's own
header warns about it.

---

## 7. Everything else fixed today

| What you reported | What it was |
| --- | --- |
| Voice logging: only the last reply heard, no summary table, everything logged twice | The duplicate check looked in a window anchored to *now*, so a meal backdated to Saturday was never compared with the one already stored |
| Chat could not delete Saturday's entries, then deleted the wrong one and said it had | It took the newest matching row rather than the one you named. It builds a candidate list for the day you mean and matches on your words now |
| "Ask about this" did nothing, on every screen | The card was created and chat never opened it. One shared helper now, not eleven near-copies |
| Profile: "What you already do" saved nothing and dropped you in Chat | Four setup screens were returning success from a save they had refused to do |
| Two different protein targets a minute apart | One function, five call sites, one defaulted boolean invisible at four of them. Your real answer is **90–106 g** |
| Movement had no quick log bar | The bar had supported movement since it was written. This one view never called it |
| "Get stronger" | Gone, as you asked. It was also quietly adding a calorie surplus. "Feel stronger" already exists in the feel goals, where it moves no figure |
| The close-up nutrient views were garbled | Two rows — names, then readings — instead of eight columns |
| Multiple copies of the close-out and build log in Drive | Duplicates moved to an archive folder for you to delete. One script takes the session as data now, instead of a new script per session |
| Close-outs 61 and 62 missing | Both written |

---

## 8. The monthly research scan

Set up, trialled, and documented.

- **First real run: Monday 2 November 2026.**
- **It proposes and never applies.** It opens a branch, writes a proposal, and
  merges nothing. Anything that would lower a calorie floor or raise a surplus
  ceiling has to say so in its first line.
- **`docs/recurring-scans.md`** is the index of every scheduled job — how often,
  where its reports go, whether it may change anything.
- **`docs/research-log.md`** is where the research reports themselves accumulate,
  the way the build log holds sessions.
- The build specification now points at both, rather than holding a table of
  scans that would go stale.

**One weakness worth knowing.** All of these only run while the Claude desktop app
is open. A task due while the laptop is shut runs on next launch instead. That is
fine for a monthly job and a real problem for anything that must happen on a given
day — which is why the **weekly funding check has still never fired**.

---

## 9. Funding

Nothing applied for and nothing spent today. **Women in Innovation remains the
November target**, and the weekly readiness check that tracks it has the same
"only runs while the app is open" weakness as everything else on a schedule. Worth
fixing before November rather than in it.

---

## 10. What is waiting on you

1. **Say publish** when you want the four switches, the activity level screen and
   the Body Manual's move on your phone. They are committed and green; nothing
   goes out until you say so.
2. **Then the five checks in section 1**, which take about two minutes.
3. **Your Toggl figure for today**, for the build log header — it is the one fact
   in there that only you have.
