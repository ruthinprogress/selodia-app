# Report — 1 October 2026, late. Items 1, 2 and 6.

Done in your order. **3 of 6 done, 3 not started.**

---

## 2. Proof first, because it answers the rest

**Production runs `3999ab4`, built from git, branch `main`, `production`, `lhr1`.**

```
GET https://selodia.app/api/version
{ "short": "3999ab4", "builtFrom": "git", "branch": "main", ... }
```

My local HEAD is `3999ab4`. They match. **Pushes do deploy** — that is settled now
by the server stating its own identity rather than by me inferring it.

**Why that question was unanswerable before.** Twice today I ran
`vercel deploy --prod >/dev/null 2>&1` with an **expired token**, piped the output
to nothing, and "confirmed" it by curling `/support` for a 200 — which proves the
site is up and nothing about whose code is on it. A 200 from a server running
since yesterday looks identical to one deployed a minute ago. The deploy check
that should have caught it reads the Vercel API with the same dead token and
skips. `/api/version` also reports **"working tree (no commit)"** for a CLI
deploy, which is the answer that matters most.

### Why the three still failed on your phone

**The allergy and week denials: they are old messages.** The last denial in your
thread was written at **21:03**. The fix went live at about **22:05**. There are
**zero** after it — I queried every assistant message containing that phrase.
They are still visible because messages are kept, which is correct, and is
exactly why a chat history cannot be used as evidence of current behaviour.

**Replayed against the proven commit, 6/6**, on the panel's exact request shape,
reading the row *and* the sentence:

```
"I can't eat anchovies."            -> row written, reply does NOT deny it
"Add Pilates class on Tuesday 6pm"  -> row written, reply does NOT deny it
                                       "Pilates class is in your week, Tuesday at 6pm."
```

**Valsalva (c), as you asked.** Her stored kind is now **`technique`** — I queried
it. Rules by kind: `never × 3`, `always × 3`, `technique × 1`. And the draft code
does **not** list every rule regardless of kind: `first-draft.tsx:102` reads
`.filter((r) => r.kind === 'never')`. So on a bundle carrying that filter it
cannot appear.

**But I cannot close this one.** Your screenshots were the About screen and Today
— the first draft one did not come through. About shows you on `01a0f94c` **with
"Ready on next start"**, meaning a newer bundle is downloaded and not yet
applied. If the draft was viewed before that restart, it was the old code. **Tap
"Get the latest update" on About and re-check**; if Valsalva is still listed after
that, send me the draft screenshot and it is a real bug I have not found.

**The draft (d), stored vs shown:**

| | Stored | Draft should show |
|---|---|---|
| `user_week` | **empty** | nothing |
| `user_skills` | **empty** | nothing |
| `user_goals` | 1 active, 1 archived | **one** goal |
| `allergies` | seasonal, nickel, **sardines** | three, including sardines |

So "Your week: nothing yet" and "Working on now: nothing yet" were **accurate** —
the data really is empty. The week was emptied by the setup redo, whose fix your
phone had not received when you walked it at 21:02.

---

## 1. Targets

**Cause found, and it is not the redo.** `fat_focus_state` and
`muscle_focus_state` are both **NULL**, and `calculateCalorieTarget` returns null
without them (`daily-targets.ts:74`). That is why protein shows and calories do
not.

**The migration of 28 September did it, on purpose.** It dropped the
`NOT NULL DEFAULT 'maintain'` on both columns — *"a goal nobody chose stops
becoming a target"* — and backed the old values up. Everyone's focus became unset
that day. **So the calorie target has been missing for three days, not since
tonight.** A redo does not clear it; it simply never set it, because you skipped
the goals screen and skipping correctly saves nothing.

**I have not restored the backup, and I want you to overrule me if you disagree.**
The backed-up value is `maintain` for both — the default that migration was
written to remove. Writing it back would hand you a target you never chose, and
`maintain` contradicts your actual goal of reaching 25% body fat and 40 kg muscle.
I am not willing to invent your focus from a default.

**What I did instead:** Today now says so and offers the screen that asks you,
rather than silently showing protein alone. One tap sets it and the calorie target
returns. If you would rather I just wrote `lose` + `gain` from your stated goal,
say so and I will.

---

## 6. The honesty guard is structural now

The list of writes was assembled by hand three hundred lines from any writer, so
every writer added since had to remember to register itself. Three did not.

A writer now notes what it wrote **on the same lines that wrote it**, and the
guard reads the log. You cannot forget to edit a list you never open. Each call
site records **after** checking the error, because a failed insert must leave the
log untouched — that is the case the guard exists for.

---

## Not done

| | |
|---|---|
| **3. Onboarding simplification** | **Not started as a flow.** I built the plain text field that replaces the chat panels (`setup-text-field.tsx`) and then stopped, because you put it behind 1 and 2 and those took the sitting. The step list, the reordering, the measured timing and the step table are all outstanding. |
| **4. Splits not saving** | Not diagnosed. |
| **5. Restore her week** | Not done — and it should wait, as you said, until your phone has the fix, or the redo will delete it again. |
| **Block C** | Not started. |

---

## What I need from you

1. **Tap "Get the latest update" on About**, then re-check the first draft. If
   Valsalva is still under "Staying out of your sessions" after that, send the
   draft screenshot.
2. **The focus question above** — one tap from Today, or tell me to write
   `lose` + `gain` from your goal.
