# Overnight queue

The list the scheduled overnight sessions work from. Each run starts with no
memory of any conversation, so this file is the only thing it knows.

**Rules for a run**

- Work the **first READY item** only. Finish it properly, then stop.
- Commit and push each finished item with a real message.
- Move it to **Done** below, with the date and one line on what happened.
- If an item turns out to need a decision, move it to **Needs Ruth** with the
  question written out, and take the next READY one instead.
- Never invent work that is not on this list.

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

*Empty.* Everything queued on 22 September is done. Add the next thing here
before the next unattended run, or it will have nothing to do.

## Needs Ruth

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
