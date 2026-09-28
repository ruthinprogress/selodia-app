# Where this session got to

**Read this first.** If a session stopped for any reason — a limit, a timeout, a
crash, a lost connection — this file is what the next one picks up from. It is
kept current as work happens, not written at the end, because a file written at
the end is exactly the file that does not exist when it is needed.

Standing rule, Ruth, 28 September 2026: *"Keep working until the queue is empty.
Don't stop to report progress, ask for approval, or check in."* The full rule is
in `mobile/WORKFLOW.md`.

---

## Session 57 — Monday 28 September 2026

Started 09:40, Wood Street Library. Mobile only; laptop running at home.

### Done

- [x] **1. Turn the chat switch on.** `REPLY_WRITTEN_AFTER_THE_SAVES = true`,
      deployed 09:55. Confirmed live from her own rows, not a deploy log: every
      reply from 10:17 carries an `answers_id`, which only the new path sets.
- [x] **Every reply since 20:56 on the 27th was being thrown away.** My bug from
      the night before: `ON CONFLICT (answers_id)` cannot infer a *partial*
      index, so the insert raised 42P10 on every call and the route logged it and
      carried on. Three of her replies lost. Fixed with a plain insert; 23505 is
      now the expected no-op. Verified against the real index before shipping.
- [x] **The new path could have rewritten the C-SSRS screening question.** The
      switch ran on every turn the *allergy* gate passed. `turnIsOrdinary()` is
      now a whitelist — neutral, no escalation step, no card, no block — with ten
      checks that run before any model call.
- [x] **2. Build log: tracked time and locations for sessions 45–56.** Her timer
      totals; locations for S50–S56; start times left unrecorded at her
      instruction.
- [x] **3. Open Actionables reconciled against the live app.** Three items were
      listed as not started that had shipped the same day — I had rebuilt the
      list from the previous list rather than from the code. The document now
      says so.
- [x] **4. Botanicals.** `BotanicalMark` was already deleted (commit `b4e2090`);
      the Sprig on Settings stays. Off the list.
- [x] **5. The 09:24 duplicate reply**, backed up and deleted. Her thread now has
      zero repeated assistant rows inside fifteen seconds across 1,012 rows. The
      gap is closed: the turn id is minted in code, so a chat reply always has
      something to answer and the partial index always applies.
- [x] **13. The allergy gate misfires.** All three parts, plus fourteen new
      checks. An allergy now has a *kind*; only what can be eaten arms the food
      filter; a layer-3 hit on a reply that does not suggest food is adjudicated
      rather than blocked; a yes that names a destination is honoured.
- [x] **Fallback logging.** `reply_path_fallbacks` records reason, detail, voice
      and turn for every fall back to the old path.

### Queue, in order

- [x] **Prove or disprove the 10:32 fallback.** Proven, by contradiction rather
      than logs — see Findings. `reply_path_fallbacks` now records reason, detail,
      voice and turn for every fall back, so the count per day is a query.
- [x] **12a. The weigh-in card.** Two faults, both fixed and shipped over the air.
      It compared against the reading nearest SEVEN DAYS back rather than the most
      recent one, reporting +1.4 kg over a day-on-day change of +0.1. And it called
      that "worth a calm look rather than a shrug or a spiral". Now: the previous
      reading, and when the record explains a rise the explanation leads and the
      sentence stops. A big day is a flag at all for the first time.
- [x] **12b. Pizza duplicates.** The database was already clean — see Findings.
- [x] **12c / 12d.** The duplicate reply is covered by item 5's fix; the drinks
      estimates are corrected in her log and recorded as an open item for the
      estimator.
- [x] **6. Weekly roundup content half.** Rebuilt from a baseline in
      `app/lib/roundup-prompt.ts`; the numbered ORDER list and its "one thematic
      observation" step are gone. Tested on her real week, 21–27 September, from
      her own rows: 15 of 15.
- [x] **7. The red check.** Resolved: the rule now says that saying nothing is
      not the alternative to a receipt, and names the failing sentence. Whole
      chat test set is **35/35** on the new path, 29/35 on the old one.
- [x] **8. Plan logged as a session.** The guard is at the write: before any
      activity row, the text is matched against her own saved plan titles and a
      session is written instead. Stricter than the deliberate path, because
      nothing here has decided a routine happened. 13 checks.
- [ ] **9. Repeated-phrase probe within a single conversation.**
- [ ] **10. Voice speed** — is a turn back to about 3.2s.
- [ ] **11. Research only, no building:** UK/EU store rules for subscriptions;
      ICO registration for Selodía Ltd; a draft beta agreement. Each to Drive.
      Plus the billing proposal including complimentary access, and how to find
      and choose wave one.

### Findings that need no answer from her

**The 10:32 fallback is proven, by contradiction rather than by logs.** That
reply carried the appended line *"Kept in your Almanac, under Insights, as a
symptom."* When the new path writes a reply, the appended notes are cleared — so
that line can only appear if the writer returned nothing and the route fell back.
It also took 3 seconds against 10 for the turns around it, which is one model
call rather than two. What is *not* known is why it failed; that is what the new
`reply_path_fallbacks` table exists to answer, and it can only answer for turns
from now on.

**The pizza duplicates are already gone.** Checked at 11:0x: `food_logs` holds
exactly one pizza and one lager, both on Sunday 27th, and nothing at all on
Monday 28th. Five food items for Sunday in total. So what she is seeing is a
stale screen rather than stale data — the Log tab does not re-read after a change
made server-side. Reopening the app should show it correctly, and the refetch
gap is worth its own item.

### Findings that do not block anything

**choosePlan's comment and its code disagree**, found while testing item 8. The
single-plan shortcut says "somebody with a single saved routine who says *I did my
workout today* means that one" - and that exact sentence does not trigger it,
because nameWords keeps "workout" and "today" so the word set is not empty and it
falls through to scoring. Left alone rather than fixed: loosening the deliberate
path changes what gets written to her data, and that is a decision rather than a
tidy-up. The guard is unaffected - it requires title words either way.

### Questions for Ruth

- **Does the pizza still show twice after force-closing and reopening the app?**
  If it does, the display bug is worse than a missed refetch and I will chase it.
  If not, it is the Log tab needing a re-read on focus.
- **Voice may now be noticeably slower** — the new path adds a second model call,
  and a typed turn measured 10 seconds against 4–5 on the old path. Say the word
  and the switch goes back off for voice only while that is fixed.
