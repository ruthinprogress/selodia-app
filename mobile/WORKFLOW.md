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

## The Prompt-Handoff Convention
Claude (chat) always gives Ruth the exact text to send to Claude Code, in a clear, copyable block — never a vague description of what to ask for. Once something is agreed in this chat (a design decision, a correction, a scope choice), it gets turned into an explicit, ready-to-send instruction before the conversation moves on. This exists so agreed decisions don't get diluted, re-explained inconsistently, or lost in translation between the design conversation and the actual build instruction.

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

---

## Project Setup Lessons (For Any Future Project, Not Just This One)
- **Set up dedicated accounts (email, and any tooling accounts) for a new project from day one**, not retrofitted later once things are already tangled with personal accounts. This was raised explicitly as something to insist on earlier next time, even if it creates minor friction upfront.
- **A specific test/beta account should be treated as a real, ongoing account**, not a disposable throwaway — worth choosing something usable long-term rather than something to be deleted right after.

---

## Where Other Things Live
- **Checklist, Decisions Log, session logs, Glossary** — Google Sheet, "Unflump App Builder Mastersheet."
- **Competitor research (Milo, Lila, etc.)** — kept separate from the build spec entirely, since it's strategic/positioning context for Ruth, not something Claude Code needs to build the app.
- **Branding/visual design exploration** — its own separate Drive folder, not part of the technical spec.
- **Historical decision-log documents (the versioned V3 through V8 series)** — intentionally preserved as a record of the project's reasoning and evolution, not deleted, not actively maintained now that the clean SPEC/LANGUAGE_RULES documents exist as the live source of truth.

---

## Permissions Boundary (set 12 August 2026)
Claude Code has full autonomy on code changes, local commands, builds, and reading logs — no need to ask permission for these.

Always flag first, no exceptions:
- Anything touching Vercel production settings, environment variables, domain configuration, or anything that costs money
- Triggering an EAS build specifically (real time cost, not just money)
- Any destructive or irreversible database change (dropping a column/table with real data, not additive migrations)
- Any git operation that rewrites history (force-push, or anything that could lose commits) — distinct from normal commit/push
