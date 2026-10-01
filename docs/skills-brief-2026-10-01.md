# Skills — final brief (Ruth, 1 October 2026)

**QUEUED, NOT STARTED.** Her own ordering: *"after the onboarding lock (urgent)
and 'add an item to an existing meal'. Do not start until those are done."*
Neither is done — see the gate at the bottom.

Recorded here because she said this *"replaces every earlier Skills note; none
were sent"*, and a brief that exists only in a chat window is a brief that gets
rebuilt from memory later.

---

## Why

Ruth told chat *"I want to learn to pull up to muscle up"*. Chat replied that her
Park / calisthenics slot already covers it, and after "Ok" said *"It's already
sitting there in your week."* **Nothing was added.** The Skills tab still shows
"No skills yet" and invites her to tell Selodía what she wants to do, which leads
nowhere.

Two faults in one exchange: chat has no way to add a skill, and **Week (when I
train) and Skills (what I want to be able to do) are being treated as the same
thing** — the same conflation as the Me-tab-versus-Week mistake of the same
morning.

## Target design — record in the spec, build Stage 1 only

- **Week** = when I train. **Sessions** = my current toolbox, not a catalogue.
  **Skills** = things I want to be able to do. **Rules** = what Selodía must
  respect.
- A Skill is the destination and owns its roadmap: why she wants it in her own
  words, started date, notes from conversation, a short explanation of the path,
  and the ladder.
- **Skills reference Sessions; Sessions never own Skills.** One Skill can
  reference several Sessions; one Session can serve several Skills.
- **Stage 2, NOT now:** when she confirms a rung is done, the next Session appears
  in her Sessions list. Sessions must never be littered with things she cannot do
  yet.
- Design the data so a rung **can later** reference a Session (nullable link).
  **Build no unlocking now.**

## Stage 1

1. **Report what already exists first** — `skill-ladders.ts`, the skill tables,
   the Skills view — and propose changes before creating anything. **Do not create
   duplicate storage.** Her words: *"This team has already built a second system
   for something that existed."*
2. Chat **offers** to add a skill when asked. For "I want to learn a muscle up":
   *Would you like me to add "Muscle up" to your Skills?* Nothing is created until
   she says yes. Same confirm-first path as Me. **The confirmation line comes only
   from a successful write.** No raw JSON, no asterisks, no scolding.
3. **Never** answer a skill request with "it's already in your week". If the
   activity is in the Week, say so **and** offer to add the skill.
4. After saving, chat asks where she is now, in her own words (for example how
   many strict pull-ups). Chat proposes which rung is **Now** and saves it only
   after she confirms. **Chat never advances a rung silently.**
5. Ladder is text-only rungs, quiet states only: **done, Now, Next, Goal.** Each
   rung has a short "why this step", what it develops, and "Needs X first".
   **No padlocks, XP, streaks, levels, percentages, timeframes, "behind" cues or
   counters.**
6. **Muscle up ladder, from her own plan:**
   - *Now* — dead hang (3 × 20–30s); scapular pulls (3 × 8–10); pull-up volume
     (target 3 × 5 strict; she is at about 2).
   - *Next* — high pull-ups (needs 5 strict first); bar dips (3 × 8 full range).
   - *Goal* — muscle up (needs 8–10 pull-ups, bar dips and high pull-ups).
   Use the curated ladders in `skill-ladders.ts` for anything it already covers.
7. **No invented ladders.** For a skill with no curated ladder, save a plain skill
   (name, why in her words, started date, notes) **and tell her so**. She can
   describe the steps herself.
8. Rungs may link to an **existing** Session (for example Side Splits
   Progression). **Create no new Sessions in Stage 1.**
9. **Rules are a hard exclusion**: never offer a rung her Rules exclude. Bar work,
   pull-ups and handstands are allowed for her.
10. **Only store what she said.** Chat does not write outcomes or predictions
    ("you should see progress in three months") into a skill.
11. Skills screen: cards showing skill name, started date, short description. **No
    reps, durations or exercise counts.** Tap a card for the why, notes and ladder.
12. Empty state, **exactly**: *"Skills are things you'd like to learn or become
    able to do. Tell Selodía one you'd love to achieve."* Impersonal — no "I", no
    "we". **Use it only once chat can add a skill**, so it never promises more
    than works.
13. Chat can **read** Skills, as it reads Me, so it can talk about them.
14. Chat actions: add; set where she is now; move a rung (after confirmation);
    remove; explain "needs this first". **Removing asks first.**
15. Keep the tab name "Skills" in **one** place, so it is a one-word change.

## Needs Ruth before it ships

The **"why this step"** and **"what it develops"** text for every rung of the
muscle-up ladder. **This is movement guidance.** Write it, put it in a Google Doc
(native, not .docx), and wait for her approval.

## Tests

- Replay her conversation: *"I want to learn to pull up to muscle up"*. Expect the
  offer; Yes saves the skill and ladder; then the "where are you now" question.
  Show the database record **and** a phone screenshot of the card and the ladder.
- *"I want to learn a handstand"*: a plain skill or an existing curated ladder,
  **never an invented one**.
- **Prove each test fails against today's behaviour.**
- **Done means Ruth has seen it on her phone.**

---

## The gate — why this has not started

| Blocker | State |
|---|---|
| The onboarding lock | Built and shipped 1 Oct (setup chat panels, `RESUME_ROUTE` repaired, medication card). **Not confirmed on her phone**, and her standing rule is that nothing counts as done until it is. |
| Add an item to an existing meal | **Not built.** `writeItems` inserts items only as part of logging a *new* meal; there is no route that appends to an already-logged one. `claimed-write.ts` names it as a known "cannot" in its own comments — the app recognises the instruction and has nowhere to send it. |

So the next build task is **add an item to an existing meal**, not this.
