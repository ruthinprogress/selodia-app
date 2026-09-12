# Selodía — Store Submission

*Started 10 September 2026. The working document for getting Selodía onto Google Play. Operational rather than conceptual: forms to fill in, answers to copy, copy to approve. The **reasoning** behind the route lives in `SELODIA_SPEC.md` Part Sixteen under "Google Play submission"; this is the thing you sit beside the Play Console with.*

*Every answer below was written from the actual database tables and the actual third-party calls, and must stay consistent with the live privacy policy at **selodia.app/privacy**. Google compares the two, and a Data Safety form that contradicts the policy is a rejection.*

---

## 1. Data Safety — the answers

Google's Data Safety form asks, for each data type: is it **collected**, is it **shared**, is it **processed ephemerally**, is it **required or optional**, and **why**. "Shared" has a specific meaning — transferred to a *third party*, which does **not** include a service provider processing on your behalf. Supabase, Anthropic, ElevenLabs and Expo are all processors, so the honest answer to "shared" is **No** throughout.

**Overall answers**

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all user data encrypted in transit? | **Yes** |
| Do you provide a way for users to request data deletion? | **Yes** — in-app, Settings → Delete my account |
| Is data processed ephemerally only? | **No** — it is stored, because the product's value is history |
| Is any data collected from children? | **No** — the app is for adults |

**Data types — declare exactly these**

| Category | Type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|---|
| Personal info | Email address | Yes | No | Required | Account management |
| Personal info | Name | No | — | — | Not collected |
| Personal info | Other info (date of birth, biological sex) | Yes | No | Optional | App functionality — used to derive metabolic estimates |
| Health and fitness | Health info | Yes | No | Optional | App functionality — body measurements, conditions and markers the person discloses, menstrual cycle dates, allergies |
| Health and fitness | Fitness info | Yes | No | Optional | App functionality — activity, duration, intensity, step counts where permission was granted |
| Photos and videos | Photos | Yes | No | Optional | App functionality — food photographs the person chooses to send |
| Messages | Other in-app messages | Yes | No | Required | App functionality — the conversation is the product's primary interface |
| Audio | Voice or sound recordings | **No** | — | — | Audio is processed to produce a transcript and is not retained. **Declare the transcript under Messages, not here.** |
| App activity | Other actions | Yes | No | Optional | App functionality — saved plans, insights, notes |
| Device or other IDs | Device or other IDs | Yes | No | Optional | App functionality — a push token, only if reminders are turned on |

**Not collected, and worth stating so nobody assumes otherwise:** location of any kind, contacts, calendar, files and docs, browsing history, search history, installed apps, purchase history, credit info, payment info, race or ethnicity, political or religious beliefs, sexual orientation, financial info, and any advertising or analytics identifier. **There is no third-party analytics SDK and no advertising SDK in the app at all.**

**The one to get right.** *Voice or sound recordings* is tempting to tick because the app has a voice mode. Audio is streamed to ElevenLabs, converted to text, and not stored by Selodía — what persists is the transcript, which is a message. Ticking "audio collected" implies stored recordings and would contradict the privacy policy. **Confirm ElevenLabs' retention settings for this account before finalising**, because that sentence depends on them.

---

## 2. App content declarations

| Declaration | Answer |
|---|---|
| Privacy policy URL | `https://selodia.app/privacy` |
| Ads | **No ads** — the app contains no advertising and no ad SDK |
| App access | **All functionality available without special access** — but testers need an account; supply Google with test credentials if asked |
| Content rating | Complete the questionnaire: no violence, no sexual content, no profanity, no gambling, no user-to-user communication, no location sharing. Expect **PEGI 3 / Everyone**. It references health and fitness but does not provide medical advice. |
| Target audience | **18 and over.** Do not select any child age band — it changes the policy regime substantially and the app is not designed for it. |
| News app | No |
| COVID-19 contact tracing | No |
| Data safety | Section 1 above |
| Government app | No |
| Financial features | None |
| Health apps declaration | **Read this one properly.** Google asks whether the app provides health-related features. It does. It does **not** provide diagnosis, treatment, or medical advice, and the in-app disclaimer already says so. |

---

## 3. Store listing

**App name (30 characters max)**

> Selodía

**Short description (80 characters max)**

> Your body isn't a problem to solve. It's something to get to know.

*(65 characters. It is the tagline, which is confirmed copy in the marketing spec.)*

**Full description (4000 characters max) — draft, needs Ruth's approval**

> Selodía is a body-literacy app for women in their forties and beyond.
>
> Most tracking apps are built to make you smaller. This one is built to help you understand what your body is actually doing — how it responds to what you eat, how you move, where you are in your cycle, and what a difficult week does to a number on a scale.
>
> **You talk to it.** There are no forms to fill in and no dropdowns to hunt through. Say what you ate the way you'd say it to a friend, and it works out the rest. Log a walk, a reading from your scales, or how you slept, in your own words.
>
> **It notices things over time.** A single day tells nobody anything. Selodía looks across weeks — what you logged, what you measured, what you told it about how you were feeling — and points out patterns that are yours rather than general advice.
>
> **It never tells you off.** No streaks to protect, no badges, no before-and-after photos, no food called good or bad. Nothing here is designed to make you open the app more often than is useful to you.
>
> **It's meant to become unnecessary.** Selodía has a designed ending: once the habits are yours, it steps back. That is the point of it, not a failure of it.
>
> Your data is yours. Export all of it or delete all of it, from inside the app, whenever you like. It is never sold and never used for advertising.
>
> Selodía is not a medical device and does not provide medical advice. If something about your health worries you, please talk to your GP.

**Assets still needed — Ruth supplies or approves**

| Asset | Spec | Status |
|---|---|---|
| App icon | 512×512 PNG, 32-bit | The Seed Mark exists in the brand pack — needs exporting at size |
| Feature graphic | 1024×500 PNG or JPG | **Not designed.** Appears at the top of the listing. |
| Phone screenshots | 2–8, min 320px, 16:9 or 9:16 | **Not taken.** Suggest: Chat mid-conversation, the Body summary, an Almanac plan with its safety note, the Measurements week. |
| Tablet screenshots | Optional | Skip |

**Screenshot caution:** they are public even while the app is in internal testing. Use seeded or invented data, never Ruth's real measurements, food logs or chat history.

---

## 4. Progress

| # | Step | Owner | Status |
|---|---|---|---|
| 1 | Play Console account as Selodía Ltd, $25 | Ruth | Not started |
| 2 | D-U-N-S number — **look it up before applying**, D&B may already have issued one | Ruth | Requested 10 Sept. Up to 30 days; the confirmation goes to hello@selodia.app |
| 3 | Google verification | Ruth | Blocked on 1–2 |
| 4 | App content declarations | Ruth, from §2 | Drafted |
| 5 | Store listing copy | Ruth approves §3 | Drafted |
| 6 | Icon, feature graphic, screenshots | Ruth | Not started |
| 7 | AAB from the `production` profile, upload to internal testing | Claude | Waiting on 1–6 |
| 8 | Add testers by email | Ruth | — |
| 9 | `app.selodia.dev` variant so debugging never costs the real app | Claude | Config done 10 Sept (`app.config.js`, 5ca248c). **No dev-variant build has run yet**, so its FCM credentials entry cannot exist yet either |
| 10 | Set up FCM push credentials for `app.selodia` | Ruth in the consoles, Claude the repo | Firebase project `selodia-app`, `google-services.json` and the EAS key all done 10 Sept. **Push verified on a device on 12 Sept**, preview build `1291e191`: token saved, test push delivered and seen. It needed a code fix as well as the setup (`3732881`). (The old wording, "regenerate", was wrong: there were never any credentials to regenerate.) |
| 11 | Promote to production | Ruth | A separate, deliberate decision |
