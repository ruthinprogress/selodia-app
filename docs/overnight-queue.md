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

*Six from Ruth, 23 September, just before bed. Screenshots in the session.*

1. **Two contradictory readings of the same weigh-in.** Log > Measurements,
   23 September. The card says "Weight's up 0.5 kg since yesterday ... cycle
   day 3" and then, in a separate tinted bubble underneath, "Weight's flat
   since your reading 3 days ago, but you're on your period and yesterday was
   on the salty side."

   Up 0.5 since yesterday, and flat since three days ago, about one weigh-in.
   Both cannot be true and the app is asserting both. This is the worst kind
   because it is health information stated confidently and wrongly. Find out
   which one is stale, or whether two commentaries are being rendered for one
   reading, before changing any wording.

2. **Plans: drop the page title, promote the subheading.** "Plans" over "Your
   movement collection" is saying the same thing twice. Her instinct is to
   make "Your movement collection" the heading in the title face. Mock it both
   ways, side by side, for her to choose tomorrow.

3. **Log: the same double heading, plus a segmented control that now repeats
   the tabs.** "Log" in the nav bar, "Log" again as the page title, then
   Food / Activity / Measurements underneath. Her words: "this is now a double
   entry that doesnt quite make sense ... unless you can suggest another way
   to tidy this up logically." Propose, do not just delete.

4. **"Settings" is cut off in the top right on several screens.** Reads
   "Setting" on Today. Check every screen. Her suggestion: a profile-style
   icon instead. If that is not obviously right, mock up two or three options
   for her to pick tomorrow.

5. **The report's appendix needs a decision, not a build.** For a medical
   reader the original PDF should probably be attached as it is; for a friend
   a summary reads better. The problem she names: a consultant letter loses
   its official weight the moment it is retyped off the hospital letterhead.
   Write up the options with a recommendation. Do not build it.

6. **Photo upload to the report does not work.** Tried from the gallery and
   straight from the camera, neither worked. Find out why first, because that
   is a different problem from the one she then raises: that a photo of a knee
   is hard to identify. Her suggested answer is that the person labels it
   themselves, and her own objection is that they may write "knee" when they
   meant "left knee". Suggestions welcome.

1. **Nothing is sent until the whole reply exists.** Measured 23 September, not
   guessed at. Across eight turns through production, time to the FIRST word
   and time to the LAST word were identical to within a millisecond:

   | | |
   |---|---|
   | response opens | 0.4-0.9s warm, 1.7s cold |
   | first real word | 4.9-12.5s, median 6.6s |
   | turn complete | the same instant, every time |
   | holding line heard | 2 turns in 8 |

   `spokenCompletion` in `app/v1/chat/completions/route.ts` already splits the
   reply into SSE pieces, but only after awaiting the entire thing, so they all
   land together. ElevenLabs cannot begin speaking until the whole answer is
   generated, and "Bear with me a moment" is a plaster over exactly that.

   The fix is to stream Claude's tokens through as they arrive. It touches the
   safety path, which decides things about a whole reply, so read that first:
   a turn that is going to be replaced by a safety response must not already
   have been half spoken. That is the real design question, not the plumbing.

   Do NOT start this without reading how the classifier and the escalation
   state machine use the finished text. Reproduce with
   `node scripts/measure-voice-turn.mjs 5`.

## Needs Ruth

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
