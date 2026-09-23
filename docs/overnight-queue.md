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

1. **Screenshots of every screen.** Start the Expo web server
   (`preview_start` name `expo-mobile-web`, raise Node memory — it has run out
   before), sign the demo account in by minting a session with the Supabase
   service role key from `.env.local` (never type a password), then capture each
   route at phone size. Routes are listed in `mobile/src/app`. Save to the
   scratchpad, not the repo.
2. **Compose the flow map poster** from those screenshots with Pillow: screens
   grouped by tab, arrows for the real navigation, ready to hand to ChatGPT.
   Flag any screenshot showing something that looks like Ruth's real health data
   rather than test data.
3. **Hardening sweep.** Look for more faults of the missing-GestureHandlerRootView
   kind: providers absent from the tree, native modules imported at module scope,
   setup that was never wired. Report findings; fix only the unambiguous ones.
4. **Lint and type sweep** across the whole repo, not only recently touched files.
5. **Supabase performance advisors** — only the security ones have ever been run.
6. **Speed, round two.** Measure cold start, chat send and the voice path with
   real numbers, then fix the worst single thing. Measurement first; no guessing.
7. **Review the `store-wording` branch** (built 19 September, never merged) and
   write up what it changes, so it is a yes or no for Ruth rather than a review.
8. **Regenerate the screen map artifact** from the router tree — it is stale:
   Hydration renamed, new screen titles, the Cycle history card added.

## Needs Ruth

- **Dropbox cleanup.** Unmount the vendor folder, confirm the namespace read
  still works, then delete the duplicate. Steps are in `docs/library-mirror.md`.
  Needs her at a keyboard, and nothing may be deleted without her confirming.
- **Play Console account**, £25, as Selodía Ltd using D-U-N-S 235125707.
- **Apple Developer enrolment**, $99/year, same D-U-N-S.
- **Store artwork** — icon, feature graphic, screenshots for the listing.

## Done

- 2026-09-22 — Recovery from sleep, rest days and "rest day today". 30 probes.
- 2026-09-22 — Cycle cards can be hidden; the Arrange link the Log page had.
- 2026-09-22 — Live verification of the food and drink fixes against the real
  model, with a stubbed database. Found that the itemisation retry is
  load-bearing: the model still merges on its first pass.
- 2026-09-23 — Library mirror finished: ~20,600 files, ~137 GB into Backblaze.
