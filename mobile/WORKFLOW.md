# Unflump — Workflow & Collaboration Process
*This document exists because process knowledge, learned across many sessions, was at real risk of being lost if this chat ever ended or a new one started. It is not product spec — see UNFLUMP_SPEC.md for that, and UNFLUMP_LANGUAGE_RULES.md for the safety-language grounding. This document is about how Ruth, Claude (chat), and Claude Code actually work together.*

---

## The Three Documents, and Where They Live
- **UNFLUMP_SPEC.md** — the current, authoritative, present-tense build specification. Lives in the repo at `mobile/UNFLUMP_SPEC.md`. Claude Code is the sole editor.
- **UNFLUMP_LANGUAGE_RULES.md** — the MI-grounded safety-boundary language rules. Lives in the repo at `mobile/UNFLUMP_LANGUAGE_RULES.md`. Referenced by the spec, not duplicated into it. Claude Code is the sole editor.
- **WORKFLOW.md** (this document) — process and collaboration knowledge. Lives in the repo at `mobile/WORKFLOW.md`.

**All three are also synced to Google Drive**, at `H:\My Drive\Unflump App Project Master Folder\Build Specs\Claude Code Working Build Specs` — a folder on Ruth's local machine that syncs automatically to Drive. Claude Code writes directly to this local path (it is not a manual download/upload step). Claude (chat) has read access to this Drive folder and can check it directly. **Rule for this specific folder: one file per document, always overwritten in place — never dated copies.** Older, superseded versions of documents living *elsewhere* (e.g. the old versioned V3-V8 history document, kept deliberately as a record of the project's reasoning) are not touched or deleted — that rule only applies within this one working folder.

**Why the repo is the real source of truth, not this chat:** Claude Code is the sole editor of the spec documents specifically so there is never a risk of Ruth's own copy and Claude Code's copy silently diverging. If this document or either spec document is ever unclear or seemingly contradicted by what's actually in the app, the repo wins, always.

---

## The Three-Way Collaboration Loop
The actual working methodology of this project is a repeating three-party loop, run one verified piece at a time:

1. **Ruth states intent in plain language** — what she wants and why it matters, in product terms, not implementation terms.
2. **Claude (chat) translates it into a scoped plan-request** for Claude Code — turning loose intent into a bounded, well-framed ask rather than a vague forward.
3. **Claude Code proposes a grounded plan** — read against the real codebase and spec, and crucially it often surfaces genuine decisions *neither Ruth nor Claude would have known to ask about*: a schema mismatch, a hidden dependency, a design fork with real trade-offs.
4. **Ruth relays Claude Code's response back to the chat**, annotated with her own reactions or not.
5. **Claude (chat) translates the proposal into plain terms with a genuine recommendation** — not a neutral menu of options, but "here's what it actually means, and here's what I'd do," so the decision is real and informed rather than quietly deferred to whoever sounds most confident.
6. **Ruth decides.**
7. **Claude (chat) turns the decision into a precise, ready-to-send instruction** (see The Prompt-Handoff Convention, below — that convention is this step of the loop).
8. **Repeat, one verified piece at a time** — each round is built, checked, and stood behind before the next begins.

**Why this matters:** the loop preserves genuine decision-making authority with the person who holds the product judgment, *without* requiring her to have technical implementation fluency. The two translation layers — intent → plan-request, and proposal → plain-terms-with-a-recommendation — are what make that possible: Ruth decides the things that are actually hers to decide, on their real merits, while implementation detail stays where it belongs. This is a reusable collaboration pattern, not specific to Unflump — the same treatment as the Development Workflow Principles (UNFLUMP_SPEC.md): worth carrying into any future project where the person with the domain judgment is not the person with the build fluency.

**The loop is self-reinforcing, not just repeatable.** Real decisions made through it are periodically extracted into `DECISION_PATTERNS.md` as genuine patterns in how Ruth exercises judgment — not merely a log of individual choices. Those extracted patterns then feed back into future rounds of the same loop: they shape what Claude Code proposes in the first place, what gets flagged for explicit sign-off versus handled with a reasonable default, and what gets caught before it is ever built. This is the actual mechanism behind the project's increasing pace and precision over time — the system is not just executing faster, it is building an increasingly accurate model of the person directing it.

---

## The Prompt-Handoff Convention
Claude (chat) always gives Ruth the exact text to send to Claude Code, in a clear, copyable block — never a vague description of what to ask for. Once something is agreed in this chat (a design decision, a correction, a scope choice), it gets turned into an explicit, ready-to-send instruction before the conversation moves on. This exists so agreed decisions don't get diluted, re-explained inconsistently, or lost in translation between the design conversation and the actual build instruction.

---

## Design Mode vs Build Mode — Separate Threads
Design exploration and build direction are genuinely different working modes, and they should live in **separate conversation threads**, not tangled into one.

- **The design chat** (a dedicated thread *within this project*, so it shares memory and context) handles free iteration, comparison, and mockup creation — the open, divergent, "try three versions and see" mode.
- **The build/direction chat** (this one) receives *confirmed design decisions* from that thread as **inputs** — the same way it already receives Claude Code's technical findings. The flow is one-directional: confirmed design → build direction, **never the other way around**. Build work does not reach back into open design iteration.

**Why this matters — today's concrete example (2026-08-15).** The Overview / Measurements / Food reconciliation happened *mid-build*: a design realization (Overview being a genuine segment; the BMR/TDEE explainer belonging in Activity; Food being a today's-log rather than the weekly table) surfaced while build direction was already in motion. That forced retroactively tracing and reconciling several already-made decisions — real time spent untangling, that a clean handoff between two separate threads would have avoided entirely. The design would have settled in the design chat first, then arrived here as a confirmed input. Keeping the modes in separate threads is what prevents this class of rework.

---

## Claude Code's Standing Boundaries
- **Never handles account creation, sign-in, or passwords directly** — not even for low-stakes test accounts, not even if explicitly asked and given credentials. This is a hard line, not a judgment call, and it should never be treated as Claude Code being unhelpful — it is working correctly when it declines this and redirects to Ruth doing it herself in her own browser/session.
- **Sole editor of the spec documents** — Ruth does not maintain a parallel copy to hand over. If a correction or addition is needed, it gets described to Claude Code directly, and Claude Code edits the real file.

---

## Session Structure

### Opening a session
Pull the current build order and spec state fresh at the start of every real session — do not work from memory of where things stood last time, even if the last session ended recently. Numbering and scope shift often (insertions, splits, corrections), and Ruth's own genuine strength is product judgment, not build-step bookkeeping — that tracking is explicitly the tool's job, not something to hold in her head. *(This principle is also saved in Claude's own memory, independent of this document, so it persists even in a context where this file hasn't been read yet.)*

### During a session
- Work in small, reviewable steps — one clear, bounded piece at a time, not large bundled instructions.
- **Verify visually only the first time a genuinely new native capability is introduced** (a new native library, a new permission). After that, trust logic and spec review over rebuilding just to look — most real catches this project has made came from careful review and reasoning, not from visually checking a rendered screen.
- **Batch EAS rebuilds** rather than triggering one for every native addition — accumulate several, or wait for a natural testing milestone, rather than rebuilding after each individual change.
- When something seems like a repeat of an earlier bug, verify with real evidence (actual logs, actual browser DevTools) rather than assume the same cause or the same fix applies. Today alone had two visually similar failures ("Something went wrong") with two completely different real causes (a backend JSON-parsing gap, and a frontend auth-check firing before any request was attempted) — surface-level symptoms can look identical while the real cause is unrelated.
- The browser's own Network tab and Console tab (F12 / right-click → Inspect) are the most direct diagnostic tools for the web preview — they show ground truth immediately, without the timing ambiguity of checking server-side logs after the fact.
- **"Cosmetic can wait, structural cannot" applies by the *nature* of the decision, not the document it happens to be found in.** Visual/aesthetic choices (colour, logo, typography, copy tone) can genuinely stay deferred to the end, as originally intended. But information-architecture and navigation decisions — what screens exist, what data lives where, how views relate to each other — are *structural*, even when they surface during "branding" or mockup work, and need resolving early enough to inform the build, not discovered as a mismatch after code has already been written around a different assumption. The distinction is what the decision changes (schema, screen graph, data flow), not which folder or document it was captured in. Concrete example (2026-08-15): the Dashboard/Overview architecture gap — Overview being a genuine switcher segment distinct from Measurements/Food/Activity, not the body-detail view doing double duty — was caught only because Ruth reviewed a mockup mid-build. Had it surfaced later, the Food-view work would already have been built around the wrong container.

### Same-day pause vs. a genuine session close
If a session is pausing only briefly (e.g. a usage-limit reset a few hours away, a lunch break) rather than genuinely ending for the day, a full close-out ceremony is unnecessary token/time spend — a light note is enough. The full ceremony below is for when a session is genuinely wrapping up.

### Closing a session — the full ceremony
1. Confirm everything is committed and the working tree is clean (`git status`).
2. Get a brief current folder/file structure summary from Claude Code (path/type/purpose/layer — lightweight, not exhaustive; a full detailed nested visualization is only generated on request for a specific external reason, like a handover).
3. Sync the current spec documents (SPEC, LANGUAGE_RULES, and now WORKFLOW) to the Drive folder, overwriting in place.
4. Update the Checklist (Set Up / Status / Dates / Notes), the Decisions Log (Decision / Date / Reasoning), and the session log (session number, date, location, start/end time, duration, cumulative time from Toggl, what was done, what's next, notes) in the Google Sheet ("Unflump App Builder Mastersheet").
5. Update the Glossary in the same sheet if new technical or process terms came up.
6. Push everything to GitHub as the final step.

---

## Real Technical Gotchas Learned the Hard Way

- **This Vercel project *does* have Git integration — `git push` to `main` auto-deploys the backend.** (Corrected 2026-08-12: an earlier version of this note claimed the opposite, based on an incorrect inference from CLI output that was never actually verified. Confirmed directly by timestamp correlation — a push triggered a new production deployment ~60 seconds later — and by checking response headers on the live production URL afterward. `vercel --prod` still works as a manual trigger when needed, but it is not required for an ordinary commit to go live.)
- **EAS builds and Vercel deploys are separate systems for separate halves of the app.** EAS builds the native mobile app binary; Vercel deploys the Next.js backend API. A backend fix needs a Vercel deploy (which now happens automatically on push); a new native library needs an EAS build. Neither one covers the other.
- **EAS environment variables are separate from `.env.local`.** A variable working in local development does not mean a fresh EAS build will have it — it must also be set in EAS's own environment store (`eas env:create` or equivalent) for future builds to include it.
- **Native module additions need a fresh EAS build; ordinary JS/TSX changes don't.** Once a build exists with a given native module, everyday code changes can reach it via `EAS Update` (over-the-air), no reinstall needed. Only genuinely new native capabilities require a fresh install.
- **Development builds need a live local dev server (Metro) running to load at all** — a "blank screen" on the installed app is very often just this, not a real bug. Check `port 8081` status before assuming something is broken.
- **Local Claude Code sessions are laptop-only — no bridge to mobile after the fact.** If phone-based visibility into a session is wanted, it must be set up as a **Remote Control** session (or Cloud) from the start, not switched to partway through. Remote Control requires a Max plan; enable it with `/remote-control` in-session, and `/config` → "Enable Remote Control for all sessions" to make it the default going forward, rather than needing to remember to enable it each time.
- **Remote Control has a visibility limitation worth knowing:** if the relevant browser tab isn't actually focused/visible, Claude Code's own automated screenshot/interaction tools may not reliably work — in that situation, it's often faster for the human to test directly and report back than to keep retrying remote automation.
- **The backend has no historical log retention on this plan — only live streaming works.** `vercel logs` (without `--follow`) and the dashboard's Logs tab both come back empty for anything that already happened; there is no way to retroactively pull a past request's log. To diagnose a failure, a fresh `vercel logs --follow` must be running *before* the request is resent.
- **CORS has to be handled explicitly for a backend that didn't originally have a same-origin frontend.** This backend was built API-only after its original same-origin web frontend was retired, and never had cross-origin request handling added. A browser-based client (web preview) calling it fails at the CORS preflight with a generic "Failed to fetch" — no server-side error, nothing in logs, because the browser blocks the request before it's ever sent. This affects every route uniformly when tested from a browser; it does not affect the native app on a real device, since CORS is a browser-only mechanism.
- **Killing a Metro process mid-write can corrupt the generated `.expo/types/router.d.ts`** (typed routes), leaving it truncated so `tsc` fails with parse errors *inside that generated file*. The tell is that the errors are confined to `.expo/types/router.d.ts` while actual source is clean — confirm by re-running `tsc` and checking nothing outside `.expo/types` errors. The fix is not to debug the file: delete it and let Metro regenerate it fresh (`expo start` briefly). It's gitignored, so there's no repo impact.

---

## Project Setup Lessons (For Any Future Project, Not Just This One)
- **Set up dedicated accounts (email, and any tooling accounts) for a new project from day one**, not retrofitted later once things are already tangled with personal accounts. This was raised explicitly as something to insist on earlier next time, even if it creates minor friction upfront.
- **A specific test/beta account should be treated as a real, ongoing account**, not a disposable throwaway — worth choosing something usable long-term rather than something to be deleted right after.

---

## Where Other Things Live
- **Checklist, Decisions Log, session logs, Glossary** — Google Sheet, "Unflump App Builder Mastersheet."
- **Competitor research (Milo, Lila, etc.)** — kept separate from the build spec entirely, since it's strategic/positioning context for Ruth, not something Claude Code needs to build the app.
- **Branding/visual design exploration** — its own separate Drive folder (`…/Build Specs/Branding`), not part of the technical spec. Mockup HTML/image files use **dated filenames** (e.g. `unflump-all-screens_YYYY-MM-DD.html`). Two distinct tiers govern their lifecycle — "preserve real milestones, discard noise," the same principle already applied to the V3-V8 spec history:
  - **Tier 1 — same-day iterations (the design chat's own live workflow).** While iterating toward a decision within a single session/day, each new draft **trashes its immediate predecessor directly — no archiving**. These are drafts on the way to a decision, not meaningful history. This trashing is the *design chat's* live workflow; **Claude Code never performs it.**
  - **Tier 2 — a day's confirmed final (Claude Code's role).** Once a day's work concludes and a version is confirmed as that day's final result, it becomes the new current reference, and the **previous day's** final version (not the intermediate same-day drafts — those are already gone) is **moved to the `Unflump archive` folder** (`…/Unflump App Project Master Folder/Unflump archive`). Claude Code moves prior confirmed-day versions to the archive when a new one is confirmed — but **never trashes anything itself.**
  - **Claude Code's role, in sum:** it may *view* anything in the Branding folder for context; it *archives* prior confirmed-day finals when a new day's final is confirmed; it never deletes/trashes. (No contradiction with the "never dated copies" rule above: that governs the separate *Claude Code Working Build Specs* folder; this governs the *Branding* folder. End state is the same in spirit — one current reference, real milestones preserved in the archive, same-day noise discarded.)
  - **Caught gap (2026-08-16) — a cross-day overwrite silently skips Tier 2.** If a new day's work is saved *over the previous day's dated file under the same name* (e.g. today's mockup written on top of `unflump-all-screens_2026-08-15.html` instead of a fresh `…_2026-08-16.html`), the prior day's confirmed-final bytes are gone from disk before the archive step can run — there is nothing left to move, and the archive step is silently missed. **Guard:** each new day's version must be saved under **today's** dated filename, never overwriting the prior day's file, so yesterday's final survives on disk to be archived. If an in-place overwrite has already happened, the genuine prior bytes are only recoverable from **Google Drive's own version history** ("Manage versions") — a cloud-only feature, not reachable from the synced folder or Claude Code's Drive tools, so that recovery is a manual step (or a browser-driven one), after which the recovered file is archived. Prefer the real recovered bytes over any reconstruction. The archive step can only ever move a file that still exists.
- **Historical decision-log documents (the versioned V3 through V8 series)** — intentionally preserved as a record of the project's reasoning and evolution, not deleted, not actively maintained now that the clean SPEC/LANGUAGE_RULES documents exist as the live source of truth.

---

## Permissions Boundary (set 12 August 2026)
Claude Code has full autonomy on code changes, local commands, builds, and reading logs — no need to ask permission for these.

Always flag first, no exceptions:
- Anything touching Vercel production settings, environment variables, domain configuration, or anything that costs money
- Triggering an EAS build specifically (real time cost, not just money)
- Any destructive or irreversible database change (dropping a column/table with real data, not additive migrations)
- Any git operation that rewrites history (force-push, or anything that could lose commits) — distinct from normal commit/push
