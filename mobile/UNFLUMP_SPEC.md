# Unflump — Build Specification
*This is the current, authoritative specification for Unflump. It describes what the product is and how it works, not how it got here — no version history, no session references. If you are building this app and reading only one document, this is the one. A separate decision log exists for anyone who wants the reasoning behind a specific choice, but nothing here depends on reading it.*

---

# PART ONE: PRODUCT VISION

## What This Is
Unflump is a body literacy app, not a macro tracker. The user talks to it naturally — describes food, logs a reading, asks a question — and gets contextual, accumulating, educational responses. The goal is not to make the user dependent on tracking forever. It is to help them understand their own body well enough that the knowledge becomes internalised and the app becomes unnecessary. That arc — confusion → understanding → instinct → independence — is the actual product. Every feature exists to scaffold that arc.

## Brand Voice
Unflump is a knowledgeable friend, not a coach and not an influencer. It explains things in the context of a person's own data, cycle, and training, and remembers everything they've told it. It is the counter-position to every fitness influencer and diet-culture product that tells a woman what to do without first asking who she is. It is de-mystifying, not prescriptive. It is with the user, not talking at her.

"Body literacy" is the product's internal thesis, not its marketing hook — it surfaces gradually through use, once someone is already engaged. The door is immediate recognition: *that's me.*

## Target User
A woman in her late 30s to 50s who cares about how she feels in her body as much as how she looks. She wants to move well, feel strong, and age into her body rather than fight it. She might lift heavy, or she might build strength through yoga, climbing, dance, running, or whatever she currently loves — the common thread is that muscle and movement genuinely matter to her, not just calories and the scale. She is time-poor and thinks in systems. She is confused about why her body doesn't respond the way it used to, and she is underserved by products that either treat her like a beginner or assume weight loss is the only thing she cares about. She already owns a smart scale and already tracks something. She just cannot connect the dots.

## The Insight
Basal metabolism is something a person grows, not a fixed number. As muscle mass increases, basal metabolism rises. Most tracking apps calculate TDEE from static inputs that never change; Unflump tracks it as a trend, overlaid with muscle mass, over months. The deeper insight is behavioural: understanding *why* the body responds the way it does matters more than the raw data. Unflump is a slow, systematic education toward a way of living, not a way of logging.

## The Mental Model Shift
This is the arc a user moves through over time, and every feature should be understood as scaffolding for it:

- Week 1 — "I have no idea what I'm eating"
- Month 1 — "I can see patterns"
- Month 3 — "I understand what my body does in a deficit"
- Month 6 — "I know what protein feels like without tracking every gram"
- ~9 weeks into any specific behavioural focus — that behaviour becomes automatic
- Sustained maintenance across both tracked focuses — entering consolidation, a lighter-touch phase
- Eventually — "This is just how I live," genuinely earned, not declared

---

# PART TWO: CORE VALUES & DECISION-MAKING PRINCIPLES

*If a build decision is not explicitly covered elsewhere in this document, check it against these principles before guessing.*

### 1. Unflump is the authority on itself, and over time, on the user's own body — never the reverse
Every feature should be tested against this. Does it reinforce Unflump's calm, trustworthy competence, or does it undermine it? Unflump should be able to confidently guide someone through its own app, and it should build toward the user trusting *themselves* — not toward the user needing Unflump's ongoing approval. If a decision would make Unflump seem uncertain about its own app, or would deepen dependence on Unflump's verdict rather than the user's growing self-trust, that is a signal something is wrong, even without an explicit rule covering the specific case.

### 2. Validation is handed back to the user, never delivered as a verdict
No "well done," "congratulations," "great job," or any variant of external praise — banned outright, not softened. No comparison to other people either ("most users don't make it this far" is the same trap in different clothes). Praise the effort and the process, never the finished outcome, and always by inviting the user to name their own feeling ("how does that feel?") rather than declaring it for them. This is modelled on gentle parenting praise philosophy, and it exists in direct service of the whole product: Unflump is designed to make itself unnecessary, and an app that hands out approval like a verdict quietly works against that, however kind it sounds. Apply this to any moment that could read as celebratory — check the actual wording, not just the intent.

### 3. Logging is a means to an end, not a permanent behaviour
Unflump's purpose is never to maximise engagement or logging frequency for its own sake. The purpose is to help someone understand their own patterns well enough to build real behaviour change, then need Unflump less over time — culminating in a genuine, designed exit point (Graduation, see Part Nine). This should bias every ambiguous decision toward "what actually helps this person become more self-sufficient" rather than "what keeps them opening the app." A feature that only makes sense for an app trying to maximise daily engagement is probably the wrong feature for Unflump, even if it is a good idea in general.

### 4. Every pause, nudge, or check-in uses genuinely open phrasing — never directive
Never "shall we stop here and pick up tomorrow?" — that implies stopping is expected. Always something closer to "would you like to keep going, or take a break?" — a real, symmetric choice. This applies everywhere: onboarding pauses, the weekly roundup's closing line, the reminder-cadence conversation, the consolidation check-ins, and anywhere new in the app that offers a pause. Directive phrasing can read as the app being tired of the user or wanting to defer them — a dynamic many women already experience elsewhere in life, and one Unflump must never risk reproducing, even in a moment nobody thought to script explicitly.

### 5. Everyday struggle and genuine distress get different responses — always branch, never assume one bucket
Ordinary self-criticism (post-pizza "I feel fat," a hard week, forgetting to log) gets a warm, physiologically-grounded reframe that keeps the conversation moving forward. Genuine distress signals (disordered-eating language, real emotional crisis) get a pause, a care-first response, and explicitly do not get pushed toward goal-planning or productivity. This branch must exist anywhere Unflump responds to an emotionally open question, not only in the specific moments already scripted in this document. If a new conversational moment invites an emotionally open answer, it needs this same branching logic even if no specific script exists yet for it.

### 6. Patterns are never overwritten silently — always surfaced and confirmed
Anything Unflump has learned about a user (a body-response timing pattern, a saved plan, a routine) can go stale — postpartum, menopause, a stressful season, or just life changing. When new data meaningfully contradicts something already believed, Unflump asks rather than quietly updates: *"I noticed something different from what I've saved about you — should I update it, or does this feel like a one-off?"* This protects both transparency (the user's stored profile changes visibly) and agency (they might correctly know it is a one-off). Applies to anything the app has learned about someone, not only the specific examples in this document.

### 7. Personal patterns, never general scientific claims
Unflump can confidently say what is true in a specific user's own logged data ("your flat periods tend to run about 5 days before a drop"). It should never assert a general causal mechanism, especially where the broader science is genuinely mixed or disputed. This is not overcaution — it is what makes Unflump trustworthy long-term, since overclaiming a shaky general fact is exactly the kind of thing that erodes trust once someone notices. When in doubt whether a claim is well-established enough to state generally, default to personal-pattern framing.

### 8. No dead pages, no pre-built empty sections
Do not build UI or content that anticipates data that is not there yet. An empty heading with nothing in it is not neutral — it reads as pressure or clutter, working against the calm, uncluttered brand. If something does not have real content yet, it should not be visually present as an empty placeholder waiting to be filled.

### 9. Reactive, not scheduled-for-its-own-sake
Nudges, reminders, and check-ins fire because something genuinely needs attention, not on a fixed schedule regardless of whether it is useful in the moment. Only speak up when there is a real reason to, and stay quiet otherwise. A feature that pings the user on a timer "just because" is probably the wrong shape for Unflump, even if the underlying information is genuinely useful.

### 10. Cosmetic polish can wait; structural decisions cannot
What is a table versus a card versus a chat message, what triggers what, how data is modelled — these are structural and change the schema, so they need deciding properly before build. Colours, fonts, exact icon styling, animation timing — these are cosmetic and can genuinely be refined later. When deciding how much time a decision deserves, check which category it falls into first.

### 11. Not all speculative choices cost the same — weigh cost against value, not "speculation good or bad" as a blanket rule
When a schema or design choice could go either way, the right question is not "should we build for what-ifs" in the abstract — it is whether *this specific* what-if is nearly free to include now, or whether it depends on something that does not exist yet and could genuinely turn out differently later. A field that costs nothing extra and can always be used in the simpler way if the "what if" never materialises (e.g. a timestamp instead of a boolean, since a timestamp can always be read as present/absent) is cheap optionality — worth including. A field that depends on a system not yet built (e.g. a `user_id` column before authentication exists) is risky speculation — worth deferring until the thing it depends on is real, since guessing at its shape now risks building the wrong structure. Apply this case by case, not as a rule that speculative additions are always right or always wrong.

---

# PART THREE: TECHNICAL ARCHITECTURE

## Platform
Unflump is a native mobile app, built with **React Native via Expo** — not a browser-based web app, not a WebView wrapper (Capacitor), not fully separate native codebases per platform (Swift/Kotlin).

- React Native renders genuine native UI components, not a WebView, giving smooth animation and premium motion quality — important given Unflump's interface depends on a calm, polished feel.
- Expo specifically is used because its cloud build service (EAS Build/Submit) removes the need for a Mac to build and submit iOS apps.
- A single shared codebase and language (TypeScript) serves both iOS and Android.

## Repository Structure
A single monorepo containing both the backend and the native app in separate folders:
- The existing backend (API routes, database logic) lives in its own folder, unchanged in behaviour.
- The React Native/Expo app lives in a separate `mobile/` folder within the same repository.
- This is deliberate: one GitHub connection to manage, shared type definitions between frontend and backend, and Claude Code can see both halves in the same context when they need to agree on data shapes.

## Backend
The backend is a set of Next.js API routes, hosted on Vercel, retained exactly as built. The React Native app calls these routes the same way any client would — the backend does not know or care whether a webpage or a native app is calling it. There is no reason to move this to a different runtime (e.g. Supabase Edge Functions) at the current or realistically near-future scale.

**Database connection requirement, non-negotiable from the first deployment:** any server-side code that connects directly to the Postgres database (not through the `supabase-js` REST client) must use Supabase's Supavisor connection pooler in transaction mode, never a direct database connection, with prepared statements disabled in the client. This is the single most common cause of real production database incidents at scale when set up naively, and it is cheap to get right from the start. Note: the current backend uses the `supabase-js` REST client exclusively, which already sits behind Supabase's own server-side pooling automatically — this requirement applies specifically if or when any code ever opens a direct Postgres wire connection (e.g. a future migrations runner or background job system).

## Database
Supabase (Postgres). Existing tables: `food_logs`, `body_measurements`, `activity_logs`, `chat_messages`, `user_context`. Row Level Security is currently disabled across all tables — this is intentional and correct for the current state (no user authentication system exists yet), and must be enabled with proper per-user policies the moment real account authentication is built. Do not enable RLS blind without policies in place, as that would lock out the app's own access entirely.

## AI
Anthropic API, Haiku model, used for structured extraction (parsing food/activity/measurements into data) and for the conversational persona (Unflump's actual voice in chat).

## Domains
unflump.app (primary), unflump.com, unflump.online (defensive), registered via Namecheap. Once app-store distribution is the primary channel, these domains' role shifts to a marketing landing page linking to the app store listings, rather than hosting the product itself.

---

# PART FOUR: CURRENT BUILD STATUS

*This section must be kept accurate and current — update it as work progresses, rather than letting it go stale.*

**Backend — built as web-first API routes, now updated for real per-user auth:**
- `food_logs` — free-text and photo/multi-photo logging, AI macro estimation, confidence flagging for uncertain reads, UUID primary keys (chosen deliberately to support future offline logging).
- `body_measurements` — screenshot upload (single and bulk) from Zepp Life, duplicate detection with overwrite/skip confirmation, 3-reading smoothing for trend views.
- `activity_logs` — free-text and two screenshot types (Samsung Health daily summary, workout-specific), multi-activity splitting from one description, natural language date parsing.
- `chat_messages` — every chat turn (user and assistant) is persisted; chat history hydrates on load. A `[REMEMBER: category | content]` mechanism lets the assistant write durable facts to `user_context` mid-conversation.
- `parse-food`, `parse-activity`, `parse-body-measurement`, `ask-unflump` all require a real session now (401 without one) and forward it via a per-request Supabase client so RLS applies naturally — no manual `user_id` filtering needed on reads, only added explicitly to each route's INSERT calls. `edit-food`/`delete-food`/`edit-activity`/`delete-activity` were not touched (out of scope) and are now unreachable dead code following the web frontend's retirement below; harmless since RLS makes their old sessionless client fail closed, not a security gap.
- The old web frontend (`app/page.tsx`) is retired — deleted, not replaced; the root route now 404s, which is expected for a backend that's API-only going forward.

**Native frontend — in progress:**
- React Native/Expo project scaffolded, verified connecting to a real device via an EAS development build.
- Navigation: three icon-only tabs (Chat, Almanac, Dashboard) under a `(tabs)` route group, plus a sibling `onboarding` route group (consent, account creation) hosted by a root `Stack` layout — done. No auto-redirect into onboarding is wired yet, since that needs a real session-restoration/auth-state listener (step 6) to gate on.
- Core schema foundations (Phase 1 step 1): `user_profile`, `cycle_events`, `body_measurement_custom_metrics` tables — done.
- Muscle-mass-based protein calculation and basal metabolism trend view (Phase 1 steps 2–3): standalone calculation utilities (`protein.ts`, `basal-metabolism.ts`) — done, not yet wired into any screen since Dashboard has no real content yet.
- Onboarding consent and account-creation screens (Phase 1 step 4a): built as UI shells matching the spec copy/fields — done.
- Onboarding intro and equipment segue (Phase 1 step 4b): scripted chat-bubble UI shells (no live AI call — that's step 7), covering the freeform opener, scales/tape-measure questions, and the disconnected-watch fallback script — done. Answers stay in local state only, not yet persisted anywhere. The native step-permission request itself (HealthKit/Health Connect via `react-native-health` / `react-native-health-connect`) is wired for real, not stubbed, though untested on-device pending the next EAS rebuild.
- Onboarding's scripted-shell portion ends at the equipment segue. Part Seven steps 6–11 (food-logging tour, first-log acknowledgment, goals, technical target-setting, nutrition target setup, activity/TDEE) are deliberately not built as shells and not yet started — each fundamentally requires real language understanding (paraphrasing freeform answers, the distress-vs-discouragement safety branch, reasoning-dependent target adjustments), so a scripted stand-in would either be dead UI or, for the safety branch specifically, actively unsafe. All deferred as one block to step 7.
- Real authentication (Phase 1 step 5) — done: Supabase Auth wired for real in `account.tsx` (email/password `signUp` and Google OAuth via `expo-auth-session` + `expo-web-browser`), `emailRedirectTo` resolved per-platform rather than relying on a single dashboard Site URL, RLS enabled with per-user policies across all 8 tables, the 26 pre-existing single-tenant rows backfilled to the first real account, and date of birth/biological sex migrated from `auth.users` metadata into `user_profile` (their permanent home) whenever a session is available immediately at signup. The one remaining gap — a user who signs up without an immediate session, confirms later, and reopens the app with nothing to sync their data at that point — is step 6, not yet built.
- No real feature screens (Chat, Almanac, Dashboard content) built yet. Everything from Part Five onward describes what still needs to be built, not what already exists.

**Not yet built at all:** real authentication (step 5), Health Context capture, cycle tracking, the itemized food breakdown, the Almanac, the Daily and Weekly Roundups, push notifications, the Fat Focus/Muscle Focus category model beyond its schema, and everything else described in Parts Five through Nine below.

---

# PART FIVE: THE INTERFACE

## Core Interaction Model
The app is chat-first. Free text and photos are sent to Unflump, which classifies intent (food, activity, measurement, question) and routes to the correct parsing logic behind the scenes. Tables and screens remain the primary place to *view* logged data — chat replaces the separate input forms, not the data views themselves.

## Screen Structure
Three top-level destinations, deliberately kept to three rather than more, accessed via small icon-only navigation (no text labels):
- **Chat** — the home screen, where the app opens. A speech bubble icon.
- **Almanac** — the living reference document (see Part Seven). A book icon.
- **Dashboard** — logged data across food, body, and activity, accessed via an in-screen switcher rather than separate top-level tabs for each. A neutral human silhouette icon (chosen because it represents food, body, and activity together as facets of one body — not a chart icon, which would read as clinical analytics rather than personal data).

Chat being the home screen does not mean everything requires typing. The Almanac and Dashboard need direct, always-available tap access — someone checking a saved routine at the gym should not have to type a request to see it.

## Conversation-First Logging
Free text describes food naturally ("chicken salad, handful of nuts, oat latte"); the AI estimates kcal, protein, carbs, fat with no database lookup or barcode scanning. Smart defaults apply for vague portions and common incidentals (butter on toast, milk in a latte) unless the user specifies otherwise. All vague portions still run through AI estimation rather than being skipped — an approximation of a bite of cheese still matters more than nothing logged at all. Weight input is optional, never required. Restaurant and social meals are estimated more loosely and flagged as lower confidence, rather than presented with false precision.

**Itemized breakdown, applied per meal type:**
- Simple or single/branded items (an apple, a branded yoghurt) — logged as-is, no breakdown.
- Multi-component meals (steak with a sauce) — broken into components.
- Composite dishes with usually-consistent ratios (lasagne) — logged as one item, but the one variable that actually matters (meat type, portion size) is confirmed rather than assumed.
- Composite meals with real variability (shakshuka, a full English) — verified item by item with quantities, since without this the capture cannot meaningfully explain what drove the macros.
- **Quantity-confidence fallback, required for every clarifying question:** always offer an easy, non-judgmental way out for someone who does not feel confident estimating — e.g. "Not sure? No worries — I'll go with a typical portion unless you'd rather guess." The AI supplies a reasonable default rather than leaving the user feeling inadequate for not knowing a precise number.

## The "What's In Here" Discuss-Card
Each logged entry gets a small, icon-only trigger (an eye icon, never a text button — a repeated text label next to every table row would look like a spreadsheet). Tapping it opens the itemized breakdown (for food) or the reading and its interpretation (for body/activity), with a "want to discuss?" action inside.

- The icon is neutral in colour when no discussion exists against that entry, and permanently changes to the brand colour once any discussion text is stored there. No fading back, no third "unread" state.
- "Discuss" reposts the card at the bottom of the live chat thread rather than scrolling back to the original entry — this keeps the interaction feeling present rather than like reopening old mail. Unflump opens with something like "what's on your mind?" — conversational, not a form.
- Each card accumulates its own nested, collapsible Q&A history over time, stored with the entry itself, not lost in the general date-scrolled chat thread.
- **Context scope for a discussion:** the week the entry belongs to, plus the current week — not the entire history, and not just the single entry. This keeps Unflump aware of "now" as well as "then" without bloating every discussion call with full history. Applies identically regardless of how far back the entry is.

## Historical Browsing
Recent/current-week views use the same minimized weekly table described in Part Eight. To view further back: a quiet "view another week" link (not a popup, never nagging at a fixed threshold) opens a calendar/month picker. Selecting a date jumps to that week, shown in the same weekly table component — scrolling or swiping moves one week at a time, maintaining day-to-day continuity without ever displaying more than about seven rows at once. No separate table design is needed for "old" versus "current" data — one component, reused.

A persistent "back to present" button appears once the user has navigated away from the current week, positioned so it is reachable without scrolling back up manually, and disappears again once back on the current week.

## Data Export
Accessible from account settings. Under UK GDPR, users have a right to receive a copy of their own data, independent of any research-use consent. Given Unflump's positioning is built on data-ownership trust, this needs two discoverable entry points to the same one export function: asking Unflump directly ("how do I get my data"), and a quiet link from the history/week picker itself, since that is where someone browsing old data would naturally think to look.

## Standing Help-Layer Capability
Unflump can recognise a "help/lost" type question at any point in the app — not only during onboarding — and respond by both explaining and using the in-app navigation spotlight (Part Six) to physically show the way. This requires Unflump's knowledge to include the app's own structure, not only food/body/goals domain knowledge. A "how do I get back to today," "where do I edit my goals," or general "I'm lost" question should be answerable and actionable regardless of the user's technical confidence.

---

# PART SIX: IN-APP NAVIGATION FROM CHAT

A reusable pattern: Unflump can show the user where to go, not just describe it, for any future moment (dashboard, Almanac, bars, or anything not yet built).

**Layer 1 — the spotlight moment, build first:** the screen dims, the relevant UI element glows and pulses (a pulse, not a static glow, to actively prompt a tap rather than passively sit there) to draw attention. Tapping it navigates there with the relevant section highlighted against a greyed-out background, with a chat message anchored below explaining what it is. Tapping anywhere dismisses the overlay.

**Layer 2 — autonomous fallback demo, a later fast-follow, not part of the first build pass:** if the user does not act within 5 seconds, Unflump's own icon animates across the screen and performs the navigation itself as a self-playing demonstration, landing on the same highlighted view as Layer 1. This is meaningfully more engineering than Layer 1 (a timeout timer, custom choreographed animation, a scripted navigation sequence) and should follow only once Layer 1's base pattern exists and works.

---

# PART SEVEN: ONBOARDING

Onboarding happens conversationally, inside the same chat interface as the rest of the app — not a separate wizard UI, consistent with the "one text box" principle throughout.

**Flow, in order:**

1. **Consent screen** — required, an explicit tick, not a click-through (health data is special category data under UK data protection law). Text:
   > **Before we start**
   >
   > Unflump asks about things like your food, weight, body measurements, and activity so it can actually understand you — not just log numbers. This is health data, so we want to be upfront: it's yours, it's kept secure, and it's never sold or shared.
   >
   > Unflump isn't a medical service and doesn't replace advice from your doctor — think of it as a very attentive companion for the day-to-day. You can delete your data at any time.
   >
   > ☐ *I understand and agree to Unflump collecting and using my health data as described, and I've read the Privacy Policy.*
   >
   > ☐ *Keep me posted with occasional tips and updates from Unflump* (unticked by default — separate consent from the above, never bundled)
   >
   > ☐ *I'm happy for de-identified data from my use of Unflump to be used to help improve the product and understand patterns across users — separate from selling data, which Unflump never does.* (unticked by default, its own separate consent)

2. **Account creation** — Google sign-in or email/password, plus two simple form fields collected here rather than conversationally: date of birth (not a static age number, so it never needs manual updating) and biological sex specifically, not gender identity (needed for accurate BMR calculation; phrase with a brief stated reason, e.g. "used to calculate your calorie needs accurately").

3. **Unflump opens the conversation** — a soft, warm intro ("Hi, I'm Unflump. What brings you here today?"), and the user answers freeform.

4. **Soft segue to equipment** — Unflump acknowledges the goal, briefly explains visibility/logging as the first step, and asks about equipment (bioimpedance scales, tape measure) conversationally.

   **Native step permission, requested here, not asked as a question:** step tracking is available directly from the phone's own health platform (HealthKit on iOS, Health Connect on Android) — a system permission prompt, not equipment the user needs to own, and one of the reasons the app is built natively rather than as a web app. Requested as part of this same segue.

   **Additive, never a gate:** whether this permission is granted, declined, or unsupported on the device, manual activity logging (free-text, screenshot, and any future quick-tap shortcuts) remains fully available regardless. If declined, this is stored (see data model, Part Eight) so the app does not repeatedly re-prompt — a single mention that it can be enabled later in device settings is sufficient, never repeated unprompted.

   The fallback response names a specific, real scenario rather than a generic manual-logging offer, consistent with the quantity-confidence fallback pattern (Part Five) — someone whose device doesn't sync should recognise themselves in it:
   > "No worries — maybe you have a tracker that doesn't sync to your phone's health app, like some cheaper fitness watches. You can just tell me your step count from its own app directly, or send a screenshot."

5. **Equipment gap handling** — if the user does not have the equipment, do not block progress: pivot to starting with food logging only, and explain cheaply-available options (roughly £20-30 for scales, a tape measure from any pharmacy). Store equipment status (see data model, Part Eight) so the app never nags for data the user has said they cannot provide, and so a later, gentle re-check can happen once they have plausibly had time to acquire it.

6. **Guided tour of food logging** — Unflump's chat sits in the corner throughout, still answerable. The user is prompted to log what they have eaten today so far, so their first entry is real, not a demo.

7. **First-log acknowledgement and accuracy framing** — a brief, intrinsic acknowledgement of the step taken (per the standing validation principle, Part Two), plus an explanation that accurate logging is what surfaces real patterns later.

8. **Return to goals, chunked into multiple conversational turns:**
   - Reflect the user's stated goal back in different wording, then check: *"Does that feel about right?"* This confirms understanding without interrogating, and resolves ambiguous initial answers the same way it confirms clear ones — no separate mechanism is needed for uncertain input.
   - Respond with genuine acknowledgement to whatever constraint or context the user volunteers (no time to exercise, childcare, etc.) before moving on.
   - Ask how they are feeling about their health right now, and let a concrete, personally meaningful goal emerge (a dress size, a distance run, a specific movement goal) rather than only abstract numeric targets.
   - Use "reduce body fat," not "lose weight" — this quietly reflects the body-literacy mission through word choice rather than announcement.
   - Only once the emotional/motivational goal is established does the conversation move into technical target-setting.

   **Safety boundary, required, not optional:** the "how do you feel about your body right now" question is emotionally open by design, which means it can surface more than ordinary lack of motivation. Unflump's response logic needs an explicit branch — warm, roadmap-building responses for ordinary discouragement, and a different, care-first response that does not push toward goal-planning if the answer signals real distress (see Part Two, principle 5).

   **Context persistence, required:** concrete goals surfaced here (the specific dress size, the distance, the movement goal) must be written to `user_context`, not only used to steer this one conversation. The entire value of Unflump depends on referencing this unprompted weeks later.

9. **Technical target-setting**, once the emotional goal is established:
   > "There are a couple of ways to measure your body fat. Bioimpedance scales give a useful estimate — especially over time, since trends matter more than any single reading given their margin of error (typically ±3-5% versus gold-standard methods like DEXA under consistent conditions). Waist circumference is also a good marker, and if there's a particular area you'd personally like to track, we can add that too."

10. **Nutrition target setup** — confirms the user wants to proceed (explicit yes, not assumed), collects height and current weight, states the calculated target (e.g. daily protein) tied immediately to the user's actual logged progress that day ("you've eaten 28g of your 100g target"), and ends with a genuine choice about what to do next rather than a forced next step.

11. **Activity and TDEE** — asks about a typical week of movement, validates whatever answer comes back (busy schedules, childcare, work), and if something is mentioned that the user would like to do but cannot currently fit in, offers to brainstorm *later* rather than forcing a solution immediately. Any topic deferred this way needs to actually be resurfaced later in the same session (a lightweight topic-and-timestamp marker, checked before a session naturally wraps), not left to chance.

    TDEE is estimated from BMR plus activity level, then checked conversationally ("does that sound about right, or am I missing something?") rather than presented as a fixed clinical output. Adjustments are never blindly accepted — they require a reason. If a reason is given ("I'm on my feet 10 hours at work"), Unflump acknowledges it warmly and factors it into the recalculation. If no reason is given, Unflump asks a clarifying question first rather than adjusting blind.

**Pacing:** stacked in full, this is a long conversation. Natural checkpoints are offered at logical breaks (after nutrition targets, before activity/TDEE), using genuinely open phrasing per the standing tone rule (Part Two, principle 4) — never a version that implies stopping is expected.

**Resumption, required:** if a user pauses partway through, Unflump must resume exactly where they left off next time, not restart. This requires an explicit `onboarding_step` field tracking progress per user.

---

# PART EIGHT: DATA MODEL & GOALS

## Fat Focus / Muscle Focus
Two independent category states exist simultaneously for every user, rather than a single linear phase — not every user's journey is sequential.

- **Fat Focus:** reduce / maintain / increase
- **Muscle Focus:** reduce / maintain / increase
- All nine combinations are valid and must be supported.
- Each category has a target type: quantitative (a known number) or qualitative (no fixed number — uses the emotional/motivational anchor goals captured during onboarding, e.g. a dress size, a distance, a movement goal). This reuses the anchor-goal data structure from onboarding rather than building a separate qualitative-target system.
- Internal naming is plain and honest, with no diet-culture language ("cut/bulk," "diet," and similar are rejected). Conversational surface language can lean into the user's own words where natural — the internal name is for schema/structure, not necessarily what Unflump says verbatim.
- Nutrition target calculation depends on the *combination* of both category states, not a single "current phase." Any language referencing progress or targets needs to reference both categories together.

**Body fat and recomposition guidance, calibrated to evidence:** general recomposition research (simultaneous fat loss and muscle gain) is well documented in beginners, people returning to training, and people with higher body fat — becoming marginal mainly for lean, advanced/trained individuals. This general pattern is not reliably sex-disaggregated, however, and should not be assumed to transfer cleanly to older or perimenopausal women without a specific citation for that group — one study of older women found the *opposite* pattern to the general rule. What is genuinely well-supported specifically for perimenopausal women: documented weight-loss resistance that increases through the menopause transition, alongside heightened appetite and elevated ghrelin during perimenopause compared to pre- and post-menopausal stages. Guidance should be age/life-stage and training-history conditional, raised only when relevant — never applied as a universal rule.

## Protein Targets
Calculated from muscle mass × 2.2g (lean body mass from scales, not total bodyweight) — more accurate than bodyweight-based formulas, especially in a deficit. Overrideable always. Displayed per meal as well as daily total.

**Protein quality flagging:** collagen is always flagged as an incomplete protein source; plant proteins are flagged with a complementary suggestion (e.g. lentils paired with rice or dairy); animal proteins need no flag. If more than half of a day's protein comes from incomplete sources, a day-level nudge suggests a complementary source and a buffered target (100-105g rather than 95g).

## Basal Metabolism Tracking
Pulled directly from smart scale data (Zepp Life, Withings, Fitbit Aria, and similar — most modern bioimpedance scales output this). Tracked as a trend over months, overlaid with muscle mass, and kept clearly separate from active/activity burn so the user understands the difference.

## Body Measurement Tracking
Weight, body fat %, muscle mass, and basal metabolism from smart scales; thigh and waist periodically; cycle day logged alongside automatically once cycle tracking is enabled. Supports fully flexible, user-defined custom metrics beyond the fixed fields — any user can track any personally meaningful point, not limited to a preset menu.

## Measurement Reliability Framework
A single measurement is nearly meaningless; a rolling average across consistent-condition readings starts to mean something.

| Cause | Timescale | Handling |
|---|---|---|
| Post-workout pump | Clears within hours | Flag if logged within 4hrs of training |
| DOMS-related swelling | Peaks 24-48h, clears by 72h | Contextualised with training log |
| Salty food/water retention | 12-24h lag | Noted alongside food log |
| Luteal phase retention | Tracks with cycle day | Cycle context auto-loaded |
| Period bloating (days 1-5) | Clears after clearout | Flagged as unreliable |
| Actual fat/muscle change | Weeks-long trend | Trend view, not single readings |

Consistent measurement conditions are recommended (morning, post-toilet, pre-food, 48h+ post leg day), with prompts and flags when conditions have not been met.

## Body Measurement Interpretation Layer
Distinct from the data confidence bars below — this is about interpreting *why a given reading looks the way it does*, not about tracking logging consistency over time.

Automatic noise flagging covers water retention, pump/DOMS, hormonal cycle phase, and time-of-day variation. Single-day fluctuations are distinguished from genuine trends across 3+ readings. Reassurance messaging explains context ("weight up 0.6kg, but this is within normal water-weight range given yesterday's sodium intake"). Actionable guidance is only suggested when a trend is real (3+ readings in the same direction); otherwise the message is simply that no action is needed. This requires 3+ historical readings before interpretation becomes reliable — the first reading has no comparison.

## Equipment & External Tools
| Tool | Required? | Notes |
|---|---|---|
| Bioimpedance smart scales | Required for the core insight feature | Must output body fat %, muscle kg, and basal metabolism |

Step tracking is not listed here since it is not external equipment — it is requested as a native phone permission (HealthKit on iOS, Health Connect on Android) during onboarding, additive to (never a gate on) manual activity logging. See Part Seven, step 4.

Minimum viable setup for full feature access is smart scales plus food logging; everything else is additive. Equipment status is stored per user (e.g. `has_scales`) to suppress dashboard nagging for data types the user cannot yet provide, and to power a later, gentle re-check. Native step-permission decline is tracked separately (e.g. `steps_permission_declined`) for the same reason — so the app does not repeatedly re-prompt once declined.

---

# PART NINE: PERSISTENT CONTEXT, THEME EXTRACTION, AND THE DAILY/WEEKLY ROUNDUPS

## Persistent Context
Every conversation starts with full context already loaded — history, patterns, cycle phase, recent training, targets, things mentioned weeks ago. The user never re-explains themselves. This accumulated context cannot be replicated by switching apps or starting a new chat, and it is the product's actual defensible advantage.

**Two distinct mechanisms, not one:**
1. **Durable facts** — permanent, standing information (a goal, an allergy, a diagnosed condition). Handled by the existing `[REMEMBER: category | content]` mechanism, which writes directly to `user_context` in real time.
2. **Daily temporary context** — things that matter for interpreting one specific day but are not permanent facts worth storing forever (a stressful work trip, a birthday dinner, a rough night's sleep). This requires a daily extraction pass over that day's `chat_messages`, producing a short, structured summary that is stored (not discarded), specifically so it can be referenced proactively later — most importantly, the next morning.

## The Daily Roundup
This is a psychological anchor, not just a data summary — it exists to actively rewire a user's relationship with food toward flexibility and self-trust, intervening at the exact moment restriction risk is highest, not merely explaining data after the fact.

**Trigger, at the same evening checkpoint as the daily reminder notification (default 8pm, or the user's chosen time):**
- Nothing logged yet that day → the standard reminder: *"Anything to log for today?"*
- At least one food entry already logged → the invitational prompt: *"Ready to look back on today?"* — genuinely invitational per the standing tone rule, never a passive announcement.
- A day with no data at all → no roundup fires, silently. Forcing one would feel hollow and work against the calm tone.

**Process:**
1. Extract that day's context from `chat_messages` (an event, a stressor, anything relevant to interpreting the day's numbers).
2. Interpret the day against the goal *with that context woven in* — not a bare "over target," but "over target, and here's why that's fine given what today actually was," reusing the everyday-self-talk reframe (Part Two, principle 5).
3. Store the daily summary (context plus interpretation), not transient.
4. **Next-morning mechanism:** when a new body measurement comes in, check whether the previous day has a stored summary with a mediating factor, and proactively weave it into that morning's interpretation before the user has a chance to spiral — e.g. "remember yesterday was the birthday dinner — if the scale's up a bit today, that's expected water/food weight settling, not fat. Eat normally today when you're hungry, don't swing the other way and restrict."

Stored daily summaries become the natural building blocks for the weekly roundup below, rather than needing to reprocess all raw chat weekly.

## The Weekly Roundup

**Delivery, event-based, not a fixed clock time:** chained directly onto Sunday's Daily Roundup close-out. Whenever Sunday's day gets closed out, the weekly roundup prompt follows immediately: *"Ready to close out the week and round up?"*

**Minimum-days threshold:** the week needs at least 5 of 7 days "full" (defined below) before a full roundup is offered. Below that threshold, no full roundup is attempted — instead, Unflump asks how the person has been feeling about daily logging, branching based on the answer:
- Ordinary friction (busy, forgot, too much effort) → practical help, e.g. a frequently-used-items quick-tap shortcut for common meals, or proactive weekly meal-planning help (distinct from the reactive Meal Advisor — this is planning the whole week ahead, and the resulting plan is a natural fit for the Almanac).
- Something more concerning (avoidance, shame, restriction-adjacent language) → the established care-first response (Part Two, principle 5), not practical tips.

**"Full" day, defined:** at least one food-log entry exists that day, regardless of when during the day it was logged. Body measurements and activity are not held to this same daily standard, since neither is naturally meant to happen every single day. Retrospective catch-up entries count toward a day being logged.

**Order:** a brief warm opening, grounding data (weekly totals, this week's delta), interpretation woven in (personal context from the week's stored daily summaries, plus any relevant physiological context), a thematic/narrative observation, a trajectory/ETA estimate if the data genuinely supports one, then a closing checkpoint using genuinely open phrasing.

**Confidence placement:** attached locally to the specific number it affects (e.g. next to a TDEE estimate: "based on 5 of 7 days logged, so take this as indicative"), never a blanket disclaimer at the top. This is also how missing days are handled in any weekly calculation — excluded from the number, not estimated as zero, with the confidence note stating honestly how many of the 7 days the calculation actually rests on.

**Trajectory/ETA:** stated only when the data genuinely supports it — never guessed confidently off sparse or noisy data. If there is not enough data, say so honestly rather than omit the topic entirely.

**Thematic reflection** lives inside the roundup chat message itself, not a separate dashboard section, since the weekly roundup is already an anticipated moment worth building on rather than competing with.

**"Then & Now"** replaces the idea of an "all time progress" chart — a plain table (first reading / latest reading / % difference), not a chart, since a simple numeric chart can undersell what has actually changed for a user (relationship with food, confidence) and a table grounds any delta in the real numbers it came from rather than presenting an abstract figure. Deliberately modest naming, since it only claims to show two points in time.

**Streak/whoosh handling:** the "whoosh" effect (a scale plateau despite genuine sustained deficit, followed by a sudden drop) is physiologically specific to Fat Focus-reduce only — there is no equivalent for fat gain or muscle gain. It is referenced conversationally within the roundup when relevant, never as a persistent dashboard element, and never presented with more mechanistic certainty than the evidence supports (see explanation script below). The dashboard shows a simple minimized 7-day table instead (date, weight, body fat %, muscle, ± versus previous day, weekly total) — this works identically regardless of Fat Focus/Muscle Focus combination.

**Whoosh explanation script, calibrated:** the practical pattern (plateau then drop, while genuinely in deficit) is real and common; the specific proposed mechanism (fat cells retaining then releasing water) is not a formal scientific term and remains an unconfirmed hypothesis. Confident about the pattern, honest about mechanism uncertainty: *"the leading explanation involves temporary water retention, though the exact cause isn't fully settled — what matters is this pattern is well-recognized and expected."* Once 2-3+ whoosh events have been observed for a specific user, Unflump can add a personalized layer stored in the Almanac: *"...it varies from person to person, but based on what I've seen with you, your flat periods tend to run about [X] days."*

---

# PART TEN: THE ALMANAC

A living, practical reference — not a static profile page — that grows entirely from real conversations and holds goals, personal plans, and anything the user wants kept within easy reach.

**Core principle: no dead pages.** The Almanac contains only what has actually been discussed and saved. It never has pre-built empty sections waiting to be filled — an untouched "Sleep" heading would undermine the warmth of the feature and read as content-bloat rather than support.

**Structure:** conceptually replaces a traditional profile area, but standard account items (settings, sign-out) remain separate and standard, not folded into the Almanac.

**First-view introduction, post-onboarding:**
> "This is where we'll keep all your goals, personal plans, and anything else you feel you need to keep within easy reach. Just click here any time you need to. Do you have any questions about this area?"

An always-present icon gives return access. If asked what else could go in it, examples are offered (physical constraints, movement plans, checklists) rather than presenting a form to fill in. A genuine open choice is offered on whether to add more now or wait until settled into a logging routine.

**Editing:** the Almanac itself is read-only as a page — no direct in-page editing, keeping the visual clean. An edit icon next to each entry opens a chat dialogue: *"What would you like to update or change?"* This means there is exactly one entry point for Almanac data (Unflump itself), so there is no separate direct-edit logic to keep in sync with the conversational logic.

**Save-prompt mechanic:** any time a real plan emerges from ordinary conversation (an exercise routine, a drink-minimisation plan, a weekly meal plan) in response to an obstacle in the user's way, Unflump proactively asks: *"Should we save this to your Almanac?"* This closes the loop opened at onboarding — plans do not evaporate into chat history, they are offered a permanent home at the exact moment they are created.

**Pattern staleness and re-confirmation** (see also Part Two, principle 6): applies to anything saved here, not only whoosh timing. When new data meaningfully contradicts a saved pattern or plan, Unflump surfaces the discrepancy and asks rather than silently updating.

**Exercise demonstration content:** for movements where form matters (e.g. a dead bug, or anything with a timing/sequencing component that a static image cannot convey), the Almanac needs visual demonstration. Prefer calm, animated demonstrations over real video — this is consistent with the brand's calmer, less intrusive tone, and it also sidesteps body-representation concerns that real-video libraries raise. AI-generated video/animation is explicitly rejected for this purpose: exercise form is safety-relevant, not cosmetic, and current AI video generation can produce subtly incorrect movement, risking genuinely bad form rather than a minor inaccuracy. Use a licensed animation library instead. The Almanac provides individual movement building blocks (a squat, a stretch, a pose) that Unflump sequences into a bespoke plan for a specific user's goal — it does not need to license every possible pre-assembled routine, consistent with the Almanac's bespoke-plan philosophy generally.

---

# PART ELEVEN: THE GRADUATION MOMENT & CONSOLIDATION PHASE

This names the app's actual exit condition — a deliberate point of difference from products designed to maximise ongoing engagement.

**Design principle:** the app's own tracked data can only ever be a proxy for "arrived." Real markers of success (a handstand achieved, a cholesterol number improved) live as static facts in the Almanac, never as scored data. The system does not claim to know when someone has truly arrived — only the user can judge that, which is why every step below offers a genuine open choice rather than declaring success.

**Full sequence:**

1. **Habit formation** — 9 weeks for any specific behavioural focus to become automatic.
2. **Consolidation begins** once Fat Focus and Muscle Focus are both sustained at "maintain."
3. **Consolidation is sustained for 9 weeks.**
4. **At that point, a modest offer, not a celebration:**
   > "You've been in maintenance for both Fat Focus and Muscle Focus for a while now — that's real, sustained work. How do you feel about it? Do you want to keep logging for a while longer, or would you like to see if you can fly solo for a while and see if it's become intuitive behaviour?"
5. **If "fly solo":** a modest acknowledgement only, not a celebration — that is reserved for step 8. The app enters lite mode: streaks and bars pause (per-area, reversible, freezing rather than declining or penalizing), while data, the Almanac, and chat all remain fully accessible.
6. **Weekly check-ins begin in lite mode**, not a single distant checkpoint. Real regain/struggle risk stays meaningfully elevated for a long stretch after any behaviour change (documented — see Resources), so staying lightly, gently present throughout is the correct response, not a single check after a long silence.
7. **Each check-in is genuinely supportive, not a logging nudge:** *"How's it going? Anything you'd like to reopen, brainstorm, or just talk through?"* This covers three real paths, each reusing an existing mechanism: reopening a specific paused logging area, revisiting or amending a struggling Almanac plan, or simply being heard — genuine space to talk through constraints, disappointment, or insecurities, with no expectation of an immediate fix.
8. **Adaptive cadence, never a settings toggle.** If check-in responses show consistent disengagement over roughly a month, the cadence gently reduces — but never below a floor of once every 6 weeks, maintained across a full 2-year window. Any check-in can always be freely ignored, with no penalty. The adjustment itself happens conversationally ("you can tell me anytime if this feels like too much"), never via a settings toggle — a dedicated "pause check-ins" button would turn a caring gesture into cold administration.
9. **Real graduation happens organically**, whenever a check-in confirms sustained thriving — not tied to a single fixed date. This is the moment that earns genuine celebration.
10. **At the 2-year mark specifically, a distinct, bigger celebration** — this is the point where the celebration and the actual research on durable behaviour change genuinely align (see Resources), different in kind from the more modest acknowledgements at earlier stages.

Throughout, celebration language follows the intrinsic-validation and no-comparison principles (Part Two, principles 2). A struggle after graduation is normal and expected, not a failure of the app's promise — celebration language should never imply a permanent guarantee the evidence cannot support.

---

# PART TWELVE: HEALTH CONTEXT & SAFETY

## Health Context
Generic macro logic can conflict with individual health needs — an AI optimising purely for calories and protein has no way to know a food it would otherwise flag as expendable is medically indicated, unless it is told.

**What is captured**, optional at onboarding and re-promptable at any time: LDL/HDL/cholesterol, blood glucose/HbA1c, ferritin/iron, TSH/thyroid, and diagnosed conditions (PCOS, IBS, hypothyroid, T2D, and similar).

**How it changes AI behaviour:** injected into the system prompt alongside macro targets. Elevated LDL protects oats, lentils, beans, and apples as priority foods and flags saturated fat at point of logging. Low ferritin protects red meat and leafy greens from being sacrificed for macro ratios. PCOS prioritises low-GI carbs without assuming total carb reduction is the right lever. Borderline HbA1c adds contextual sugar/refined-carb flags. IBS notes high-FODMAP foods rather than freely recommending them as protein or fibre sources.

**Disclaimer, visible inline wherever AI guidance touches a health marker, not buried in terms and conditions:**
> "This takes into account the health context you've shared. Dietary changes that affect medical markers should always be confirmed with your GP or dietitian."

## Nutrient Depth Beyond Macros
Protein/kcal tracking alone misses things that matter (cholesterol, omega-3s, micronutrient density). Handled passively and AI-inferred from food already logged, not a new manual logging burden — Unflump notices patterns and flags occasionally, not via a daily micronutrient tracker. Prioritized by whatever the user has already disclosed via Health Context, rather than a generic one-size-fits-all scan.

## Cross-Cutting Safety Principle
If a user's stated or implied goal would put them into an unsafe range (e.g. a target that calculates to underweight BMI once height and weight are known), Unflump does not hard-block or freeze the app, but it does change behaviour: flags it clearly and kindly at the point the target is set, stops providing precise numeric coaching built on the unsafe goal (data can still be logged, but active coaching toward the number stops), and offers a resource once without repeating it unprompted every session. This mirrors disordered-eating handling generally and applies anywhere a goal or logged pattern looks like it is drifting unsafe, not only at initial goal-setting.

## Allergies & Dietary Restrictions
Stored as a hard, structured constraint (a dedicated field), never soft conversational context — an allergy is a safety issue, not a preference, and must not risk being lost if conversational context is ever truncated in a long session. Applied as a hard filter on any future food suggestions.

## Zero-Calorie Drinks (Water, Coffee, Tea)
Specifically about zero-calorie intake, distinct from drinks with real nutrition (a latte's milk is already handled by existing smart-default logic in regular food logging). No new table or system is needed — these already flow correctly through the existing free-text/photo logging pipeline, since the AI correctly recognises "black coffee" as roughly zero calories. What is needed: a quick-tap shortcut for common zero-calorie drinks (removing the friction of typing each time), and ensuring this data feeds the existing pattern-recognition architecture (the same "personal pattern, earned only after 2-3+ occurrences" model already used for whoosh-timing) — tracing links between intake and symptoms like bloating or digestion specifically for that user. As with all pattern-tracing, these are always framed as personal patterns in the user's own data, never general scientific claims, particularly given genuinely mixed general research on topics like artificial sweeteners and appetite.

---

# PART THIRTEEN: CYCLE TRACKING

**Data model:** a `cycle_events` table (date, type). The user logs a period start once; cycle day for any entry is calculated automatically thereafter, never manually entered per-entry.

**Discovery prompt, triggered when:** no period has been logged in roughly 35+ days since the last one, or the user has never logged one at all. Framed as an invitation, never a nag: *"Want to add cycle tracking? Some people find it explains patterns in energy, cravings, and weigh-ins they hadn't connected before."* Dismissible, and does not repeat aggressively if declined.

**Downstream use, once cycle data exists:** scale readings, cravings, energy, and bloating are interpreted in cycle context automatically rather than as standalone data points — e.g. flat or raised readings during expected late-luteal water retention are read as expected, not as a plateau or setback.

---

# PART FOURTEEN: PUSH NOTIFICATIONS

**Underlying delivery mechanism** (banner, notification list, tap behaviour) is standard OS behaviour handled by the `expo-notifications` library — no custom design needed there. What genuinely needs deciding, feature by feature, is covered below.

## Daily Reminder
**Permission is asked at the first log**, not as a generic upfront prompt: *"Would you like help remembering to log?"* If yes, three options are offered: "2pm and 8pm" (a sensible default starting cadence), "Custom times" (free entry), or "No reminders, I've got this."

**Adaptive taper, tied to consistent logging.** "Consistent" is defined as 100% for food logs specifically over a 9-week window — meaning at least one food entry exists that day (presence, not completeness, consistent with the Accuracy Philosophy below). Body measurements and activity are not held to this same standard. Retrospective catch-up entries count. Once reached, Unflump checks in at the standard weekly roundup moment, using intrinsic validation and no comparison to other people (Part Two, principle 2):
> "You've been logging consistently for 9 weeks now. Building a new habit like this is genuinely hard — showing up for yourself, day after day, even on the days that were harder than others. How does it feel, having stuck with it this long?
>
> Would you like to keep the daily reminders going, or do you feel ready to try without them?"

## Daily Roundup Trigger
See Part Nine for the full mechanism — the evening checkpoint branches between the reminder, the invitational roundup prompt, or silence, depending on that day's logging state.

## Weekly Roundup Trigger
See Part Nine — event-based, chained onto Sunday's Daily Roundup close-out, gated by the 5-of-7-days minimum threshold.

## Tap-Through Destinations
- Daily reminder → opens chat, ready to log.
- Daily Roundup prompt → opens directly on that day's roundup.
- Weekly roundup → opens directly on the weekly roundup message.

## Quiet Hours
No notifications fire between 9pm and 7am, regardless of what triggered them.

## Deferred/Bundled Delivery
Notifications suppressed by quiet hours are not discarded or fired individually the moment quiet hours end — they are deferred and bundled into a single 7am notification, acknowledging the delay warmly rather than presenting stale content as if it just happened.

**Landing message for the bundled case**, appearing only when something was actually suppressed overnight — ties in the existing recommendation that morning readings are the most reliable measurement condition:
> "Good morning, [Name]. I hope you slept well.
>
> This is a great moment to log this morning's readings, if you have them — mornings tend to give the clearest numbers. I've also got yesterday's roundup ready whenever you'd like it [+ "and the week's, too" if Sunday] — no rush at all."
>
> **[Let's catch up]** **[Just log this morning]** **[Not right now]**

---

# PART FIFTEEN: VISUAL DESIGN

## Brand Colour
**Terracotta** — warm, earthy, calm, deliberately chosen over anything bright/neon or clinical/corporate.

- Used as accent, not dominant colour: the discuss-card eye icon's "has discussion" state, buttons and interactive elements, the Layer 1 navigation spotlight glow, the app icon.
- Needs a warm neutral partner — a warm off-white or cream, not stark white — so terracotta sits against it as the accent, not the wallpaper of the whole app.

**Light and dark mode, both supported — the same two colours, swapped roles, not four separate colours to manage.** In light mode, warm white is the background and terracotta is the accent. In dark mode, the roles invert: terracotta becomes the background, warm white becomes the text/foreground colour. The same terracotta hue used as a small accent and as a full-screen background with body text on top are genuinely different jobs — text readability has stricter contrast requirements than a small highlight does — so the dark-mode version may need very slight tuning from the literal light-mode hex for comfortable readability, while remaining unmistakably the same colour family to the eye. This is normal design-execution work, tested with real contrast checking, not a research question.

**Mode is a deliberate, persistent user choice** — set once, stays that way. It does not follow the phone's system setting automatically and does not shift through the day.

Exact hex values are left open for real design work; the concept and direction are locked here.

## Loading State
A slow, calm line-drawing animation, in terracotta, of the Unflump logo itself gradually being drawn — not a generic spinner. A loading moment is an opportunity to reinforce identity, not a throwaway technical necessity.

## Error States
Errors stay in Unflump's own calm voice, never generic system text, and nothing gets lost just because something went wrong.

- **Connection drops mid-log** (a real, common scenario for a native app): the entry is queued locally and retried automatically once connection returns. *"Saved for now — I'll finish this once you're back online."* Never penalise the user for bad signal.
- **Photo genuinely unreadable** (distinct from ordinary confidence-flagging, which handles uncertain reads — this is complete failure to parse anything): a warm fallback to text, *"I couldn't quite make that out — want to just tell me what it was instead?"*
- **General/unexpected failures:** calm, on-brand, always with a clear next step, never blaming the user or surfacing raw technical language.

## Accuracy Philosophy
Unflump is not trying to be a nutrition scientist — it is trying to build understanding over time. Free-text estimation without weights has error margins, but the errors are consistent and cancel over time. A logged approximation beats an unlogged meal every time. Weekly averages smooth daily variation. Systematic under-logging is absorbed into trend calculations — consistency matters more than precision. The differentiator is low friction, good enough, consistent, and accumulating context.

---

# PART SIXTEEN: BUILD ORDER

**Already built, retained through the native pivot without changes:** the Supabase database (`food_logs`, `body_measurements`, `activity_logs`, `chat_messages`), all backend API routes (`parse-food`, `parse-activity`, `parse-body-measurement`, `ask-unflump`).

## Phase 0: Platform Migration Foundation
1. Configure the Supavisor transaction-mode connection pooler on the backend (applies only if/when direct Postgres connections are ever introduced — the current REST-client architecture does not require this today, but the requirement stands for any future direct-connection code).
2. Scaffold the React Native/Expo project within the monorepo.
3. Set up native navigation structure.
4. Retire the old web frontend entirely — API routes untouched.
5. Verify connectivity end to end: confirm a basic native screen can successfully call an existing API route from a real device, before building anything further.

## Phase 1: Native Feature Build
1. Core schema foundations — the routing layer, Fat Focus/Muscle Focus fields, custom-metric generalization for body measurements, the equipment-status field, onboarding-progress and deferred-topic tracking, the pause mechanism, the `cycle_events` table.
2. Muscle-mass-based protein calculation — reads existing `body_measurements.muscle_kg`.
3. Basal metabolism trend view — reads existing `body_measurements.bmr`.
4. Onboarding conversational flow, as fully scripted in Part Seven.
5. Wire real authentication — Supabase Auth, Google OAuth and email/password, enabling Row Level Security with proper per-user policies now that real accounts exist. Required before beta distribution; the account-creation screen built as a UI shell in step 4 gets its real Google/email sign-in wired here. The onboarding conversation itself (equipment segue, goal-setting, and the rest) stays a scripted UI shell until step 7.
6. Auth-state listener, covering two distinct requirements that share the same underlying mechanism:
    - **Metadata sync.** Sync `auth.users` metadata into `user_profile` on reauth — needed for the case where a user signs up, doesn't get an immediate session (email confirmation pending), later confirms via email, and reopens the app with no existing mechanism to sync their data at that point.
    - **Route guarding.** Redirect a signed-out user away from `(tabs)` (Chat/Almanac/Dashboard) and into onboarding/sign-in, and redirect a signed-in user with incomplete onboarding into the appropriate onboarding step. Named explicitly here rather than assumed bundled in, since discovered during 10a verification that `(tabs)` currently renders fully with no active session — confirming this was never actually built, not just deferred. This is also what Part Four's navigation note meant by "needs a real session-restoration/auth-state listener (step 6) to gate on."

    Genuinely part of finishing auth properly, not deferred indefinitely; sequenced immediately after step 5 for that reason.
7. Wire onboarding to real AI-driven conversation, replacing the scripted UI shells built in step 4 — required before onboarding can actually adapt to freeform answers, branch on distress signals, or reflect goals back per Part Seven's actual design. Named explicitly so the scripted shells are a tracked commitment, not a deferral that quietly becomes permanent. The safety-boundary classification and response language for emotionally open moments is grounded in `UNFLUMP_LANGUAGE_RULES.md` (MI-based, alongside the C-SSRS for the ambiguous/acute tiers) — not restated here; that document is the actual working reference the onboarding-chat system prompt is built from.
8. Health Context capture flow, woven into onboarding.
9. Cycle tracking discovery logic — needs the `cycle_events` table from step 1.
10. Wire basic chat-based logging in the native app. Every food/activity/measurement-related step from here on assumes this baseline exists; nothing before this point in the build order actually builds it. Identified as a real gap during step 7, not assumed away — inserted here rather than discovered partway through step 11 later. Split into two, since one half needs a native module and the other doesn't:
    - **10a. Text-only.** Free-text logging in the Chat tab — food and activity, both already text-capable on the backend, plus general Q&A via the existing `ask-unflump`. No native dependency at all.
    - **10b. Photo input.** `parse-body-measurement` is photo-only on the backend (no free-text path exists), so body-measurement logging belongs entirely here rather than to 10a. Needs `expo-image-picker` — batch for a later native rebuild alongside the Almanac's animation library and notifications, per the Beta Tester 1 milestone note above.
11. Itemized food breakdown and its rules.
12. Protein quality flagging UI — needs itemized breakdown (step 11).
13. The "What's In Here" discuss-card.
14. Data confidence bars (9-week habit bars) and the catch-up mechanism.
15. The Almanac.
16. The "Then & Now" table and the minimized 7-day dashboard table.
17. Daily nudge and weekly close-out nudge notifications.
18. The Daily Roundup and its theme-extraction mechanism.
19. The Body Measurement Interpretation Layer — needs cycle tracking (step 9).
20. The Weekly Roundup — needs theme-extraction (step 18).
21. Nutrient depth flagging — needs Health Context (step 8).
22. The Meal/Order Advisor — a standalone, reactive feature suggesting choices given remaining daily targets and a stated context; can be built whenever convenient once core logging is mature.
23. In-app navigation Layer 1.
24. The Graduation moment and pause-mechanism trigger logic.
25. In-app navigation Layer 2 — a fast-follow, not part of the initial build pass.
26. Zero-calorie drinks quick-tap shortcut.

## Distribution
Beta testing does not need to wait for the full build. Once real authentication (step 5), the auth-state sync listener (step 6), and real onboarding conversation (step 7) are wired, and itemized food breakdown is working natively (roughly through Phase 1, step 11), a build can be shared directly with a small number of testers via Expo's internal distribution, with no app store review required. App store submission (Apple, $99/year; Google, $25 one-time) is deferred until genuinely ready for wider public distribution, handled through Expo's EAS Submit.

**Milestone — ready to share with Beta Tester 1 (Matty).** Not feature-based, distribution-based: not ready until every remaining native-module addition is complete — basic chat-logging's `expo-image-picker`, the Almanac's licensed animation library, and notifications' `expo-notifications`. EAS Update can only push ordinary JS/TSX changes over the air, not new native libraries, so sharing before all three land would mean Matty needing a manual reinstall each time one does. Once all three are done, everything remaining ships via EAS Update with zero reinstalls required. Not a reason to reprioritize the build order — a checkpoint to notice once naturally reached, not chased.

---

# DEVELOPMENT WORKFLOW PRINCIPLES (reusable beyond this project)

These principles govern how building actually proceeds, distinct from the product-design principles in Part Two — worth keeping separate since they're reusable for any future project, not specific to Unflump.

1. Trust logic and spec review over visual verification for ordinary work. Today's real catches (an auth-timing gap, a steps-tracker equipment mismatch, a missing onboarding screen) all came from careful spec review and reasoning through consequences — none came from visually checking a rendered screen. Rebuilding and installing an app specifically to look at an ordinary screen is usually not worth the time and token cost it takes.

2. One real exception: verify visually the first time a genuinely new native capability is introduced. Native module integration (a new library requiring its own build, like a date picker or a health-data permission) is a different risk category from ordinary UI or logic work — failures here are harder to diagnose after the fact, and if several native additions stack up unverified, a later failure can't be traced to which one caused it without re-testing all of them anyway. Verify each new native capability once, in isolation, right when it's introduced.

3. Batch verification around natural milestones, not artificial checkpoints. Don't force an early visual check just because a step is "done" — wait for the point where a real, complete user journey becomes naturally reachable end to end (e.g. once auth and routing make onboarding actually navigable), and do one thorough pass there rather than many small ones along the way.

---

# PART SEVENTEEN: DATA RETENTION & RESEARCH USE

**All data is retained indefinitely, not pruned after a certain age.** This is a deliberate choice: it enables genuine longitudinal research to be possible later, using real data from day one, rather than starting fresh once research becomes a serious consideration.

**Research or aggregate use of data requires a separate, explicit opt-in**, distinct from core consent (see the consent screen in Part Seven) — never bundled into general agreement to use the app. "De-identified" is used in all user-facing language, not "anonymised" — rich conversational health data is genuinely hard to make fully untraceable, especially in an early dataset with few users where individual patterns stand out; overpromising here risks a real trust break if a user later feels misled.

A real deletion mechanism must exist for anyone who wants their data removed, independent of whether they opted into research use — this is a standing right, not conditional on that checkbox.

---

# NOT CURRENTLY IN SCOPE

*These are genuinely parked, not forgotten and not silently dropped — they simply are not part of the current build.*

- **Long-term training-response research thread** — whether meaningful, identifiable training-response phenotypes exist among women 40+ who lift seriously. Requires real users and opted-in longitudinal data before it is meaningful; not a build-phase concern.
- **Mailing list opt-in incentive** — the "keep me posted" consent checkbox will go largely unticked without a real reason to opt in. Needs an actual incentive designed before pushing on this; capturing contacts opportunistically now would be wasted effort.
- **The full "lite mode" experience beyond the pause mechanism** — what the app becomes for a long-term graduated user, and any formal re-engagement flow beyond the weekly check-ins already scoped in Part Eleven.
- **Barcode scanning, social/sharing features, a paid tier, and dedicated joint pain/recovery tracking** (captured as free-text notes for now, not a structured feature).

---

# RESOURCES
*Research backing specific decisions in this document. Revisit if the underlying science changes.*

- **Consumer bioimpedance scale accuracy:** commonly cited at ±3-5% versus gold-standard methods (e.g. DEXA) under consistent conditions.
- **Body recomposition, general population:** well documented in beginners, returning trainees, and higher body fat individuals; becomes marginal in lean, advanced/trained lifters. This general literature is not reliably sex-disaggregated.
- **Body recomposition in older women specifically:** a study of roughly 99 older women (average age ~69, 24-week resistance training) found the *lowest* baseline fat mass group showed *greater* positive recomposition than moderate/high fat mass groups — the opposite direction to the general pattern.
- **Body recomposition in trained women:** a study found over half of participants in an 8-week resistance training study recomposed with no dietary intervention at all.
- **Weight loss resistance across menopause:** survey-based research shows this increases through perimenopause and peaks postmenopause, in resistance-trained women specifically.
- **Perimenopause hunger/ghrelin:** a study of 40 women found heightened appetite and elevated ghrelin specifically during perimenopause versus pre- and post-menopausal stages.
- **Habit formation timeline:** a 2009 UCL study (Lally et al.) found habits formed in a range of 18-254 days, averaging roughly 66 days overall; "eating healthier" specifically averaged roughly 59 days. Used to set the 9-week habit-formation window used throughout this document.
- **"Whoosh effect" (scale plateau during deficit):** not a formal clinical term. The underlying mechanisms it is thought to involve (glycogen-water binding, cortisol-mediated water retention) are established physiology; the specific "fat cells fill with water" causal story remains an unconfirmed hypothesis, with academic review finding a genuine lack of dedicated research. Commonly reported plateau duration is 1-3 weeks, drawn from community/clinical observation rather than tightly controlled research.
- **Weight maintenance duration and regain risk:** National Weight Control Registry data found the single best predictor of avoiding weight regain is how long weight loss has already been maintained — individuals who had sustained loss for 2+ years had markedly higher odds of continuing to maintain it. Used to calibrate the Graduation Moment's celebration timing and language honestly.
