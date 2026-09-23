# Overnight queue

The list the scheduled overnight sessions work from. Each run starts with no
memory of any conversation, so this file is the only thing it knows.

**Rules for a run**

- Work the READY items **in order**, as far as you get. Finish each one properly
  before starting the next. Do not skip ahead because something looks quicker.
- Commit and push each finished item with a real message.
- Move it to **Done** below, with the date and one line on what happened.
- If an item turns out to need a decision, move it to **Needs Ruth** with the
  question written out, and take the next READY one instead.
- Never invent work that is not on this list.
- Read `docs/where-things-go.md` before saving anything for her. It does not go
  in the scratchpad and it does not go in a new folder.

**Before you stop, leave the hand-back** (asked for 23 September 2026)

She wants this waiting when she arrives, not assembled once she asks. Write it
as a plain message, and put any file it refers to where that doc says:

1. What got done, with the commits.
2. What broke or got stuck. Honestly, including anything abandoned.
3. What needs her, kept separate from what does not.
4. Today's list, in a sensible order.

**Never, in an unattended run**

- Delete or move any of Ruth's files or data, anywhere. That includes the
  Dropbox cleanup, which is hers to trigger.
- Create accounts, enter credentials, or make any payment.
- Send an email, publish anything, or submit to a store.
- Change Vercel production settings, environment variables, the domain, or
  anything that costs money.
- Force-push, rewrite history, or merge a branch into main without review.

---

## Ready

1. **Nothing is sent until the whole reply exists.** Measured 23 September:
   time to the FIRST word and time to the LAST word were identical across
   eight turns, median 6.6s. `spokenCompletion` awaits the whole reply before
   sending, so ElevenLabs cannot start speaking until generation ends.

   Read how the classifier and escalation state machine use the finished text
   BEFORE touching this: a turn that will be replaced by a safety response must
   not already have been half spoken. Reproduce with
   `node scripts/measure-voice-turn.mjs 5`.

## Needs Ruth

- **Three header decisions, mocked up and waiting.** Plans, the Log entries
  screen, and the Settings affordance, three options each, side by side:
  https://claude.ai/artifact/KcyUwqcYUxVHoDLoShj6Pr
- **The report appendix.** Options written up with a recommendation, in
  Build Specs > 2026-09-23 Report appendix - options.docx. Not built.

- **`_To process` can be emptied, when she says so.** Checked 24 September,
  read only. `/Selodia Team Folder/_To process`, 149 clips plus the metadata
  sheet, 385 MB, all dated 17 September. Every single one of the 149 is already
  in the library (919 clips). It is a staging copy of that release and holds
  nothing the app does not have. Re-check any time with
  `node scripts/check-to-process.mjs`. Hers to delete, not mine.
- **Dropbox cleanup.** Unmount the vendor folder, confirm the namespace read
  still works, then delete the duplicate. Steps are in `docs/library-mirror.md`.
  Needs her at a keyboard, and nothing may be deleted without her confirming.
- **Google Play Console** — paid and the account verification is submitted.
  Waiting on Google.
- **Apple Developer enrolment**, $99/year, same D-U-N-S 235125707.
- **Store artwork** — icon, feature graphic, screenshots for the listing. The
  40 screenshots taken on 23 September are a starting point, but read the
  flagged list first: several carry data that reads as a real person's.
- **A new phone build.** The EAS build quota is spent until 1 October. The APK
  she has is the one from 20 September; everything since reaches her as an
  over-the-air update on that build, which is why the app has to be closed and
  reopened twice to pick changes up.

## Done

- 2026-09-24 — Two contradictory readings of one weigh-in. The note had an
  empty dependency array and never re-read; it also duplicated the
  acknowledgment, which composes from the same function.
- 2026-09-24 — Photo upload to a report: the feature was right, the refusal was
  wrong. Attachments are documents by her 21 September decision; the message
  suggested better lighting for something that can never work.
- 2026-09-24 — "Settings" clipped for the third time. The 19 September fix was
  on the corner placement only, and Today uses the inline one.

- 2026-09-24 — `_To process` inspected, read only: 149 clips, 385 MB, every one
  already in the library. Safe for her to empty. Nothing touched.

- 2026-09-24 — Voice turn measured, the part we own: median 6.6s to the first
  word, and the first word arrives at the same instant as the last. Numbers in
  the ElevenLabs notes for the 24 September meeting. Measurement only; the
  streaming fix is queued above rather than made at 3am.
- 2026-09-24 — Close-out for sessions 50, 51 and 52. 38 checklist rows, 11
  decisions, 3 patterns in DECISION_PATTERNS.md.
- 2026-09-24 — A drink named alongside food was dropped entirely. Two faults:
  the model omitted it despite an emphatic prompt, and parseVolumeMl had never
  heard of a flat white. Verified against the real model three times.

- 2026-09-22 — Recovery from sleep, rest days and "rest day today". 30 probes.
- 2026-09-22 — Cycle cards can be hidden; the Arrange link the Log page had.
- 2026-09-22 — Live verification of the food and drink fixes against the real
  model, with a stubbed database. Found that the itemisation retry is
  load-bearing: the model still merges on its first pass.
- 2026-09-23 — Library mirror finished: ~20,600 files, ~137 GB into Backblaze.
- 2026-09-23 — Hardening sweep: health-connect was imported at module scope and
  would have killed Today on iOS; the web override was missing an export;
  BLUETOOTH_CONNECT was never requested, so the 18 September headphone fix had
  never worked on Android 12 or later.
- 2026-09-23 — Lint and type sweep, whole repo.
- 2026-09-23 — Supabase performance advisors, never run before: 41 RLS policies
  re-evaluating auth.uid() per row, 4 duplicate policies, 5 missing FK indexes.
  All clear now.
- 2026-09-23 — `store-wording` branch: it does not exist. The work was merged
  and is live; /privacy, /support and /delete-account all answer.
- 2026-09-23 — Screenshots of all 40 screens, and the flow map poster composed
  from them. Notes and the re-run steps are beside them in the scratchpad.
  Found that `/log` and `/plans` were unreachable on the web build (af497fb).
- 2026-09-23 — Speed, round two, measured rather than guessed. Two findings,
  both fixed: the chat route ran four independent database reads one after
  another before every reply (275ms serial, 149ms batched), and two files
  imported the `@expo/vector-icons` barrel, which shipped every icon family —
  42 font files and 12 MB of assets, down to 25 files and 8.8 MB.
- 2026-09-23 — Screen map artifact regenerated, same URL.
