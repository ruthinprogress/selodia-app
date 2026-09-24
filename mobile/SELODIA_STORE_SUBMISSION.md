# Selodía — Store Submission

*Started 10 September 2026; brought up to date and extended to the App Store on 19 September 2026. The working document for getting Selodía onto Google Play and the App Store. Operational rather than conceptual: forms to fill in, answers to copy, copy to approve. The **reasoning** behind the route lives in `SELODIA_SPEC.md` Part Sixteen under "Google Play submission"; this is the thing you sit beside the Play Console with.*

*Every answer below was written from the actual database tables and the actual third-party calls, and must stay consistent with the live privacy policy at **selodia.app/privacy**. Google compares the two, and a Data Safety form that contradicts the policy is a rejection.*

---

## 1. Data Safety — the answers

Google's Data Safety form asks, for each data type: is it **collected**, is it **shared**, is it **processed ephemerally**, is it **required or optional**, and **why**. "Shared" has a specific meaning — transferred to a *third party*, which does **not** include a service provider processing on your behalf. Supabase, Anthropic, ElevenLabs and Expo are all processors, so the honest answer to "shared" is **No** throughout.

**Overall answers**

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all user data encrypted in transit? | **Yes** |
| Do you provide a way for users to request data deletion? | **Yes** — in-app, Settings → Delete my account. **Web link (required): `https://selodia.app/delete-account`** |
| Is data processed ephemerally only? | **No** — it is stored, because the product's value is history |
| Is any data collected from children? | **No** — the app is for adults |

**Data types — declare exactly these**

| Category | Type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|---|
| Personal info | Email address | Yes | No | Required | Account management |
| Personal info | Name | No | — | — | Not collected |
| Personal info | Other info (date of birth, biological sex) | Yes | No | Optional | App functionality — used to derive metabolic estimates |
| Health and fitness | Health info | Yes | No | Optional | App functionality — body measurements, conditions and markers the person discloses, menstrual cycle dates, allergies |
| Health and fitness | Fitness info | Yes | No | Optional | App functionality — activity, duration, intensity, and step counts from Health Connect where permission was granted |
| Photos and videos | Photos | Yes | No | Optional | App functionality — food photographs the person chooses to send |
| Messages | Other in-app messages | Yes | No | Required | App functionality — the conversation is the product's primary interface |
| Audio | Voice or sound recordings | **No** | — | — | Audio is processed to produce a transcript and is not retained. **Declare the transcript under Messages, not here.** |
| App activity | Other actions | Yes | No | Optional | App functionality — saved plans, insights, notes |
| Device or other IDs | Device or other IDs | Yes | No | Optional | App functionality — a push token, only if reminders are turned on |
| App info and performance | Diagnostics | Yes | No | Required | Analytics — a short error note (which part of the app failed, and the error text) written when something fails on the phone. **Added 19 September**: `client_error_log` has existed since 17 September and was missing here. Google counts diagnosing faults as Analytics. |

**Changes the day clinical-letter upload is built** (Part Sixteen, not built yet): *Files and docs* becomes collected, even though the letter is discarded after reading, because Google counts processing, not only storage. Update this table, the privacy policy and the App Store answers in the same change.

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
| Health Connect permissions | **A separate declaration, with a reason for each permission.** The app reads **Steps only**. Reason: "Shows the person their daily step count alongside the movement they log, so their week is complete without typing it in." Distance and exercise were requested in `app.json` but never read, and Google rejects permissions an app does not use, so both were **removed on 19 September**; add each back only with the code that reads it. The app has the Health Connect rationale entry the platform requires (added by the `react-native-health-connect` plugin); it opens the app rather than the policy, so **check on device** that a reviewer tapping it from Health Connect can reach the privacy policy. |
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
| App icon | 512×512 PNG, 32-bit | **Still needed.** The Seed Mark exists in the brand pack and needs exporting at size. |
| Feature graphic | 1024×500 PNG or JPG | **Still needed. Not designed.** Appears at the top of the listing. |
| Phone screenshots | 2–8, min 320px, 16:9 or 9:16 | **DONE, 23 Sept 2026.** Six at 1080×1920, which is 9:16 and well over the minimum: `1-chat`, `2-today`, `3-log`, `4-hydration`, `5-cycle`, `6-almanac`. **[Open the folder in Drive](https://drive.google.com/drive/folders/1fUjqZY4VmBCsb78CsRcLQ6PW_uiauZhi)** — Build Specs › Branding & Assets › Visual Assets › "2026-09-23 Play Store screenshots". |
| Tablet screenshots | Optional | Skip |

**This table said the screenshots were "not taken" for a day after they were taken**, which is the third time a row in this document has described work that was already finished. Checked against the folder on 24 September rather than against memory.

**Screenshot caution:** they are public even while the app is in internal testing. Use seeded or invented data, never Ruth's real measurements, food logs or chat history.

### The set to shoot, and why (Ruth, 24 September 2026)

The 23 September six are being replaced. They were taken before the More
glyph landed, so every one of them still shows the word "Settings", and two
of the screens were not the right screens to be showing at all.

| # | Screen | What it must show |
|---|---|---|
| 1 | Chat | **The voice mic and the waves.** The old one showed neither, so the listing's first image hid the feature the app is actually for |
| 2 | Today | Filled in, not empty: a **5k run** logged, and **hydration part-filled** |
| 3 | Food log | The redesigned one. The old shot predates it |
| 4 | Plans | **Replaces Hydration**, which was cut entirely. More relevant to somebody deciding whether to install |
| 5 | Barbell deadlift, with the animatic character | **Replaces Cycle**, which was not a finished-looking screen. Pairs with 4: here is the programme, here is what a movement looks like |
| 6 | Almanac | A **fuller Health Flower**. A sparse one reads as broken rather than as early |

**Shot from a separate seeded account, decided 24 September.** Not the demo
account: that one holds Ruth's real food logs, her knee pain and a real
conversation. A store listing is public the moment it is, and the 23
September set had already been rejected once for showing a frank chat about
not eating. The account exists to be photographed and holds nothing real.

---

## 4. Progress

| # | Step | Owner | Status |
|---|---|---|---|
| 1 | Play Console account as Selodía Ltd, $25 | Ruth | **PAID 23 Sept 2026** — £18.77 ($25.00), order PDS.1166-5377-9708-29527, personal Monzo card. One-off, never renews. Registered as an organisation, which also avoids the 12-testers-for-14-days rule a personal account would face |
| 2 | D-U-N-S number | Ruth | **DONE — 235125707.** Issued and emailed 10 Sept 2026; found in the promotions tab on 22 Sept, having been the stated blocker for twelve days |
| 3 | Google verification | Ruth | **Submitted, waiting on Google.** Terms accepted 23 Sept and filed to Drive. The console is opened under **helloselodia@gmail.com**, not unflumpapp — that was corrected on 23 Sept after being stated wrongly here from inference. As of the evening of 24 Sept the account was not yet active; only Ruth can see the current state, as it is her console login. The legal name must match the D-U-N-S record and Companies House EXACTLY — Selodía Ltd — and a mismatch is the usual reason an organisation verification is rejected |
| 4 | App content declarations | Ruth, from §2 | Drafted |
| 5 | Store listing copy | Ruth approves §3 | Drafted |
| 6 | Icon, feature graphic, screenshots | Ruth | **Screenshots done** (six, 23 Sept, in Visual Assets). **Icon and feature graphic outstanding** — these two are now the only listing assets missing, and with verification they are what stands between here and an upload |
| 7 | AAB from the `production` profile, upload to internal testing | Claude | Waiting on 1–6 |
| 8 | Add testers by email | Ruth | — |
| 9 | `app.selodia.dev` variant so debugging never costs the real app | Claude | Config done 10 Sept (`app.config.js`, 5ca248c). **No dev-variant build has run yet**, so its FCM credentials entry cannot exist yet either |
| 10 | Set up FCM push credentials for `app.selodia` | Ruth in the consoles, Claude the repo | Firebase project `selodia-app`, `google-services.json` and the EAS key all done 10 Sept. **Push verified on a device on 12 Sept**, preview build `1291e191`: token saved, test push delivered and seen. It needed a code fix as well as the setup (`3732881`). (The old wording, "regenerate", was wrong: there were never any credentials to regenerate.) |
| 11 | Promote to production | Ruth | A separate, deliberate decision |
| 12 | Account deletion web page, support page, privacy policy update, consent screen AI wording | Claude | **DONE and live.** This row said the work was held on a branch called `store-wording` awaiting approval. That branch does not exist, on this machine or the remote: the work was merged and has been serving from production since. Four days were spent believing finished work was waiting on a decision. Re-verified 24 Sept, all three returning 200: **[/privacy](https://selodia.app/privacy)** · **[/support](https://selodia.app/support)** · **[/delete-account](https://selodia.app/delete-account)**. They also answer on `api.selodia.app`, but `selodia.app` is the one to give Google |

---

## 5. A deletion request by email

The web page promises a reply and deletion within 30 days. When one arrives at hello@selodia.app:

1. Check it came **from the address on the account**. If it did not, reply asking them to send it from that address, and do nothing else.
2. In Supabase, Authentication → Users, find that email and delete the user. Every table cascades from it, which is the same end state as the in-app button.
3. Reply to confirm it is done. Keep the email thread as the record that the request was made and met.

---

# APP STORE (iPhone)

*Started 19 September 2026. Nothing has been submitted and no iOS build has run yet.*

## 6. What would stop review

| # | Blocker | Status |
|---|---|---|
| 1 | **Sign in with Apple.** Guideline 4.8: an app offering Google sign-in must also offer Sign in with Apple (or an equivalent privacy-first login). | **Not built.** Needs the Apple Developer account first, then the Apple provider in Supabase Auth and `expo-apple-authentication` in the app. |
| 2 | **Telling people about AI, and asking.** Guideline 5.1.2(i): people must be told clearly, and agree, before personal data goes to a third-party AI. | **Built, held for approval** (branch `store-wording`): the consent screen names Claude and ElevenLabs and the core consent box includes it. |
| 3 | **In-app account deletion.** Guideline 5.1.1(v). | **Done** (Settings → Delete my account). |
| 4 | **HealthKit.** Health data never used for advertising, never stored in iCloud, and a clear reason in the permission prompt. | Permission text set (`react-native-health` plugin). The privacy policy update says HealthKit data is never used for advertising. **Not verified on device** (Part Sixteen notes iOS permission handling is code-fixed but untested). |
| 5 | **Bundle identifier and export compliance.** | **Done 19 September:** `app.selodia` (dev: `app.selodia.dev`), and `usesNonExemptEncryption: false`, because the app uses only standard HTTPS. |
| 6 | **Camera, photos and microphone reasons.** | **Done**, set by the plugins in `app.json`. |

## 7. App Store Connect answers

| Item | Answer |
|---|---|
| Privacy policy URL | `https://selodia.app/privacy` |
| Support URL (required) | `https://selodia.app/support` |
| Marketing URL (optional) | `https://selodia.app` |
| Age rating | Answer the questionnaire honestly: no violence, sexual content, gambling or user-to-user contact. Medical or treatment information: **infrequent**, because it discusses health but does not diagnose. Set the minimum age to **18+** so it matches the Play declaration: the app is for adults. |
| Category | Health & Fitness |
| Review notes | Explain that the app is a conversational health companion, not a medical device; give a **test account** with sample data (never Ruth's real data); say that voice mode needs the microphone and Apple Health is optional. |
| Content rights | Exercise animations are licensed from Exercise Animatic (see the spec for the licence). |

## 8. App Privacy ("nutrition label")

Apple's categories differ from Google's. Every item below is **linked to the person** (it is stored with their account), and **none is used for tracking**.

| Apple category | Collected | Purpose |
|---|---|---|
| Contact info: email address | Yes | App functionality |
| Health & fitness: health | Yes | App functionality |
| Health & fitness: fitness | Yes | App functionality |
| User content: photos | Yes | App functionality (food photos) |
| User content: other user content | Yes | App functionality (messages and voice transcripts) |
| Identifiers: device ID | Yes | App functionality (push token, only with reminders on) |
| Diagnostics: other diagnostic data | Yes | App functionality (error notes) |
| Sensitive info, location, contacts, browsing, purchases, financial | No | — |

**Audio data**: not collected, for the same reason as on Play. Audio is turned into text and not kept; the transcript is declared as user content. This depends on the ElevenLabs retention setting still to be confirmed.

## 9. Progress

| # | Step | Owner | Status |
|---|---|---|---|
| 1 | Apple Developer Program as **Selodía Ltd**, about £79 a year | Ruth | Not started. **Needs the D-U-N-S number**, the same one Play needs. |
| 2 | Sign in with Apple | Claude, after 1 | Not started |
| 3 | First iOS build (`eas build --platform ios`), then TestFlight | Claude, after 1 | Not started |
| 4 | Check Apple Health permissions on a real iPhone | Ruth | Not started |
| 5 | App Store Connect answers (§7) and App Privacy (§8) | Ruth, from this document | Drafted |
| 6 | Screenshots: 6.9-inch iPhone required (1320×2868 or 1290×2796) | Ruth | Not started. Same rule as Play: invented data only. |
| 7 | Submit for review | Ruth | A deliberate decision |
