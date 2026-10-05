# Approach and guide: what changed, and what I need you to decide

5 October 2026

Your rule: **you choose your approach, Selodía provides the guide.**

Part 1 is done and published. Part 2 is written out below and **not applied** —
it decides how Selodía talks in conversation, so it is yours to read first.
Part 3, the stored names, is left alone as you said.

---

## How big it actually was

The first count said 646 occurrences of "goal" and "target" across 87 files. That
number was almost entirely this codebase explaining itself: once comments are
stripped, **38 strings are ones somebody reads**, and 27 of them needed changing.

---

## Part 1 — done, and live on your phone

### The main ones

| Where | Was | Now |
| --- | --- | --- |
| Body Manual row | Your body goal | **Your current approach** |
| End of setup | Your targets | **Your guide** |
| When no weight is given | Add your weight to see your targets. | Add your weight to see your **guide**. |
| Body Manual, no weight | Add one and your targets appear. | Add one and your **guide** appears. |
| Paused deficit | Losing fat is still your **goal** | Losing fat is still your **approach** |
| Chat chip | My body goals | **My current approach** |
| Today card | *(no name at all)* | **Current approach: Less fat, more muscle** |
| Setup heading | What are you working towards? | **What's your current approach?** |

### The quieter ones

| Where | Was | Now |
| --- | --- | --- |
| Profile row in More | Your details and goals | Your name, your height, your date of birth |
| Almanac intro | Your goals, your plans… | Your **approach**, your plans… |
| Deficit row | Running, as your goal asks. | Running, as your **approach** asks. |
| Deficit row | Your goal has not changed | Your **approach** has not changed |
| Pause | Resume puts your goal back exactly as it was. | Resume puts your **approach** back |
| Today, nothing set | Add a goal to see targets | Choose an **approach** to see your **guide** |
| Your week row | not a target to hit | not **something** to hit |
| Protein nudge | nudging your target up a touch | nudging your **protein** up a touch |
| Nutrition step | a daily protein target that fits you | a daily protein **guide** that fits you |
| Report builder | Your goals, under their own heading | Your **approach**, under its own heading |
| The goal screen | Needs a goal and a weight | Needs an **approach** and a weight |
| Setup, measure box | sits under your goals | sits under your **approach** |
| Weight note | Given on the goals screen | Given when you chose your **approach** |

### Three places I deliberately did not change

**1. The goals block in Plans.** Those are goals you wrote in your own words —
*"Reach 25% body fat and 40 kg muscle mass"* — with dates and an archive behind
them. That is a third thing: not the approach, not the guide. Renaming it would
make two different objects share one name, which is the fault we keep removing
rather than adding.

**2. The skill ladders' "goal rung".** A different sense of the word entirely.
The top rung of the handstand ladder is a goal in ordinary English.

**3. The `effect` notes in the goals library.** Shown to nobody. Their own
comment says they exist to be checkable.

### Two checks failed, and that was correct

`check-weight-and-targets` and `check-protein-parity` both assert exact wording.
Both were updated rather than relaxed — the property each tests is unchanged, and
one gained a second assertion that the old word is **gone**, so it cannot creep
back.

---

## Part 2 — proposed, not applied. Your call.

This is the prompt: the instructions Selodía is given before she replies. Changing
a word here changes what she *says*, not what a label reads, which is why it is a
list and not a commit.

I have split it by what each line does, and given a recommendation for each.

### Group A — the figures. **Recommend: change.**

These describe your calorie and protein numbers to her. Every one is the thing
you have named "the guide".

| File and line | What it says now | Proposed |
| --- | --- | --- |
| daily-targets 520 | "kcal logged today against a target of…" | "…against a guide of…" |
| daily-targets 527 | "THERE IS NO CALORIE TARGET - the data…" | "THERE IS NO CALORIE GUIDE…" |
| daily-targets 535 | "logged against their own set target of 100g" | "…their own set guide of 100g" |
| daily-targets 545 | "with no target derivable" | "with no guide derivable" |
| daily-targets 569 | "HOW THOSE TARGETS WERE WORKED OUT — the exact lines the goals screen shows her" | "HOW THAT GUIDE WAS WORKED OUT — the exact lines the approach screen shows her" |
| ask-selodía 1165 | "If there is no calorie target in this prompt… do not mention targets at all" | "…no calorie guide… do not mention the guide at all" |
| ask-selodía 1625 | "It changes what their daily calorie target is" | "…their daily calorie guide is" |

### Group B — the approach. **Recommend: change.**

These are about the thing the four switches set.

| File and line | What it says now | Proposed |
| --- | --- | --- |
| ask-selodía 788 | "No goal set yet." | "No approach chosen yet." |
| daily-targets 583 | "paused, not because her goal changed. Her goal is unchanged…" | "…not because her approach changed. Her approach is unchanged…" |
| daily-targets 589 | "Her fat-loss goal is NOT cancelled" | "Her fat-loss approach is NOT cancelled" |
| daily-targets 591 | "as her having given up on the goal" | "as her having given up on it" |

### Group C — her own stated goals. **Recommend: leave.**

This is the same reasoning as the Plans block above. The onboarding "goals" step
exists to let *"a concrete, personally meaningful goal emerge — a dress size, a
distance, a movement goal"*, and stores it in her words. That is a goal in the
ordinary sense and she chose the word herself.

- the onboarding goals step and everything it says (29 lines)
- "facts, goals, diagnoses, preferences" in the context block
- the weight-goal extraction at lines 1663 and 1667

**If you want these changed too, say so** — but my view is that "approach" would
be a worse word for a thing somebody wrote in a sentence, and that having both
words, each meaning one thing, is clearer than one word meaning two.

### Group D — code, not language. **Not up for discussion, listed for completeness.**

About 30 of the 68 matches are variable names, database column names, log lines
and phase identifiers: `let target`, `category: 'goal'`, `UNSAFE GOAL:` in a
server log. None of it is ever read by a person using the app, and renaming it is
Part 3, which you have left as it is.

---

## What I need from you

One line is enough:

- **"Do A and B"** — the figures and the approach, leave her own goals alone. This
  is what I would do.
- **"Do A, B and C"** — change everything, including the onboarding goals step.
- **"Just A"** — change only the figures for now.
