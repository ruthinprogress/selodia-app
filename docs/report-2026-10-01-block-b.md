# Report — 1 October 2026, late. Block B.

Sardines, the week writes and the empty draft were **one root cause**, as you
guessed. Five of seven B findings done.

---

## The root: three writes the honesty guard had never heard of

**Sardines saved.** `sardines [food]` is in your allergies right now and has been
all along. *"That did not save, so it is not in your record"* was **false**.

**The cause.** `falseClaimNote` compares what a reply claims against
`wroteThisTurn` — a list of what reached the database this turn. It held six kinds
of write, and **neither the allergy capture nor the week write was in it**. So
every correct claim about either was answered with a denial, in the same message.

That is worse than the thing the guard exists to catch. A false claim misleads
once; **an app that denies its own successful writes teaches you not to believe
any confirmation it gives** — which is exactly what happened: you stopped
trusting "it's in your week".

The shape of the fault is the list. Every writer added since the guard was built
had to remember to come back and register itself, and three did not.

**Your B5 question — which week entries were stored?** All of them that chat
claimed. French class and Ballet were written; the denial was the guard, not the
write. Your week was then emptied separately, by the setup redo, which is the
destructive bug fixed earlier this evening and which **your phone had not yet
received** when you walked through setup at 21:02.

---

## B1. The empty first draft

**The draft was telling the truth.** `user_week` and `user_skills` were genuinely
empty when you looked:

| | |
|---|---|
| `user_week` | **empty** — the Gym and French class I restored at 19:30 were deleted again by the setup redo on your phone, which was still running the old bundle |
| `user_skills` | **empty** — Splits did not save |
| `allergies` | seasonal allergy, nickel, **sardines** |
| `user_goals` | one active, one archived — correct |

So B1 is two separate things: the week (cause found and fixed, you had not
received it) and **skills not saving, which I have not yet diagnosed.** Splits is
a real ladder (`splits` is in `LADDERS`), so the screen offered something it then
failed to store. That one is still open.

---

## B2. The four goals

**Two faults stacked in one read.** The draft read `user_goals` **without
filtering `archived_at`**, so a goal you replaced came back — and then
**concatenated `user_context` on top**, double-counting everything, because a
database trigger already mirrors `user_context` into `user_goals` precisely so
there is one place to read. `goals-block.tsx` has read one filtered source since
September; this screen never did.

**Your rows need no cleaning.** `user_goals` is already correct: one active
("Reach 25% body fat and 40 kg muscle mass"), one archived on 29 September. The
duplication was entirely in the reading.

**And chat was still quoting the goal you replaced in August.** The screens read
`user_goals`; the model read `user_context` verbatim, which has no `archived_at`
because it is an append-only record of what you said — the right shape for that
table, the wrong thing to answer "what is she working towards" from. The model
now gets the same filtered source the screens use.

---

## B4 / B5. Tested on the path you actually used

You were right to distrust my earlier pass. My week probe posts the same body to
the same route the panel does — so it did cover the server — but **it asserted the
row existed and never read the sentence underneath.** The row always existed. The
denial printed beside it was the bug.

A test that checks the database and ignores what you are told will pass every
single time the app lies to you.

`probe-setup-panel-writes.mjs` now asserts both halves, on the panel's exact
request shape. **6/6 against production:**

```
"I can't eat anchovies."   -> row written, reply does NOT deny it
"Add Pilates class on Tuesday at 6pm."
                           -> Pilates class is in your week, Tuesday at 6pm.
                              row written, reply does NOT deny it
```

It also asserts the panel still posts what the probe posts, so it cannot drift
into testing a path nobody uses.

---

## B7. Valsalva

It was stored as a `never` rule, which is the list the session builder physically
removes movements from — so it was genuinely excluding things, not just
displaying oddly.

**The shape of the table decided the meaning of your instruction:** `never` and
`always` were the only two kinds, so a technique cue became an exclusion by
default. There is a third kind now, `technique`, and it is inert.

**The dangerous part was not the database.** The gate did this:

```
kind: r.kind === 'always' ? 'always' : 'never'
```

Anything that was not `always` became an exclusion — so adding the new kind would
have changed **nothing**, and a technique note would have gone on stripping
movements out of your sessions while the column said otherwise. That coercion is
now a named, exported function with its own tests; it was unreachable from a test
before, because the only way in needed a database, and that is half of why it
survived.

Your row is recategorised, not deleted. Three new checks, including that a
technique cue is told to the model as guidance and never as an exclusion.

---

## A corrupted regex, found by the guard I wrote for it

`route.ts` contained `/␈me␈/i` where `/\bme\b/i` was meant — a shell heredoc had
turned the word boundaries into literal backspace characters, **invisible in every
terminal I had read that line in.** It made a diagnostic condition never fire.
Restored, and the file now has zero control characters.

---

## Consent version

You answered the re-ask at 20:18 on the **old** paragraph, before your wording
landed. Bumped, so you will be asked once more on the final text.

**I also split the version from the date**, because the coupling caused this: the
displayed date and the comparison key were one string, you had asked to keep
"(revised)" showing, and there was nothing left to move. The page still reads
**1 October 2026 (revised)**; the key is now opaque (`2026-10-01-r3`) and bumps
whenever the substance changes.

---

## Apple

**Case 102982913077**, raised 21:55 from hello@selodia.app — the Program Enrolment
purchase would not complete. Recorded in the store submission against step 1.
Everything downstream is waiting on Apple: no account means no Sign in with Apple,
no iOS build, no TestFlight. **Nothing there is waiting on us** — the D-U-N-S
number has been in hand since 10 September, and the App Store answers and privacy
label are drafted and approved including today's changes.

---

## Not done

| | |
|---|---|
| **B1, skills half** | Splits did not save. Not diagnosed. |
| **B3 keyboard** | Not started. |
| **B6 targets** | Not started — I have not yet checked whether Today still shows your calorie and protein targets, or whether the redo cleared your focus settings. |
| **C: add an item to a meal** | Not started. |
| **C: Skills Stage 1** | Not started. |
| **C: the 11-step Google Doc** | Not started. |

---

## D. The five, unchanged from the last report except where noted

| | |
|---|---|
| Rules into chat | **Not started.** Rules are written and enforced; chat still cannot read them back. Today's `technique` kind is now in the prompt, which is a step toward it. |
| The "this week" window | **Not started.** |
| Report Builder placement and vote button | **Not started.** |
| Meal totals vs items | **Partly done.** Removal re-states totals correctly; adding to a logged meal is block C and not built. |
| Write-confirmation guard live on production | **Now genuinely done.** I reported this as done last time and it was live but **incomplete** — three writers were missing from its list, which is what produced the sardines and week denials. Corrected, and verified on the panel path. |
