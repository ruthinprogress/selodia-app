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
- [x] **9. Repeated-phrase probe within a single conversation.** It was already
      built - the fourth item today found done and listed as not started. What it
      could not do was say whether things are improving, so it now splits at the
      27 September rebuild. **"Got it" was 27% of 359 replies before; since the
      rebuild the commonest opening is 10% of 42.**
- [x] **10. Voice speed — measured from her own turns, not a probe.** Median
      time from her message to the reply: **3.3s on the 26th (49 turns), 3.3s on
      the 27th (32 turns), 7.0s today (8 turns)**. So yes, the speed work landed
      and turns WERE back to about 3.2s. The new path then doubled them, which is
      the second model call. Part of that is recoverable and now is: the
      classification call was still writing a full reply that nothing reads, and
      it is asked for a short fallback instead - except on a distress turn, where
      it is still the real reply. Needs re-measuring tomorrow on real turns.
      **Note: chat rows do not record whether a turn was spoken**, so this is all
      turns rather than voice specifically.
- [x] **11. Research, no building.** Four documents in Build Specs, all dated
      2026-09-28: store rules for subscriptions, ICO registration, the beta
      agreement first draft, and billing plus complimentary access plus wave one.
      Every one says where I am unsure rather than smoothing it over.

**The queue is empty.** Continued with Open Actionables items that do not need
her, per the standing rule.

- [x] **A feedback route inside the app** — a wave-one blocker, and the last
      unblocked item on the Open Actionables list. Settings now has its own
      "Something not right?" row above Help, writing to a `feedback_reports`
      table with the build context attached automatically: which update, which
      platform, which OS version, when. Shipped over the air.
- [x] **Today's four migrations written into the repo.** They had been applied
      through the management API and existed only in the database.

### Findings that need no answer from her

**The 10:32 fallback is proven, by contradiction rather than by logs.** That
reply carried the appended line *"Kept in your Almanac, under Insights, as a
symptom."* When the new path writes a reply, the appended notes are cleared — so
that line can only appear if the writer returned nothing and the route fell back.
It also took 3 seconds against 10 for the turns around it, which is one model
call rather than two. What is *not* known is why it failed; that is what the new
`reply_path_fallbacks` table exists to answer, and it can only answer for turns
from now on.

**The pizza duplicates are already gone**, and my explanation for what she saw
was wrong. `food_logs` holds exactly one pizza and one lager, both on Sunday
27th, and nothing on Monday 28th. I put the stale screen down to the Log tab not
re-reading after a server-side change — it does: `useFocusReload` bumps a key the
rows effect depends on, and it fires again at follow-up intervals. Nor did my
delete leave anything dangling: no chat message points at either removed row.
The likeliest explanation is simply a screen she had not left and returned to.

### Findings that do not block anything

**choosePlan's comment and its code disagree**, found while testing item 8. The
single-plan shortcut says "somebody with a single saved routine who says *I did my
workout today* means that one" - and that exact sentence does not trigger it,
because nameWords keeps "workout" and "today" so the word set is not empty and it
falls through to scoring. Left alone rather than fixed: loosening the deliberate
path changes what gets written to her data, and that is a decision rather than a
tidy-up. The guard is unaffected - it requires title words either way.

### Answered, 28 September, and acted on

- **Pizza shows once after a force-close.** Nothing further to do; my "Log tab
  does not refetch" theory was wrong and the correction is recorded above.
- **Voice is back on the old path**, text stays on the new one, until the latency
  is about 3.3s. The switch is now a decision per surface.
- **The 24 September readings:** one 55.5 kg kept, the other five backed up to
  `body_measurements_removed` and deleted. That week is three real readings now.

### Latency — her top priority, and where it stands

**The cause was the did-lines block**, not the second call in itself. It said "say
what matters of it in your own words", which reads as *cover all of it*, and it
pulled against NO_RECEIPTS telling the model never to claim something is saved.
The model resolved that by writing more — four or five hundred words to "56.9 this
morning", hitting the ceiling and falling back. At about sixty tokens a second
that is most of the seven seconds.

Now: a save that worked gets no mention, anything that failed is always said in
one sentence, and the writer sees the last eight turns rather than forty.

**Measured: a median of 3,350ms against 6,330ms**, with quality holding at 35/35.
**Not yet proven on her real turns** — that reading can only be taken tomorrow,
and it is the only one that counts. If it is near 3.3s, voice goes back on the new
path and the per-surface split comes out.

## Session 57, second queue

### Decisions recorded
- **Company email is hello@selodia.app** for all company documents. Already on
  the landing page and the in-app support screen; what is needed to make it
  RECEIVE mail is in the questions below.
- **ICO:** she is registering Selodia Ltd herself today, tier 1, direct debit.
- **Apple:** enrolment 3N9H5LB49A submitted. **Reminder owed the day it is
  approved: apply for the Small Business Programme** - 30% to 15% from year one,
  a form rather than a negotiation.
- **Complimentary accounts:** a two-paragraph note, not the beta agreement.
  Mechanism after wave one. List kept: Lynda, Carol, Nikki, Auguste.
- **Beta is open-ended.** Testers leave any time with no notice; we give 30 days'
  notice of changes. Continued free access for testers whose feedback drove real
  change is discretionary and never promised.
- **The three old Jotform forms** (two Unflump beta feedback, one Beta Tester
  Coffee Chat Notes) are replaced by the in-app beta feedback. **Archive them
  once it is built.**

### Queue

- [x] **1. Voice latency.** See the finding below. Voice is on the old path.
- [x] **2. The waiting list.** Found, tested live, and readable.
- [x] **3. Running costs and pricing.** In Build Specs. Computed from measured
      token counts: GBP 2.09 a user a month blended, and flat from 100 to 10,000.
      Recommendation GBP 6.99 / GBP 59.99.
- [x] **4. DPIA.** `docs/dpia.md` and the new **Legal** folder on Drive, with the
      live privacy policy and terms filed beside it. Six risks with residuals;
      four things named as wave-one blockers.
- [x] **5. Beta agreement v1.1.** Her final text, in `docs/` and in Legal.
      Acceptance is versioned and append-only, same shape as consent.
- [x] **6. Beta feedback.** Built and shipped. Top of More for beta accounts, one
      tap from anywhere via the seed mark, nothing required to press Send, history
      with sent / read / fixed, screenshots in a private bucket.
      `scripts/beta-feedback.mjs` reads and triages.
- [x] **7. Open Actionables: the drinks estimator.** A drink is now measured
      against CoFID rather than estimated, at the write, with the parent totals
      kept in step.

**The queue is empty.** Everything left in Open Actionables needs her.

### 2. The waiting list, answered

**Where:** the `waitlist` table in Supabase, written by a Next.js Server Action on
the landing page. **Not Jotform** - her three Jotform forms are the old Unflump
beta feedback ones and have nothing to do with it.

**How many: one.** Fiona, forestmab@hotmail.com, 2 September 2026.

**Is it live and saving: yes**, and proved rather than assumed. I filled the real
form in a browser on selodia.app, submitted it, saw "You're on the list", and
found the row in the table a second later. Probe row removed. My first attempt -
posting the form with curl - looked like a failure and was not: a Server Action
needs the browser's own machinery, so a plain POST just re-renders the page. That
nearly became a reported bug.

**Why she could not see it.** The table is the only publicly writable one in the
schema: RLS grants INSERT to anyone and **no SELECT at all**. That is the right
way round for a list strangers add themselves to, and the consequence nobody
thought through is that it is unreadable to her too. `node scripts/waitlist.mjs`
now prints it, `--csv` for a sheet.

### 1. Voice latency, and the honest position

**3.3s is not reachable with two sequential calls**, and that is the finding
rather than an excuse. Measured floors: the classify call is ~1.9s with the reply
asked as a fallback, and the writer ~2s at its best. The old path WAS the classify
call, which is why it measured 3.3s.

The variance is the bigger problem: the same writer call measured 3.7s and 7.3s in
one run while producing a fourteen-token reply, so most of the spread is upstream
and not something this code controls.

**What would actually get there: running the two calls at the same time.** On a
turn with nothing for the app to report - most turns - the writer needs nothing
the classifier produces. It needs her message and the record, both of which exist
before the classify call starts. The cost is a discarded call on the turns where
something DID need reporting. Not built; it is a real architectural change and
wants her say-so first.

**Her real turns since the fix are the missing measurement.** The last one before
it was 11:50. Median across her 13 turns today, all pre-fix: 6.6s.

## Session 57, third queue

Her decisions on 28 September, and what each one turned into.

### Queue

- [x] **1. Voice runs the two calls in parallel.** Text stays sequential. Live.
- [x] **2. The email check: why it said that.** It was not a wrong test.
- [ ] **3. Company details in every legal document.**
- [ ] **4. The transfer mechanism in the two providers' DPAs.**
- [ ] **5. Pricing: competitors, overheads, a founding rate, a recommendation.**
- [ ] **6. The waiting list is empty for planning.**
- [ ] **7. ICO: hers, today.**

### 2. The email check - it was not a wrong test, it was no test

She asked which it was, a wrong test or a real fault. Neither. **There was no
check behind that sentence at all.**

What I actually did was reason: the domain is on Vercel for the website, a
mailbox is a separate thing, nobody had mentioned setting one up. Then I wrote
the conclusion into a decision document as something she needed to act on, with
"as far as I can tell" on the front of it - which reads like diligence and is
doing the opposite, because there was nothing to be diligent about.

The check takes one command and the answer is public. The MX records for
selodia.app name `mx1.privateemail.com` and `mx2.privateemail.com`, with an SPF
record naming the same provider. That is the Namecheap forwarding she described.

**The part worth keeping:** her own subscriptions sheet, which I had open that
same afternoon to build the costing document, carries a row reading *"Namecheap
Private Email, paid annual, $17.86/year"* and a note that hello@selodia.app is
the recovery address for the ElevenLabs grant, Firebase, the D-U-N-S and the Play
Console. The answer was in a file I was quoting from. I missed it because I was
filling a slot in a legal template labelled "contact address" and treated the
absence of a mailbox in my own picture of the setup as evidence there wasn't one.

Recorded in `mobile/DECISION_PATTERNS.md`, next to the curl-to-the-waiting-list
one as she asked. The difference between them is the point: a wrong test gives
you a result somebody can reproduce and argue with. An inference gives you a
confident sentence with nothing behind it. **Before writing that something does
not exist, name the check that would have found it, and run that check.**

Nothing was touched. No DNS, no provider, no records.
