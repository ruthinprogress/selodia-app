# Report — 1 October 2026, evening

Your setup redo deleted your whole week. Found, fixed, restored, and guarded.
Findings 1–5 done; 6 not done; add-an-item-to-a-meal not started.

---

## The one that matters: your week was deleted

**What happened.** You opened "redo my setup" to review the wording, reached the
activities screen, and continued. That deleted **every row in your week**:

- **Gym, Wednesdays, 60 mins** — you added it at 16:47 ("Add gym 60mins on Wednesdays weekly")
- **French class, Thursday at 10am** — you added it at 16:48

Both were yours, added through chat four hours earlier. Nothing was written in
their place.

**Why.** This was the code:

```
// Only the rows onboarding put there are replaced. Anything added later in
// chat is hers and is not this screen's to remove.
await supabase.from('user_week').delete().eq('user_id', user.id);
if (chosen.length === 0) return true;
```

A comment describing an intention **nobody implemented**, sitting directly above
the line that does the opposite. And the delete ran *before* the early return for
"nothing chosen" — so walking onto the screen and pressing Continue without
touching a chip was the **destructive** path. The review pass was the dangerous
one.

**Restored.** Both rows are back, reconstructed from your own messages rather than
from a guess — your 16:47 sentence for the Gym, and the 16:48 reply naming French
class at 10am. No cadence and no purpose, because you gave neither and inventing
one would be the app putting words in your mouth.

**Nothing else was lost.** Checked individually: your goal ("Reach 25% body fat and
40 kg muscle mass"), both allergies, height 164, activity level, guidance mode all
intact. `life_stage` is empty but was **never answered** — your profile row has not
been written since 10 August — so that is a gap, not a loss.

**Fixed, three ways.** Nothing is deleted when nothing is chosen; only this
screen's own ten activities can ever be removed, so anything chat added survives;
and an activity you keep is *updated* rather than deleted and re-made, so your
Wednesday and your 10am are not thrown away by a redo.

**The same bug was waiting in life-stage.** With no chip tapped it wrote
`life_stage: null`, `hormone_use: []`, `hrt: null` over whatever was there. It had
not bitten only because that screen sits behind "Add more about you" rather than
in the main chain — luck, not design, and the redo now starts earlier so you walk
past far more of these. Guarded.

**`check-setup-destroys-nothing.mjs`** is the new guard: no setup screen may delete
every row you own, nothing destructive may run before the guard that decides
whether to be destructive, and no comment may claim a scope the code does not
have. Five checks; five failures against the old code.

It was wrong twice before it was right. It condemned `goals.tsx` and `skill.tsx`,
which are correctly scoped by `source` and `ladder_key` — then condemned the
*fixed* activities screen, because that file now quotes the old delete in a
comment. A check that cries wolf on correct code gets switched off, and then it is
not there for the case that matters.

---

## Your findings, one line each

**1. Redo opened at step 6 of 11 — fixed, with one honest limit.**
Steps 1–5 are consent, account, intro, equipment, first-log. It was **not**
resuming at your first unanswered step; it has always pushed straight to `goals`,
because that is where the interesting questions began when it was written. It now
starts at **intro, step 3**, covering 3–11.

Steps 1 and 2 are the two that genuinely cannot be re-run from inside a signed-in
app: **consent** happens before a session exists (and has its own re-ask, which
fired today when the new policy went live), and **account** is sign-in — walking
you through account creation while signed in is a way to break a login, not to
review wording.

**Watch first-log in testing.** It asks you to log something, and a redo must not
leave a phantom meal behind. It has a skip.

**Still outstanding from this finding:** "saved answers pre-filled". Only **skill**
and **activities** pre-fill today. **goals, allergies, guidance, life-stage and
equipment start blank.** They are now safe — blank no longer overwrites — but they
do not yet *show* you what you said. That is real work across five screens and I
have not done it.

**2. Step 7 list vs note — fixed.** You were right and it was worse than a
contradiction: **Muscle up and Dead hang are in `LADDERS` and in `CLIP_GAPS` both**
— offered on that screen, and not yet drawn. The note now reads: *"One is enough
here. This is just to show how Skills work. Some of these do not have a
demonstration drawn yet, and 10 movements are still being made. Anything else can
be added later by saying so in chat."*

**What choosing Muscle up writes today:** a real row in `user_skills` plus its
rungs in `user_skill_rungs`, placed by your "just starting / some of it / nearly
there" answer. So it *does* work; what is missing is Stage 1 — chat cannot add a
skill, and the Skills screen is the old view.

**3. Em dash — fixed, and there were three more.** The step 7 note, plus two I
wrote today (the setup chat panel's send failure and the goals-block hide failure)
and one in first-draft that formats your week. Zero left in screen copy.

**4. "Not now" / "Skip for now" — fixed.** Now **"Leave setup"** in the header and
**"Skip this question"** on the ten screens that have it.

**5. What the redo changed — answered above.**

**6. The onboarding review doc as a native Google Doc — NOT DONE.** This is the one
I did not reach. It needs all 11 steps with exact on-screen wording, what each
answer changes, and which are skippable, as a native Doc so your edits save.

---

## Part A — muscle-up ladder wording

Recorded in `docs/skills-brief-2026-10-01.md` with the breathing cues you sent,
including the whole-ladder note and the two per-rung additions, and marked
explicitly: **the breathing line is guidance for how to do a move, not a Rule.** It
excludes nothing and must never reach `user_rules`.

Not built — Skills is still behind add-an-item-to-a-meal in your own ordering.

---

## Not started

**Add an item to an existing meal.** Next.

---

## One thing you should know about my testing

`unflumpapp@gmail.com` is the account I have been running probes against all day,
calling it "the demo account" — and it is **your account**, the one on your phone.
Your standing rule says it is a disposable test account and rows may be deleted
freely to re-run a test, so nothing I did breached it, and I hand-edited nothing to
make a screen look right.

But two probes deleted **chat messages** matching their own phrases to get a clean
run — including `niacinamide` and `levothyroxine`. If you had said either of those
to Selodía in a real conversation, I deleted it. There are zero such messages now,
and I cannot tell you whether that is because they never existed or because I
removed them. I should have scoped those deletes by time as well as by phrase.
