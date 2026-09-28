# Data Protection Impact Assessment — Selodía

**Controller:** Selodía Ltd, 19 Campbell Road, London, E17 6RR
**Company number:** 12246794 · **Contact:** hello@selodia.app
**Version 1.0 · 28 September 2026 · first draft, not yet reviewed**
**Review:** yearly, and whenever anything new is collected.

**Status.** This is written from what the app already does, not from what it might. It is a first draft by somebody who is not a lawyer, and it goes to a solicitor with the terms, the privacy policy and the beta agreement at 100 subscribers. **It is required before wave one** — not because the ICO will ask for it, but because it is the document that makes the risks legible while the app is still small enough to describe.

**Why it exists.** A DPIA is required before processing likely to result in high risk, and the ICO's own triggers include large-scale processing of special category data and health data. Selodía's core activity is exactly that in kind. Most of the substance already existed, scattered across the retention policy, the consent records, the export and erasure work and the decision to store health markers as statuses; what did not exist was the document pulling them together.

---

## 1. What the processing is

Selodía is a body-literacy app for women over 40. People log what they eat, how they move, how they sleep, their weight and body composition, their cycle, how they feel, and anything they want to say about it — much of it in conversation with an AI that answers from their own record.

**The purpose is that record.** Not advice, not a programme, not a target: a trustworthy account of somebody's own body over time, and a companion that can only say what is in it.

**Lawful basis.** Consent (Article 6(1)(a)) for the processing, and **explicit consent (Article 9(2)(a))** for the health data, which is the whole product. Consent is recorded in `consent_records`, append-only, versioned, and re-asked when the policy version changes.

**Nobody is profiled into a decision.** There is no automated decision-making with legal or similarly significant effects. The app describes and observes; it does not gate anything on what it finds.

## 2. What is collected

39 tables. The ones that matter here:

**Special category (health) data**
`body_measurements`, `personal_metrics`, `food_logs` and `food_items`, `activity_logs`, `daily_activity_summaries`, `sleep_logs`, `hydration_logs`, `cycle_events` and `cycle_days`, `daily_ratings` (mood and energy), `health_context`, `allergies`, `almanac_entries` (symptoms, insights, protocol cards), `interpretation_notes`, `workout_completion_log`, `workout_weight_log`.

**Conversation** — `chat_messages`, which is free text and routinely contains health information, family details and whatever else somebody chose to say.

**Ordinary personal data** — `user_profile` (name given voluntarily, not read off an email address), `push_tokens`, `reminder_settings`, `custom_reminders`, `user_context`, `waitlist`.

**Operational** — `client_error_log`, `reply_path_fallbacks`, `feedback_reports` (no logged data, only what was typed plus the build context), `me_exports`, `report_exports`.

**Archives of removed data** — `deleted_records`, `food_logs_removed`, `body_measurements_removed`, `chat_messages_duplicates_removed`. These exist because removing something from a body record without a copy has already cost accuracy once, on 24 September 2026. They are covered by deletion: erasing an account erases these too.

**Reference data, no personal content** — `food_composition` (CoFID, Crown copyright, OGL v3), `food_cache`, `movement_assets`, `movement_aliases`.

**Not collected:** no photographs of bodies, ever (Principle 16). No raw lab values — health markers are stored as **statuses**, deliberately, so the app never computes a clinical threshold. No location. No contacts. No advertising identifiers.

## 3. Who it goes to, and where

| Processor | What reaches them | Where |
| --- | --- | --- |
| **Supabase** | Everything. Database, auth, file storage. | EU region |
| **Vercel** | Requests in transit; the API runs here. Logs are not retained on the current tier. | `lhr1`, London |
| **Anthropic** | The conversation turn: her message, recent history, and computed facts about her record. **Not the whole database** — each turn carries a bounded window. | US |
| **ElevenLabs** | Spoken audio and transcripts, for voice conversations only. | US |
| **Backblaze B2** | The exercise clip library. **No personal data at all.** | US |
| **Apple / Google** | Subscription and payment data, once billing exists. Selodía never sees a card. | Various |

### International transfers — checked, 28 September 2026

Anthropic and ElevenLabs are US processors, so personal data leaves the UK on
every chat turn and every spoken one. **Both have a UK transfer mechanism, and
both apply without Selodía signing anything.** Read from the processors' own
current documents rather than from a summary of them.

| | Mechanism | How it attaches | Sub-processors |
| --- | --- | --- | --- |
| **Anthropic** | EU SCCs Module Two (Controller→Processor), incorporated by reference at section I.1, **plus the UK Addendum** at Schedule 3 section B, which applies "to any processing of Customer Personal Data that is subject to the UK GDPR". | The DPA "is incorporated into and forms part of the Anthropic Commercial Terms of Service". Accepting the Commercial Terms accepts the DPA. **No form, no signature.** | anthropic.com/subprocessors. **15 days** to object to a new one. |
| **ElevenLabs** | SCCs at section 11.1, **the UK Addendum completed at section 11.4**, and the EU–US Data Privacy Framework offered as an alternative basis at 11.1(i). | Section 11.1: the SCCs "shall be deemed executed upon this DPA taking effect". **No separate signature.** | compliance.elevenlabs.io. **30 days'** notice before a new one, with a right to object on data-protection grounds. |

**Two things this does *not* establish, stated rather than glossed.**

1. **Whether either company is certified under the Data Privacy Framework, and
   whether that certification carries the UK Extension.** The public list at
   dataprivacyframework.gov did not answer it either way today, and secondary
   write-ups contradict each other. It does not matter for the mechanism — the
   SCCs and the UK Addendum stand on their own — so it is recorded as unknown
   rather than assumed either way.
2. **Transfer risk assessments.** Having the clauses is the first half; the UK
   GDPR also expects a documented judgement that the clauses are effective given
   US surveillance law. Not done, and it belongs with the solicitor at the
   100-subscriber review rather than here.

**Anthropic's retention and training position**, since it bears on the risk
rather than the mechanism: the DPA's stated purpose is providing the service,
and it does **not** authorise using customer inputs to train models — that would
need a separate agreement. On termination, deletion within 30 days.

**The other three are not settled by this.** Supabase (EU region), Vercel (London)
and Backblaze were not checked today and are not in the same position: their data
stays in region, but the companies are American and support access is itself a
transfer. That is the *processor due diligence* line below, not this one.

**Nothing is sold, and nothing trains anybody else's model.** Stated in the terms, the privacy policy and the beta agreement.

## 4. Necessity and proportionality

**Could it be done with less?** Genuinely not much. The record *is* the product, and an app that says things about somebody's body from their own record must hold that record. What has been cut is real, though:

- **Health markers as statuses, not numbers.** Selodía knows somebody has been told their cholesterol is high; it does not hold 5.8 mmol/L. That was a design decision, not an omission.
- **A bounded window to the model.** Seven days typed, three spoken, plus a six-month summary of scale readings and daily calories. A turn does not send a life.
- **Step permissions trimmed** on 19 September: distance and exercise were requested and never read, so they were removed.
- **Analytics deliberately deferred** (item 50) until there are users and a consent screen for it.
- **No photographs of bodies.** A standing principle, not a current limitation.

**Retention is indefinite, deliberately** (Part Seventeen), so longitudinal research is possible later from real data rather than starting fresh. **This is the assessment's most arguable decision.** It is defensible because deletion is genuinely available at any moment and nothing is kept after it — but "we keep it forever unless you ask" is a position that needs to be stated in plain words to the person, and it is, in the privacy policy.

**Research use requires a separate, explicit opt-in**, never bundled into consent to use the app. User-facing language says **de-identified**, never "anonymised", because rich conversational health data in a small dataset is genuinely hard to make untraceable and overpromising it would be the trust break it was meant to avoid.

## 5. The risks, and what is actually done about them

### 5.1 The app says something untrue about somebody's body
**The highest-likelihood risk, and it has happened.** On 27 September the chat explained a weight rise with "you had a hard session a day or two ago" over a log holding two minutes of pushups, and said 1.4 kg where the screen said 1.3.

**Harm:** somebody changes what they eat or how they train on a claim about their own body that nothing supports. For this audience, on this subject, that is not a small harm.

**Mitigations, all built:** every number computed in code and rounded as the screen rounds (`turn-facts.ts`); an absence stated explicitly rather than inferred from a short list; a test set that fails if a weigh-in with no activity produces an exercise claim; and a prompt rebuilt so a rule earns its place by a test failing.

**Residual: medium.** It is reduced, not eliminated, and it is checked rather than assumed.

### 5.2 Distress disclosed in conversation
Somebody logging food daily will eventually say something about eating, their body or their life that matters.

**Mitigations:** a safety classifier on every turn; a deterministic escalation ladder with a C-SSRS screening question that the model cannot rewrite; resource cards chosen in code, never named by the model; and — since 28 September — a whitelist ensuring the rebuilt reply path never touches a distress turn.

**Residual: medium.** It is an architecture rather than an instruction, which is the right shape. It is not a crisis service and does not claim to be.

### 5.3 Food suggested that somebody is allergic to
**Mitigations:** four layers (`allergy-gate.ts`) — a prompt block, a structured self-report, a deterministic name match, and a gated model check for composite dishes. Since 28 September an allergy also carries a **kind**, so only what can be eaten arms the food filter.

**Residual: low**, with a caveat: the gate has misfired in the *other* direction, blocking plain answers to questions about an allergy. Fixed on 28 September.

### 5.4 A breach of the database
The worst case on the page. Free-text conversations about somebody's body, cycle and health, tied to an email address.

**Mitigations:** row-level security on every table with personal data, scoped to `auth.uid()`; the service role never in a client; the `waitlist` deliberately write-only; RLS policies reviewed and the performance and security advisors run (23 September); expired copies removed on a schedule.

**Gap:** **leaked-password protection is a Supabase setting that is still off**. A breach-response procedure now exists — `docs/breach-response.md`, and the Legal folder — covering what counts, the first hour, the 72-hour clock, when the people affected are told, and who to contact. Written on the principle that nobody reads a procedure for the first time while the clock is running.

**Residual: medium-high**, and it is the risk where more work is worth doing.

### 5.5 Data lost or silently wrong
Not a privacy breach in the textbook sense, and for this product it is the same trust failure. It has happened repeatedly: a litre of water lost, a thigh measurement acknowledged and never stored, thirteen hours of replies discarded by a failed insert.

**Mitigations:** `save-honesty.ts` states what actually happened to the data before the model writes; archive tables before any removal; a one-reply-per-turn database constraint; fallbacks recorded and countable.

**Residual: medium.** The direction is consistently towards saying what happened rather than assuming.

### 5.6 Somebody cannot get back in, or get out
**Mitigations:** export and erasure brought up to the schema (19 September); deletion reachable without the app at selodia.app/delete-account; nothing retained after deletion, including the auth credential.

**Gap: password reset is built and not yet proved on a phone**, and two Supabase settings are outstanding. **A wave-one blocker.**

## 6. What is not done yet

| | Priority |
| --- | --- |
| **ICO registration** — tier 1, £52. Being done 28 September 2026. | Done today |
| **Leaked-password protection** — a Supabase setting, possibly paid. | **Before wave one** |
| **Password reset proved end to end on a phone.** | **Before wave one** |
| ~~International transfer mechanism for Anthropic and ElevenLabs~~ — **done, 28 September.** SCCs plus the UK Addendum in both DPAs, both automatic. Section 3. | Closed |
| **A transfer risk assessment** for the two US processors — the clauses are in place, the documented judgement that they are effective is not. | 100-subscriber review |
| ~~A breach-response procedure~~ — **done, 28 September.** `docs/breach-response.md`. | Closed |
| **Whether a DPO is required.** Core activity is large-scale special category processing *in kind*; "large scale" at a handful of testers plainly is not, and where the line sits I could not establish. | 100-subscriber review |
| **Processor due diligence** recorded for each of the six above. | Before public launch |
| **Analytics and its consent screen** (item 50). | When it is built |

## 7. Conclusion

**The processing is high risk by nature and proportionate in practice**, on the strength of five things: a bounded window rather than a whole record sent to any model; statuses rather than clinical values; deletion that genuinely removes everything; research separated from use by its own opt-in; and safety implemented as architecture rather than instruction.

**Two risks are not closed and are named above**: the database breach case, and the model saying something untrue about somebody's body. The transfer mechanism was the third and is now closed — both US processors carry the UK Addendum, and neither needed Selodía to sign anything. What is left of it is the transfer risk assessment, which is a solicitor's job.

**Nothing here blocks wave zero** — two people the controller knows personally. **Two things block wave one** and are marked: **leaked-password protection**, a Supabase setting, and **password reset proved end to end on a phone**. Both are hers — the code for the second is shipped and cannot work until two settings are changed with a personal access token.

---

*Drafted 28 September 2026. Sources: the build specification (Parts Twelve, Seventeen, Eighteen, Nineteen, Twenty), `SAFETY_ARCHITECTURE.md`, the privacy policy at selodia.app/privacy, and the schema as it stood on 28 September 2026 — 39 tables, listed in section 2.*
