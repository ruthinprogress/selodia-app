# Unflump — Workflow & Collaboration Process
*This document exists because process knowledge, learned across many sessions, was at real risk of being lost if this chat ever ended or a new one started. It is not product spec — see SELODIA_SPEC.md for that, and SELODIA_LANGUAGE_RULES.md for the safety-language grounding. This document is about how Ruth, Claude (chat), and Claude Code actually work together.*

---

## The Three Documents, and Where They Live
- **SELODIA_SPEC.md** — the current, authoritative, present-tense build specification. Lives in the repo at `mobile/SELODIA_SPEC.md`. Claude Code is the sole editor.
- **SELODIA_MARKETING_SPEC.md** — the brand and marketing spec: a human-facing document for designers, copywriters and collaborators. **Moved into the repo 2026-09-09**, having lived only in Drive under `Branding/Marketing Articles and Copy/` — version-controlled nowhere, rendered never, and readable by nobody since it was written. The Drive original is **archived, not deleted**: it was the only copy until the moment it was committed, and deleting the sole source of a document to tidy up its output is not a trade worth making. It is **not** synced to the five-document Drive folder; it reaches Ruth as Word like everything else.
- **SELODIA_LANGUAGE_RULES.md** — the MI-grounded safety-boundary language rules. Lives in the repo at `mobile/SELODIA_LANGUAGE_RULES.md`. Referenced by the spec, not duplicated into it. Claude Code is the sole editor.
- **WORKFLOW.md** (this document) — process and collaboration knowledge. Lives in the repo at `mobile/WORKFLOW.md`.

**All three are also synced to Google Drive**, at `H:\My Drive\Selodia App Project Master Folder\Build Specs\Claude Code Working Build Specs` — a folder on Ruth's local machine that syncs automatically to Drive. Claude Code writes directly to this local path (it is not a manual download/upload step) **— but only when Claude Code is executing ON the laptop.** See the session-type caveat below; a remotely-executed session cannot reach this folder at all. Claude (chat) has read access to this Drive folder and can check it directly. **Rule for this specific folder: one file per document, always overwritten in place — never dated copies.** Older, superseded versions of documents living *elsewhere* (e.g. the old versioned V3-V8 history document, kept deliberately as a record of the project's reasoning) are not touched or deleted — that rule only applies within this one working folder.

**Why the repo is the real source of truth, not this chat:** Claude Code is the sole editor of the spec documents specifically so there is never a risk of Ruth's own copy and Claude Code's copy silently diverging. If this document or either spec document is ever unclear or seemingly contradicted by what's actually in the app, the repo wins, always.

---

## Where Status Goes, and Why Not in the Prose (set 2026-09-09)

**Status claims do not belong in prose sections. Decisions and reasoning do.** This is the single convention that would have prevented the most expensive documentation failure this project has had.

**The evidence, not an opinion.** On 8 September, nine claims in `SELODIA_SPEC.md` were found to be false — a table count wrong by ten, a domain described as unused that had been live for five days, a permission described as undeclared that was declared, a feature marked "not yet built" four days after it shipped, a divergence note describing a state corrected the following day, and a build-order block that contradicted the paragraph directly above it. Every one had been true when written.

**Timestamping does not fix this, and we know because the spec already timestamps.** Almost every one of those nine carried a date — *"KNOWN DIVERGENCE, found 2026-09-02"*, *"flagged 2026-08-21"*, *"opened 2026-09-01"*. A date records **when a sentence was written**, never **whether it is still true**, and those are different facts. Only the second matters to whoever is reading. A date arguably makes it worse: *"verified 2026-09-02"* reads as checked, and it *was* checked, and then the code moved.

**The rule:**

- **Prose sections carry decisions, reasoning, and what was rejected.** *"Custom LLM, not dashboard-selected Claude, because dashboard Claude bypasses the safety classifier"* is true permanently. Reasoning cannot go stale — the decision was made for those reasons whatever happens next. This is the spec's real value and the thing that could not be reconstructed from the codebase.
- **Status lives in Part Sixteen and nowhere else.** The spec already says Part Sixteen is authoritative for build status. **All nine stale claims were status sentences living somewhere else.** One place to check is a place that gets checked; nine places scattered through 52,000 words is nine places that do not.
- **Timestamps stay on decisions.** *"Decided 4 September"* tells a future reader when the thinking happened and what the context was, which is genuinely useful and does not rot.

**The test, when writing a sentence into any of these documents:** *could a commit make this false?* If yes, it is status — put it in Part Sixteen, or leave it out and let the code answer. If no, it is reasoning, and prose is exactly where it belongs.

**When a status claim genuinely has to sit in prose** — because the surrounding reasoning is incomprehensible without it — write what it *was* and mark it as history rather than as the present: *"the last recorded successful build **at that time** was 2026-08-09"*. A sentence in the past tense cannot go stale.

**Automated on 2026-09-09, because the revisit condition fired.** The paragraph that stood here held the tooling back on purpose — *"the rule above costs nothing and might be sufficient on its own… Revisit if drift recurs after this rule is in force."* The rule went in on 8 September. On the 9th, **five** more status claims were found false: the hydration quick-tap marked unbuilt in two places while it had eight real rows in the database, conversational personal-metric correction marked unbuilt twelve days after it shipped, item 35 marked unbuilt with both its tables carrying rows, and the Weekly Roundup described as having "no weekly route" beside a 243-line route file. The convention was in force and the drift recurred anyway, so this is the revisit it asked for rather than a decision being overridden.

```
python scripts/closeout_check.py
```

**The first version guessed, and was wrong four times out of four.** It looked for a not-built claim, found any file, table or route named nearby, and flagged a contradiction if that thing existed. Every one of its four hits was false — *"no such test"* matched the source file rather than a test, a claim about the unbuilt Almanac **screen** matched the `almanac_entries` table, and this document's own history of the nine stale claims matched the spec's filename. **Proximity cannot recover which artefact a sentence is about.** A checker that cries wolf on its first run is one nobody runs twice, so the guessing was removed rather than tuned.

**What it does instead, in two halves.**

- **The inventory, always.** Every status claim across the six documents on one scannable page, with line numbers. It asserts nothing about correctness — it puts the claims in front of someone who knows the app, which is precisely how the hydration one was caught. Roughly thirty claims today; a minute to scan.
- **Verified claims, opt-in and exact.** A claim can name what would disprove it, inline: `<!-- verify: table hydration_logs -->`, `<!-- verify: file src/x.tsx -->`, `<!-- verify: route /api/weekly-roundup -->`. The checker tests that one thing, with no inference, so **false positives are structurally impossible**. Markers get added as claims are written; coverage grows without anyone retrofitting 52,000 words in an afternoon.

It also does the mechanical half of ceremony step 1 — working tree, push state, and the five Drive documents byte-identical — which was being done by hand each time.

**A claim already written as history is skipped**, honouring the escape hatch above: a sentence in the past tense cannot go stale, so the tool must not nag about one. **This does not replace the convention.** Status still belongs in Part Sixteen; the check is a net under it, not permission to scatter claims again.

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

**Why this matters:** the loop preserves genuine decision-making authority with the person who holds the product judgment, *without* requiring her to have technical implementation fluency. The two translation layers — intent → plan-request, and proposal → plain-terms-with-a-recommendation — are what make that possible: Ruth decides the things that are actually hers to decide, on their real merits, while implementation detail stays where it belongs. This is a reusable collaboration pattern, not specific to Unflump — the same treatment as the Development Workflow Principles (SELODIA_SPEC.md): worth carrying into any future project where the person with the domain judgment is not the person with the build fluency.

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
3. Sync the current spec documents (SPEC, LANGUAGE_RULES, and now WORKFLOW) to the Drive folder, overwriting in place. **Check first whether this session can actually do that — see below.**
4. The Checklist and the Decisions Log are no longer updated by hand: see **Automated close-out** below, which runs without being asked. Still manual here: the session log (session number, date, location, start/end time, duration, cumulative time from Toggl, what was done, what's next, notes) in the Google Sheet ("Unflump App Builder Mastersheet").
5. Update the Glossary in the same sheet if new technical or process terms came up.
6. Push everything to GitHub as the final step.

### Automated close-out (standing, from Session 36)

This runs at the end of **every** session without being asked. It replaces the paste-ready tab-separated block that used to be printed into chat for copying by hand; that format is no longer produced.

**1. Verify the session is actually closeable.**
Working tree clean, everything pushed, and all five Drive documents byte-identical to their repo originals. Verify with `cmp`, not by assuming the copy landed. If this session is executing remotely there is no `H:` drive, so the write is impossible and the ceremony must say so plainly rather than appear to succeed (see the section above).

**2. Append this session to both sheets of the close-out workbook.**

`H:\My Drive\Selodia App Project Master Folder\Build Specs\Selodia-Session-Closeouts.xlsx`

Two sheets, and only ever two. One tab per session was tried on 2026-09-02 and replaced the same day, because a log you scan for "when did we decide that" wants one continuous column, not thirty tabs.

| Sheet | Columns |
|---|---|
| `Checklist` | Task \| Status \| Date \| Notes |
| `Decisions` | Decision \| Date \| Reasoning |

Both run oldest at the top, newest appended at the bottom. Before each session's rows: one blank spacer row, then a sand-filled label row in the established format, **`S36: 3Sep26`** (`S<number>: <D>Mon<YY>`). Keep to that format rather than inventing a new one per session, because the label is the thing being scanned for. It is deliberately short so it would still fit a sheet tab if these ever need splitting out again (confirmed 2026-09-03).

Status values: Done, Diagnosed, Unresolved, Queued, Outstanding. The status cell is colour-filled, green for Done and Diagnosed, terracotta-tint for Unresolved, cream for the rest. **Unfinished work gets a row saying so**, carried forward as Queued or Outstanding. A close-out that only lists wins is a worse record than no close-out.

Reasoning is the *why*, not the what: the thing that would otherwise have to be re-derived in three months. Not every choice earns a row, the same bar the decision patterns doc uses.

**3. Confirm the rows are actually there.**
Read the saved file back and report the sheet names, the new label row and its row number, and the new row count. Do not report success from the fact that the write did not raise.

**Two traps, both hit on 2026-09-02:**

- **If the file is open in Excel, the save fails** with `PermissionError`. Build to a staging copy first, swap it in after, and never force-close Excel to take the lock. Losing someone's unsaved work to finish your own task is not a trade that is yours to make.
- **No Excel Table objects.** A Table cannot carry interior label or blank rows, and its fixed range fights appending at the bottom. Plain formatted ranges, with the header row frozen.

**4. Render the readable copies.**

```
python scripts/render_docs.py
```

**Ruth cannot read `.md`.** That is a fact about her setup, not a preference, so the markdown in the repo is a source format she has no way to open — and until 2026-09-08 the 52,000-word build specification was, in her own words, a document she no longer knew the contents of. This step is what closes that gap, and it runs **after** the Drive sync in step 3, because it renders from the markdown that step just wrote.

It renders **all six** working documents, plus the articles:

| Output | Where |
|---|---|
| Six `.docx`, one per working document | `Build Specs/Spec Documents (Word)/` |
| One `.docx` per build-log article, named `YYYY-MM-DD Title.docx` | `Build Specs/Branding/Marketing Articles and Copy/` |

**Their own folder, not loose in `Build Specs/`** (2026-09-09). They sat at the top level for a day, mixed in among the close-out workbook, the build log and five subfolders, and were genuinely hard to pick out.

**Deliberately NOT inside `Claude Code Working Build Specs/`.** That folder runs one file per document, and a `.docx` sitting beside its own `.md` is exactly the duplication that rule exists to prevent.

**Every working document, and the reason it is worth stating.** The first version of this step rendered the specification alone, because that was the one being asked about — leaving four Ruth still could not open, including the language rules the whole safety architecture is built from. The brand and marketing spec joined on 09-09 for the same reason, having been readable by nobody since it was written. **A seventh document goes in the `DOCUMENTS` table at the top of the script** — that is the whole change, since the contents page, the styles and this step all follow from that table.

**Not into the five-document folder, deliberately.** That folder holds exactly five files and step 1 verifies all five byte-identical against the repo; a sixth breaks that check. Derived renderings live one level up.

**Every output stamps the commit it came from.** That is the point rather than a flourish: this project's most persistent documentation defect is a status claim that was true when written and silently stopped being true — nine were found and fixed on 2026-09-08 alone — and "which version am I holding" is the question that catches it. A rendering with no provenance would reproduce the exact failure it exists to help with.

**Each file opens on a real contents page** of clickable internal links — not Word's Navigation Pane, which is a side panel someone has to know to switch on. Both work; only one of them works without being told about it.

**The contents page cannot go stale, and that is the whole design.** It is not maintained — it is rebuilt from the document's own headings on the same pass that writes the body, so a new section appears in the contents the first time it is rendered and a deleted one disappears. There is no second list to keep in step, which is the failure this project has hit repeatedly everywhere else.

**It is deliberately not a Word TOC field.** A field renders as "Right-click to update" until somebody does, and prints page numbers that are wrong the moment anything reflows. Live links are correct the instant the file is written and ask nothing of the reader.

**Both the contents page and the Navigation Pane rest on real `Heading 1/2/3` styles.** If a future change makes headings merely *look* right — bold text at a larger size — the links stop being generated and the pane silently empties, with no error to notice.

**A thin contents page means a flat source document, not a broken render.** `DECISION_PATTERNS.md` yields three entries because its patterns are bold paragraphs rather than headings. That is worth fixing in the markdown if the patterns are ever wanted as an index.

**If the Drive folder is unreachable the script writes nothing and says so**, rather than failing halfway — the same remote-session caveat as step 3.

**5. Append this session to the build log.**

`H:\My Drive\Selodia App Project Master Folder\Build Specs\Selodia-Build-Log.docx`

If the file does not exist, create it with a table of contents at the top. Append in this shape, and update the table of contents afterwards:

```
Session [N] · [Date] · [Location] · [Start time] · [Tools: Claude / Claude Code / both]
Toggl session: — Ruth fills in

[One to three paragraphs.]
```

**Prose, not a list.** This is the one artefact in the close-out that is written rather than tabulated, and the difference is the point: the workbook records *what* and *why* in cells, and this records what it was actually like. Past tense, specific, narrative. Written at the level of detail that would be useful to a build-diary article a year from now, by which time nobody remembers why any of it happened.

Name real things. Real commit hashes, real decisions, real moments. **If something went wrong and got fixed, say so** — including when Claude Code caused it. A build diary that only records the parts that went well is a marketing document, and it is worthless for the thing a diary is for. The Chrome processes killed twice on 2026-09-02 belong in it exactly as much as the asset pack that shipped the same day.

Direct and frank, no padding. Do not pad a quiet session into three paragraphs; one honest paragraph is a better record than three inflated ones.

Leave the Toggl line as written, with the em-dash placeholder. Ruth fills that in by hand, and a guessed duration in that slot is worse than a blank one.

**6. Session details are required, and are checked BEFORE any of the above runs.**

Despite its number, this is the gate on the whole ceremony rather than its last step. Four things must be known:

- Session number
- Location
- Start time
- Tools used (Claude / Claude Code / both)

**If any are missing, ask, and do not start the ceremony until they are answered.** None of the four is inferable. The session number in particular has already been ambiguous once, on 2026-09-04, when a session opened as "session 35" with 35 and 36 both already logged — and a wrong number in a running log is worse than a delayed close-out, because every later entry inherits it.

The Toggl session number is the exception: optional, and Ruth fills it in manually.



---

### Where the session is EXECUTING decides whether the Drive sync is possible (learned 2026-08-27)
"Ruth is on her laptop" and "Claude Code is running on the laptop" are **two different facts**, and only the second one matters for step 3 of the close-out. A session driven from the laptop can still have its agent executing in a remote container — which is exactly what happened on 2026-08-27, and the ceremony silently failed: everything was committed and pushed, the spec had a full day of additions, and the Drive copy was left stale at 218,181 bytes against the repo's 228,505.

**How to tell, in one command**, before relying on step 3:

```bash
ls /mnt/h /mnt/c "$HOME/Google Drive" 2>/dev/null || echo "no laptop filesystem — remote session"
```

A remote session has no `H:` and no Windows filesystem. The same limitation explains three other things that surprised us the same day: `api.expo.dev` blocked by the container's proxy (so `expo install` failed and a package version had to be pinned by hand), no `eas-cli` and no `EXPO_TOKEN` (so the build could not be triggered from the session), and Metro having to run on the laptop rather than in the session.

**Google Drive's own MCP tools are not a substitute.** They can create files and change metadata, but cannot overwrite an existing file's *content* — and creating a second file would break this folder's one-file-per-document rule. So a remote session must **not** improvise a sync; it should verify and report instead.

**What a remote session should do at close-out:** compare byte sizes and hashes against the Drive copies, state plainly which documents are stale, and hand over the exact copy command. The verification is genuinely useful; the write is not available.

**Note the filenames still differ** between repo and Drive, which makes an accidental duplicate easy: `SELODIA_SPEC.md` → `selodia-build-specification.md`, `WORKFLOW.md` → `selodia-workflow.md`, `SELODIA_LANGUAGE_RULES.md` → `selodia-mi-language-rules.md`, `DECISION_PATTERNS.md` → `selodia-decision-patterns.md`, `SAFETY_ARCHITECTURE.md` → `selodia-safety-architecture.md`. Both sides were renamed from `unflump-` on 2026-09-02; the two naming conventions remain deliberately different, because the Drive copies are read by Ruth's other Claude usage and are addressed by those exact names.

---

## Real Technical Gotchas Learned the Hard Way

- **This Vercel project *does* have Git integration — `git push` to `main` auto-deploys the backend.** (Corrected 2026-08-12: an earlier version of this note claimed the opposite, based on an incorrect inference from CLI output that was never actually verified. Confirmed directly by timestamp correlation — a push triggered a new production deployment ~60 seconds later — and by checking response headers on the live production URL afterward. `vercel --prod` still works as a manual trigger when needed, but it is not required for an ordinary commit to go live.)
- **EAS builds and Vercel deploys are separate systems for separate halves of the app.** EAS builds the native mobile app binary; Vercel deploys the Next.js backend API. A backend fix needs a Vercel deploy (which now happens automatically on push); a new native library needs an EAS build. Neither one covers the other.
- **EAS environment variables are separate from `.env.local`.** A variable working in local development does not mean a fresh EAS build will have it — it must also be set in EAS's own environment store (`eas env:create` or equivalent) for future builds to include it.
- **RENAME STATUS (was a gate; the gate is now met and the entry rewritten 2026-09-04).** The Vercel rename used to be blocked behind the native build batch, because it turns off `unflump-app.vercel.app` and that was the host every installed build called. All three preconditions have since been satisfied and the rename has happened, so the block below is a record rather than a plan.

  **Done:**
  1. `EXPO_PUBLIC_API_URL` set to `https://api.selodia.app` **in EAS**, in all three environments — verified 2026-09-04.
  2. Builds shipped carrying it: `c0bbc84e`, `40225246`, `74eb995d`.
  3. Confirmed on a device against `api.selodia.app` — proved by observed traffic, not configuration: five POSTs to `/api/ask-unflump` on that host in the Vercel runtime logs, and zero on the old one.
  4. Vercel project renamed `unflump-app` → **`selodia-app`** (matching the GitHub repo, `ruthinprogress/selodia-app`). `api.selodia.app` survived, because a custom domain attaches to the project rather than to its name.

  **Still outstanding, in rough order of risk:**
  - **`unflump-app.vercel.app` is still live and still serving.** The rename did not retire it: it is an explicitly assigned alias, 55 days old, and a rename does not revoke assigned aliases. Left deliberately, because any build from before the env-var change still calls it. Removing it (`vercel alias rm`) is the step that actually breaks those installs, and is harder to reverse than the rename was — the name returns to Vercel's pool.
  - **`app/api/ask-unflump` → `ask-selodia`.** The route directory and its 27 references across 16 files, plus the log prefixes inside it. A pure rename with no behaviour change, but it touches both halves of the app at once and every client call site must move in the same commit or chat breaks outright. **Note the adapter at `app/v1/chat/completions` calls it too** — that is easy to miss, because it is the only caller that is not a client.
  - **`owner: "unflump"` and `android.package: "com.unflump.mobile"` in app.json.** The package name is the high-risk one: changing it makes a NEW app to Android, not an updated one, so it cannot be installed over an existing build and any Play listing would start again. Not to be touched outside a session scoped to it.
  - **The EAS project itself** — `extra.eas.projectId` and `updates.url` both point at project `cd63f8e6`, which lives under the `unflump` EAS account. Renaming the account or moving the project invalidates the update URL for every installed build.
  - **Supabase project display name** is still "Unflump". Dashboard-only; no MCP tool and no CLI path for it.
  - **Four archived documents** still carry the old name in their contents: `Selodia_Brand_Manifesto.md`, `Selodia brand colours — UPDATED.md`, `selodia-all-screens_2026-08-17.html`, `Selodia-Brand-One-Page.pdf`.

- **Native module additions need a fresh EAS build; ordinary JS/TSX changes don't.** Once a build exists with a given native module, everyday code changes can reach it via `EAS Update` (over-the-air), no reinstall needed. Only genuinely new native capabilities require a fresh install.
- **Development builds need a live local dev server (Metro) running to load at all** — a "blank screen" on the installed app is very often just this, not a real bug. Check `port 8081` status before assuming something is broken.
- **Local Claude Code sessions are laptop-only — no bridge to mobile after the fact.** If phone-based visibility into a session is wanted, it must be set up as a **Remote Control** session (or Cloud) from the start, not switched to partway through. Remote Control requires a Max plan; enable it with `/remote-control` in-session, and `/config` → "Enable Remote Control for all sessions" to make it the default going forward, rather than needing to remember to enable it each time.
- **Remote Control has a visibility limitation worth knowing:** if the relevant browser tab isn't actually focused/visible, Claude Code's own automated screenshot/interaction tools may not reliably work — in that situation, it's often faster for the human to test directly and report back than to keep retrying remote automation.
- **The backend has no historical log retention on this plan — only live streaming works.** `vercel logs` (without `--follow`) and the dashboard's Logs tab both come back empty for anything that already happened; there is no way to retroactively pull a past request's log. To diagnose a failure, a fresh `vercel logs --follow` must be running *before* the request is resent.
- **CORS has to be handled explicitly for a backend that didn't originally have a same-origin frontend.** This backend was built API-only after its original same-origin web frontend was retired, and never had cross-origin request handling added. A browser-based client (web preview) calling it fails at the CORS preflight with a generic "Failed to fetch" — no server-side error, nothing in logs, because the browser blocks the request before it's ever sent. This affects every route uniformly when tested from a browser; it does not affect the native app on a real device, since CORS is a browser-only mechanism.
- **Dropbox folder downloads are streaming zips with no reliable `Content-Length`, so a browser will silently finalise a truncated file as if it were complete.** There is nothing for the browser to compare against, so any interruption yields a plausible-looking dead archive: right extension, believable size, no warning. The tell is that `unzip -l` fails with *"cannot find zipfile directory"* and the last bytes hold no end-of-central-directory record — and note that the file may be *large* and still truncated (one attempt died at 9.0 GB). **This cost three consecutive failed attempts on the same archives before it was diagnosed**, each looking successful at the point of download. **The reliable fix is to download subfolder-by-subfolder rather than as one large archive: twelve subfolder downloads completed cleanly where three whole-archive attempts had failed.** Use subfolder downloads by default for any future large vendor content pull over Dropbox, and **always verify an archive opens before trusting it** — never on filename or file size alone.
- **Killing a Metro process mid-write can corrupt the generated `.expo/types/router.d.ts`** (typed routes), leaving it truncated so `tsc` fails with parse errors *inside that generated file*. The tell is that the errors are confined to `.expo/types/router.d.ts` while actual source is clean — confirm by re-running `tsc` and checking nothing outside `.expo/types` errors. The fix is not to debug the file: delete it and let Metro regenerate it fresh (`expo start` briefly). It's gitignored, so there's no repo impact.

---

## Visual verification

Drawings and illustrations must be rendered and visually inspected before committing — typecheck and lint are not sufficient. A geometry error that reads obviously wrong on screen is invisible to static analysis.

Precedent: the Almanac empty-state shoot (f273b31) drew a flag on a pole twice before the geometry was right. Only caught by rendering to PNG and looking at it.

Standing exception to the skip-visual-verification default: any component whose primary output is a drawing or illustration.

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
  - **Tier 2 — a day's confirmed final (Claude Code's role).** Once a day's work concludes and a version is confirmed as that day's final result, it becomes the new current reference, and the **previous day's** final version (not the intermediate same-day drafts — those are already gone) is **moved to the `Selodia archive` folder** (`…/Selodia App Project Master Folder/Selodia archive`). Claude Code moves prior confirmed-day versions to the archive when a new one is confirmed — but **never trashes anything itself.**
  - **Claude Code's role, in sum:** it may *view* anything in the Branding folder for context; it *archives* prior confirmed-day finals when a new day's final is confirmed; it never deletes/trashes. (No contradiction with the "never dated copies" rule above: that governs the separate *Claude Code Working Build Specs* folder; this governs the *Branding* folder. End state is the same in spirit — one current reference, real milestones preserved in the archive, same-day noise discarded.)
  - **Caught gap (2026-08-16) — a cross-day overwrite silently skips Tier 2.** If a new day's work is saved *over the previous day's dated file under the same name* (e.g. today's mockup written on top of `unflump-all-screens_2026-08-15.html` instead of a fresh `…_2026-08-16.html`), the prior day's confirmed-final bytes are gone from disk before the archive step can run — there is nothing left to move, and the archive step is silently missed. **Guard:** each new day's version must be saved under **today's** dated filename, never overwriting the prior day's file, so yesterday's final survives on disk to be archived. If an in-place overwrite has already happened, the genuine prior bytes are only recoverable from **Google Drive's own version history** ("Manage versions") — a cloud-only feature, not reachable from the synced folder or Claude Code's Drive tools, so that recovery is a manual step (or a browser-driven one), after which the recovered file is archived. Prefer the real recovered bytes over any reconstruction. The archive step can only ever move a file that still exists.
  - **Screen-flow legibility convention (2026-08-17) — for how mockups/screen-flow docs are laid out, going forward.** A parent screen and its "zoomed-in" detail screen (reached via an eye icon or similar) should be shown **adjacent to each other, with the triggering action visually labelled** (an arrow or equivalent), so the navigation logic reads at a glance rather than being inferred from screen order. Apply this as a standing convention for future mockups, not a one-off — navigation should be legible from the layout itself.
- **Historical decision-log documents (the versioned V3 through V8 series)** — intentionally preserved as a record of the project's reasoning and evolution, not deleted, not actively maintained now that the clean SPEC/LANGUAGE_RULES documents exist as the live source of truth.

---

## Permissions Boundary (set 12 August 2026)
Claude Code has full autonomy on code changes, local commands, builds, and reading logs — no need to ask permission for these.

Always flag first, no exceptions:
- Anything touching Vercel production settings, environment variables, domain configuration, or anything that costs money
- Triggering an EAS build specifically (real time cost, not just money)
- Any destructive or irreversible database change (dropping a column/table with real data, not additive migrations)
- Any git operation that rewrites history (force-push, or anything that could lose commits) — distinct from normal commit/push
