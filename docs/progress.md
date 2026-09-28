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

- [x] **1. Voice runs the two calls in parallel.** Text stays sequential. Live,
      measured, and it did not get to 3.3s. Below.
- [x] **2. The email check: why it said that.** It was not a wrong test.
- [x] **3. Company details in every legal document.** And on the two public
      pages, which named the company and stopped there.
- [x] **4. The transfer mechanism.** Both have one. Neither needs a signature.
- [x] **5. Pricing.** Rewritten. **£9 / £79, founding rate £6 / £59.**
- [x] **6. The waiting list is empty for planning.** Both planning documents say so.
- [ ] **7. ICO: hers, today.** Waiting on her word that it is done.

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

### 1. Parallel voice — live, working, and not enough

**It is deployed and the mechanism does what it was built to do.** Nine probe
turns through the real production pipeline, and the speculative reply was used on
**nine out of nine**. The classify call now finishes while the writer is still
going, on every turn measured — it has disappeared from the critical path
entirely, which is exactly what was promised.

**And voice is still about six seconds.** Median 6.3s server-side across the nine
(best 3.4s, worst 7.8s).

**Why, with the phase timings that show it.** A turn now looks like this:

| | |
| --- | --- |
| auth, her row, the record | 0.5–1.7s |
| classify **and** write, at the same time | the longer of the two |
| the classify call alone | 1.8–2.6s |
| **the reply writer alone** | **2.9–6.6s** |

The writer is now the whole critical path, and **it takes longer on its own than
the entire old path did.** The old path's 3.3s was one streamed call. Parallelism
removed the classify call from the sum; it cannot make the writer faster, and the
writer is the bigger of the two by roughly double.

**The remaining lever, and it is yours to call.** The reply is written but not
*sent* until it is complete — the voice adapter waits for the whole thing and
then hands it to ElevenLabs in pieces. It does not have to. The moment the saves
confirm (which the timings show happens 1.9s before the writer finishes, median)
the reply is safe to start speaking, and the rest could stream out as it is
written. **That is worth about 1.9s of the six**, and would put a spoken turn at
roughly 3.5–4.5s to first word.

It is a real change: `ask-selodia` currently returns finished JSON and would have
to return a stream, which the mobile app also consumes. Not something to do
unasked on the same day as the last one. **Shall I?**

**What I did not do, deliberately.** The other way to make the writer faster is to
make the replies shorter, because output tokens are most of the time. The spoken
replies it is producing now are two or three dense sentences. Shortening them is a
decision about how Selodía talks, not a latency fix, and you approved how it talks
this morning — so it is not mine to change.

### 1b. What the parallel call costs

**On the nine probe turns: nothing.** The guess held every time, so the
speculative call *was* the reply and no second call was made.

**That sample flatters it, and the reason matters.** Those nine were all
questions. The guess is discarded when a turn has something to report — a failed
save, a correction, a deletion — and none of them did. A turn that logs food is
exactly the kind that discards.

**When it is discarded, the turn costs one extra reply-writer call: 0.337c**, on
top of a 1.767c chat turn. **+19% on that turn**, and nothing on the turns where
it holds. Voice only; text is untouched.

**So the real number is 0.337c × however often it discards, and that is now
measured rather than guessed.** Every turn logs whether the guess held, and the
route prints the reason when it did not. A week of real voice use will give the
rate. Until then the bound is what can be said honestly: **between 0 and 19% of
the voice turn cost, and nowhere near the top of the bill either way** — the
ElevenLabs grant ending in September 2027 is still the largest number on that
page by an order of magnitude.

### 3. Where the company details went

Selodía Ltd, 19 Campbell Road, London, E17 6RR, company number 12246794,
hello@selodia.app.

- **The beta agreement**, clause 15, and the note at the bottom updated.
- **The DPIA**, in the controller block at the top.
- **The privacy policy and the terms** — both named Selodía Ltd and stopped
  there. The Companies Act and the E-Commerce Regulations want the number, the
  place of registration and the registered office on a company's website, so
  this was a real gap rather than tidiness. Live on selodia.app now.
- **The Legal folder** on Drive: all four documents refiled.

**One deliberate non-change.** `UPDATED` on the privacy page is still 19
September, and it should be. That field is what re-asks every existing user to
confirm their consent, and the statutory particulars change neither what is
collected nor who sees it. **Making the whole userbase re-consent to learn
Selodía's postcode is the wrong trade**, and the reason is written into the file
so nobody tidies it later. The terms carry no consent version, so they are dated
today.

**The version date on the agreement is still blank, on purpose.** Your rule is
the day it is first shown to a tester and that day has not come. It is filled by
`node scripts/beta-agreement-date.mjs`, which reads the date from the earliest
grant in `beta_members` rather than from whoever is typing.

**Worth telling you, because it caught me out.** The first run of that script
dated the agreement from *your* beta grant — made this morning so you could see
the feedback screen. You are in the beta and you have never been shown the
agreement; they are not the same fact. The script now excludes the founder, and
why is written at the top of it.

### 4. The transfer mechanism — both have one, neither needs signing

| | Mechanism | How it attaches |
| --- | --- | --- |
| **Anthropic** | EU SCCs Module Two at section I.1, **plus the UK Addendum** at Schedule 3 section B, which applies to any processing subject to UK GDPR. | The DPA "is incorporated into and forms part of the Anthropic Commercial Terms of Service". Accepting the terms accepts it. **No form.** |
| **ElevenLabs** | SCCs at 11.1, **UK Addendum completed at 11.4**, EU–US Data Privacy Framework offered as an alternative at 11.1(i). | "shall be deemed executed upon this DPA taking effect". **No signature.** |

Read from the processors' own current documents, not from a summary of them.
Recorded in section 3 of the DPIA, and **it closes the fourth wave-one blocker**
— three left: leaked-password protection, password reset proved on a phone, and
a breach-response procedure.

**Two things I could not establish, and have said so rather than guessed.**
Whether either company is certified under the Data Privacy Framework and whether
that certification carries the UK Extension — the public list did not answer it
today and the secondary write-ups contradict each other. It does not matter for
the mechanism. And a **transfer risk assessment**, which is the documented
judgement that the clauses are effective given US surveillance law: not done, and
a solicitor's job rather than mine.

**The other three processors are not settled by this.** Supabase is in an EU
region and Vercel in London, but both companies are American and support access
is itself a transfer. That is processor due diligence, and it is a separate line.

### 5. Pricing — £9 a month, £79 a year, founding rate £6 / £59

*2026-09-28 Running costs and pricing* is rewritten from section 6 down. Round
numbers, no .99.

**You were right that £7 was too low, and the overheads table is why.** Running
cost per user is flat — £2.12 whether there are a hundred users or ten thousand.
**The company's own costs are not.**

| Subscribers | True cost per user/month |
| --- | --- |
| 25 | **£5.95** |
| 100 | **£3.08** |
| 1,000 | **£2.24** |
| 10,000 | **£2.13** |

About £1,150 a year of overheads — Apple's £79, ICO £52, Companies House £34,
EAS £180, Claude £170, email, domain, storage, and an estimated £600 for an
accountant — plus about £1,200 once for the solicitor. At 25 subscribers that is
£3.83 a head a month on top of the running cost. **The first year is spent in the
top of that table, not the bottom.**

**Break-even on the overheads alone at £9: about 19 subscribers held for a year.**

**What the market charges.** Nothing comparable is under £45 a year except
MyFitnessPal, which has two hundred million downloads to spread its costs across.
Balance+ — same audience, same stage of life — is **£9.99 a month, £89.99 a
year**, and nobody finds that outrageous. The AI companions run £53–£81 a year.
Selodía is in all three categories at once and costs more to run than any of the
trackers, because every turn is a conversation with a model rather than a
database lookup.

**Why £9 and not £10.** They are the same decision to a customer and different
decisions to you. £9 reads as "under a tenner". The extra 85p is not worth that
threshold on a first product with no reviews.

**The founding rate is what lets you launch at £9 at all.** £6 a month or £59 a
year, kept for good, for everybody who subscribes in the first three months. Both
stay profitable. It means you can put the real price on the page from day one —
which you can never do later without a rise that reads as a betrayal — while the
people who took the risk early pay what it was worth when they took it. **Your
beta testers should be in that cohort without having to ask.**

**One thing to write down somewhere that is not a document.** A grandfathered
price means keeping a legacy product ID alive indefinitely on both stores. Five
minutes now, confusing in three years.

**The number that has not moved.** A heavy user costs £11.88 a month in models
and at £9 you receive £7.65. **No sensible price covers a heavy user monthly** —
it would take about £14. The answers are still: instrument cost per user, make
the heavy path cheaper, push annual.

**Decision is yours. Nothing is built.**

### 6. The waiting list, treated as empty

Fiona is your sister, so the list has nobody on it for planning purposes. Both
places that assumed otherwise now say so:

- *Billing, complimentary access and wave one* — route 3 was listed as a slow
  source of testers. It is now written as the route that keeps working **after**
  wave one, and explicitly not a source for it.
- The Open Actionables.

**Which leaves route 1 as the plan**: ask each of Lynda, Carol, Nikki and Auguste
for two names. Four people, four circles, eight strangers who arrive with some
trust already attached. That gets most of the way to twelve.

### And then, with the queue empty: two Open Actionables that did not need you

**Cost per user is counted now, not modelled.** The costing document's own
"highest-value item on the page". Every Anthropic response already carried its
usage and the route printed it to a log and threw it away.

- `model_usage` takes a row per call: the tokens **and** the cost priced at the
  rates of the day. Both, deliberately — storing only tokens would silently
  re-price last quarter every time Anthropic changes a number.
- Counted: the classify call, the reply writer **on both outcomes** (a fallback
  is the most expensive turn there is — the writer's tokens and then the old
  path's on top), and the three Haiku parses. Not counted, and the reader says
  so: the allergy gate's layer-4 check, which would mean threading a user id
  through a safety signature for accounting, and the report writer.
- `node scripts/cost-per-user.mjs` reads it. **Written before the table had
  anything in it**, because the waiting list spent twenty-six days behind a
  permission rule with nobody able to read it.
- Eight checks on the arithmetic, each proved able to fail.

**It did not work the first time, and the reason is worth keeping.** Not one row
arrived. The insert was started and never awaited, and a serverless instance is
entitled to freeze the moment the response is sent — so the write began and then
the machine running it stopped existing. `after()` fixes it. **Same shape as the
curl test on the waiting list**: right about what the code asked for, wrong about
the machinery underneath.

**The first four real rows already say something**: the classify call is 81% of
the bill, which is what the model assumed, and it came in at 2.28c a call against
the modelled 1.43c because those turns carried more fresh input. One person is
not a sample. It is a start.

**A breach-response procedure**, which was one of the DPIA's wave-one blockers.
`docs/breach-response.md`, and in the Legal folder. What counts and what does
not, the first hour, the 72-hour clock — which starts at *awareness*, not at
understanding — when the people affected are told, and the contacts. Nobody reads
a procedure for the first time while that clock is running.

**Wave one now has two blockers rather than four**, and both are yours: the
leaked-password setting in Supabase, and password reset proved end to end on a
phone.

## Session 57, fourth queue

### Queue

- [x] **1. Stream the spoken reply, behind a switch. Measure after.**
- [x] **2. Pricing: the founding rate kept for good, against capping it.**
- [x] **3. The leaked-password setting: exactly where, and does it need a paid plan.**
- [x] **4. Delete BotanicalMark.** Already gone.
- [x] **ICO becomes a wave-zero blocker.**

### 1. Streaming — live, measured, and honest about what it bought

**The switch is `REPLY_STREAMS_TO_VOICE` in `app/lib/chat-path.ts`.** One line.
Set it false and a spoken turn goes back to waiting for the last word before the
first one is heard. Nothing else changes.

**How it works without touching the route.** The voice adapter calls
`ask-selodia` in process, so rather than turn the reply into a streaming response
— which would have meant restructuring the offer line, the allergy gate and the
one-reply-per-turn insert, all load-bearing and none of it about streaming — the
words are pushed into a sink the adapter is already holding. The route still
assembles, gates and stores the whole reply exactly as before.

**Nothing is spoken until three things are true**, all checked before a word goes
out: the turn is ordinary, the guess held so there is nothing to report, and the
allergy gate *cannot arm on this account*. That last one is decided before the
reply is written — the gate short-circuits for anybody with no food exclusions —
so words already spoken can never need taking back. Everybody else waits.

**What it actually bought, and my estimate was wrong.** I told you about 1.9s.
The first version measured **124ms** on a median turn.

The estimate came from "writer finishes minus saves confirm", which is a real
gap, but it assumed the writing would be *spread* across it. It is not: almost
all of that time is spent before the first sentence exists. There was nothing to
say early because nothing had been written yet.

**So the cut moved from a sentence to a clause** — a comma, semicolon or dash
with at least 35 characters in front of it, which is about two thirds of a second
of speech. The pauses land where a person pauses anyway.

| | Median | Best |
| --- | --- | --- |
| Waiting for a full stop | 124ms | 806ms |
| **Cutting at a clause** | **680ms** | **2,535ms** |

**Why that table and not "first word went from X to Y".** Total turn time swung
between 4.0s and 7.8s across samples on the same harness within an hour, for
reasons upstream of this code. A median across runs describes the day. The gap
between the first word and the last is a *within-turn* measure, and says what
streaming did on that turn whatever the turn cost overall. First words measured
4.1s and 5.4s on two ten-turn samples — real, and not a stable figure I would
quote at you as a before-and-after.

### The thing I found while doing it, and it is the important one

**The rebuilt reply was never going through the allergy gate.**

`runAllergyGate` runs on the reply the *old* path wrote, and `turnIsOrdinary`
only asks whether that one passed. The rebuilt path then replaces it with a
completely different sentence, and that sentence went straight to
`chat_messages`. So for anybody with a declared food allergy, **the check was
being done on a draft that was then thrown away** — which is worse than no gate,
because the turn is recorded as having been gated.

It survived a typecheck, a lint and a day of use. Nothing about it is visible in
the shape of the code: both branches assign to the same variable and only one of
them had been checked.

Fixed. `scripts/check-gated-paths.mjs` reads the route and fails if
model-written words reach the reply without a gate in front of them — proved
against the shipped code, where it reports this exact bug.

**Nobody was affected.** The only account with allergies recorded is yours, and
both of yours are non-edible (nickel, hay fever), so the gate would not have
armed anyway. That is luck, not design.

### And a second one, from the security advisor

**A backup of your chat messages was readable by anyone, for a day.**

`chat_messages_duplicates_removed` was created yesterday to hold the duplicate
assistant rows before deleting them. Backing them up first was right. What was
missed is that a table created in `public` is served by PostgREST, and without
row-level security the **anon key** reads it — the key that ships inside the
mobile app and the landing page's own JavaScript.

Closed, and verified closed rather than assumed. `scripts/check-rls.mjs` now
tries every one of the 43 exposed tables with that key; none of them returns a
row. It is proved able to fail: a table with one harmless row was created
without RLS, the check named it and exited 1, and it was dropped.

### 2. The founding rate, kept or capped

In section 8 of the pricing document. The short version:

**Forgone revenue is not the number that matters.** Fifty founding members at £6
against £9 is £127.50 a month, £1,530 a year. But those fifty would not all have
subscribed at £9 — a founding rate is the price at which some of them said yes at
all. If a third joined *because* of it, kept-for-good is revenue positive from
the first month.

**Recommendation: kept for good, capped at 100 places.** It costs almost nothing
in the realistic case, removes the tail risk in the unlikely one, gives a true
scarcity line, and needs no machinery beyond a second product ID.

**Not the 12-month cap** — and not because of the money, which is the cheapest of
the three. "Founding member" is a phrase with a meaning, and a price rise in
month 13 lands on precisely the people who took the risk earliest. It also needs
*more* machinery, not less: something has to notice each anniversary.

### 3. The leaked-password setting

**Where:** Supabase dashboard → your project → **Authentication** → **Sign In /
Providers** → the **Email** provider → *Prevent use of leaked passwords*.
Supabase's own advisor names it `auth_leaked_password_protection` and confirms it
is currently **disabled**.

**It needs a paid plan.** Supabase's documentation: *"Leaked password protection
is available on the Pro Plan and above."* **Pro is $25 a month**, including $10
of compute credit, 8 GB disk and 100 GB file storage — all far above what Selodía
uses today on the free tier.

**So this is a £20-a-month decision, not a toggle, and it is yours.** What it
buys: a new password is checked against HaveIBeenPwned and refused if it appears
in a known breach. What it does not buy: anything for existing passwords, or for
somebody who reuses a password that has not leaked *yet*.

**I have changed nothing.** Two things worth weighing:

- It is named in the DPIA as a wave-one blocker, which I wrote. On reflection
  that is too strong: it is a real improvement and it is not the difference
  between lawful and unlawful processing. **A dozen beta testers is a defensible
  time not to have it**, and I would rather say so than have you pay $25 a month
  because a document I wrote called it a blocker.
- Pro also brings 7-day log retention, which would have made this afternoon's
  debugging materially easier. Vercel's free tier keeps nothing, and twice today
  I could not answer a question because the logs were gone. **That is a better
  argument for Pro than the password check is.**

### 4. BotanicalMark

Already gone — deleted earlier in Session 57. Nothing named botanical remains
anywhere in the repository.

### ICO, moved to a wave-zero blocker

Recorded in the spec, the DPIA and the Open Actionables. **It is the only thing
blocking wave zero**, and it is the one item the wave-zero reasoning does not
reach: everything else on that list can be carried by hand because you know Nikki
and Carol, and this is owed to a regulator that does not care how well you know
them.

## Session 57, fifth queue

- [x] **Wave-zero gate** at the top of the beta checklist.
- [x] **BetterMe** in the pricing research, with the positioning contrast.
- [x] **Feature gap analysis and the meal-suggestion design**, with three worked
      examples from your real data.
- [x] **Copy review**, three headline options.
- [x] **Exercise library audit**, coverage table, gaps, four options compared.
- [x] **Refinement pass**, 23 items in priority order.
- [x] **Logs kept in our own database**, so Supabase Pro can wait.

All six pieces are in **2026-09-28 Before wave zero - six pieces of research**
in Build Specs, with a one-page summary at the top. Nothing in it is built.

### The answer on Pro: yes, we can keep them ourselves

`turn_diagnostics` now records the phase marks on every turn and the two
failures the route catches after the model call. Fallbacks already had their own
table. `node scripts/turn-log.mjs` reads all three:

    voice   2 turns   median 6512ms   90th 6512ms   worst 6512ms

    WHERE THE TIME GOES, median per phase
      replyWritten      2456ms
      modelAnswered     1785ms
      contextLoaded     1082ms
      userRowWritten     787ms

And `--turn <id>` gives one turn across all three tables, including what its
model calls cost. **That is more than Vercel's free tier could ever give**, which
retains nothing, and more than Pro's seven days, which expire.

**So Pro is not needed for logs.** It would still buy the leaked-password check,
which you have agreed is not a wave-one blocker.

**One number worth noticing**, now that it is measured rather than modelled: that
turn's model calls cost **2.998c** against the 1.77c in the pricing document.
Two turns is not a sample, but it is the first sign that the model was
optimistic, and `scripts/cost-per-user.mjs` will say properly within a week.

## Overnight queue

Written 28 September 2026, evening, from her batch prompt. **In her priority
order: section 3, then 4, then 2, then 1, then the build work still in flight.**

A Stop hook (`scripts/overnight-stop-hook.mjs`) reads this section when the turn
tries to end and pushes on to the next unticked item. Items marked **blocked**
are skipped. Deleting this heading, or creating `.claude/overnight-off`, ends
the run.

**Each item is split into steps below it.** Tick as you go, so an interruption
loses nothing.

### Section 3 — onboarding and plans (highest priority)

- [x] 3a. Audit current onboarding against spec Part Seven and the live code: what each step asks, what it writes, what is broken, what is never persisted **Done.** Onboarding never sets the focus states, so everyone leaves on a maintenance target whatever they said.
- [x] 3b. Map the built machinery: focus states, My Week, My Plans, ladders, My Rules, execution view, notifications, Plans tab **Done.** My Week, My Rules, My Plans by goal and the ladder are SPEC ONLY - not one identifier in the code. Plans tab already exists.
- [x] 3c. Propose the new tap-based onboarding screen by screen, with exact wording and what each answer drives **Done.** Nine screens drafted with exact wording and what each answer writes.
- [x] 3d. Propose the Plans tab, sessions, start-session mode, quick session, exercise library, and where food sits in the plan **Done.**
- [x] 3e. Rewrite principle 3 and Part Eleven (Graduation): never trap, build literacy, support for life **Done.** Proposed wording written.
- [x] 3f. Rewrite principle 9: reactive by default, scheduled when the user asks **Done.** Proposed wording written.
- [x] 3g. Spec: Plans out of Almanac into its own tab; information architecture matched to the app; My Week and My Rules given a clear home **Done** - proposed in the document; the spec edit itself is below.
- [x] 3h. Spec: note that the Exercise Animatic clips are animations of muscles, not photographs, so principle 16 holds **Done** - proposed; spec edit below.
- [x] 3i. Decision patterns: "goals are welcome, shame is not" **Done** - proposed; pattern written below.
- [x] 3j. Say what exists, what changes, what is new, and what would break **Done.**

### Section 4 — menopause and perimenopause

- [x] 4a. Research from NICE, the British Menopause Society and the NHS, with citations **Done.** NICE NG23, NHS and two BMS/WHC factsheets, with figures.
- [x] 4b. Audit cycle tracking, cycle day, phase interpretation, period logging, roundups and chat for irregular cycles, no periods, and HRT **Done and demonstrated.** A woman five years post-menopause is described to the model as "cycle day 1826, luteal phase", with her weight explained as water retention. scripts/probe-cycle-no-periods.mjs proves it.
- [x] 4c. Competitors: Balance and one or two others, and where Selodia could do better **Done.** Balance, Stella, Health & Her - all three silo symptoms away from food, sleep and movement.
- [x] 4d. Propose life-stage and HRT onboarding questions, symptom logging, how interpretation and targets adapt, and landing/store copy **Done.** Life stage and HRT questions, a hard 45-day bound, symptom taps, and copy.

### Section 2 — pricing re-model

- [x] 2a. Re-model at GBP 12 and GBP 15, annual GBP 99-120, founding GBP 8 / GBP 79 for the first 100 **Done.**
- [x] 2b. Use the real measured cost per turn (~3p, not 1.77p), heavy users included, plus overheads; margin and break-even at each price **Done.** Measured 3.30c a turn, not 1.77c. All-in GBP 3.87 at 1,000 subs, GBP 7.53 at 25.
- [x] 2c. Model Nikki's market reality: GBP 10 for a yoga app with five videos, GBP 2 for tracking. What Selodia needs to feel worth more than a tracker in week one **Done.**
- [x] 2d. What a fuller library and guided sessions would change, and what they would cost **Done.**
- [x] 2e. Draft the wave-zero willingness-to-pay questions **Done.**
- [x] 2f. Recommend a price **Done.** GBP 12 / GBP 120, founding GBP 8 / GBP 79. Break-even 15 subscribers.

### Section 1 — brand rule and evidence

- [ ] 1a. Add the new BetterMe evidence to the pricing/positioning research and the article capture: the second email, the "as featured in" change, the goal contradiction, the body-fat labels
- [ ] 1b. Record "Premium means restraint" as a standing brand rule in the decision patterns and the build spec
- [ ] 1c. Check the landing page, onboarding and any existing emails against those rules and list what breaks them

### Still in flight from the earlier prompt

- [x] F1. **Done.** Not a data bug: the route computes 1,760 kcal and 83-99g correctly and the writer receives them. The MODEL denied figures it had, because nothing was logged yet. One clause added to the what-to-eat rule, deployed and verified live.
- [ ] F2. Add the three meal-suggestion examples to the chat test set as permanent cases
- [ ] F3. Fix the blank space where a plan exercise has no demonstration clip
- [ ] F4. Fix the stale line in the build spec about there being no video player
- [ ] F5. Full close-out: build log, article log, decision log, build spec, beta checklist, Open Actionables, final summary with file times

### Waiting on her, not blocking anything

- [ ] **blocked on Ruth** — the calisthenics progression tree, gap list and Exercise Animatic email: she asked to see them before sending, and they are drafted in the previous research document
- [ ] **blocked on Ruth** — the revised landing page, store listing and onboarding copy: approved in principle, and she asked to see the full revision before it goes live
- [ ] **blocked on Ruth** — refinement items 1-4 (the loading, error and retry pattern): she said to stop after 6, 7 and 9 until her test week is done
