# Report — 1 October 2026, 21:30

Block A done. Block B not started. The B and C work is the next sitting.

---

## A1. The sentence, and why your phone still showed it

**You were right and my report was wrong.** The sentence *was* fixed — in the
privacy policy. I corrected it there, wrote a report saying the claim was gone,
and **left the app's own copy standing in a different file**. At 21:15 you read
the one I had not touched.

I searched every user-facing string in the app and the server: **395 files, one
occurrence, now gone.** The only remaining mentions are my own comments
explaining the bug.

**Which update your phone was running: I cannot tell you, and that is the
problem.** The corrected text went out at about 21:00 and you opened the sheet at
21:15. Whether it had downloaded, whether you had relaunched — nothing on the
screen said. That is exactly what A2 fixes, and it is why I could not answer the
question honestly before now.

**The real fault is not the missed file.** It is that *"is this claim gone?"* was
answered by remembering which files I had edited. That is not a method. There is
one now — see A2.

---

## A2. Version on Settings, and a check that cannot be fooled

**At the bottom of Settings:** `Version 1.0.0, update 8895eb97`. Selectable, so
you can read it out or paste it.

`BuildVersion` already existed with more detail and a "Get the latest update"
button — on Settings → **About**, one tap further in. Tonight that tap was the
difference between knowing and guessing.

**`scripts/check-audio-claims.mjs`** fails if any user-facing text says audio,
voice or a recording is not kept, not retained, not stored, deleted, discarded or
temporary. Comments are excluded — the file explaining a bug is the file most
likely to quote it.

**Proved by putting your exact sentence back** and watching it go red:

```
FAIL  no screen claims audio is not kept, retained or stored
      mobile\src\components\voice-consent-sheet.tsx: The audio isn't kept.
```

It also checks the shared paragraph still names both companies and states the 3
years, and that the screens use the shared paragraph rather than their own copy.

---

## A3. Turning voice off — there was no way to

**You asked for the tap path and finding it is what found the bug: there wasn't
one.** `recordVoiceConsent` set the stamp and **nothing anywhere cleared it**.
Consent granted one tap from the chat box could only be withdrawn by somebody with
database access.

That is not defensible for a permission covering a microphone and a third-party
processor — consent has to be as easy to withdraw as it was to give.

**Built. The paths are now:**

- **To turn it OFF:** Home → **More** → **Privacy** → **Voice** → **"Turn off
  voice"**.
- **To turn it ON:** the **microphone** in the chat box on Home. The sheet
  explains what happens to your voice before anything is sent, which is why
  turning it back on is deliberately *not* a settings toggle — a silent re-grant
  would be consent without the information attached.

The row says plainly what turning it off does **not** do: the transcripts stay in
your chat thread, and ElevenLabs keeps its copy for up to 3 years either way.
Offering it as an erasure would be the same untrue comfort in a new place.

---

## A4. Your wording, in one place

Your paragraph is now a single constant, `lib/processor-wording.ts`, rendered by
**both** the consent screen and the voice sheet:

> To understand what you write or say, Selodía sends it to Claude, an AI model
> made by Anthropic. If you use voice, what you say goes to ElevenLabs to be
> turned into text. Neither company uses it to train its AI models. ElevenLabs
> keeps the audio and the transcript for up to 3 years.

**One string, not four.** That is the whole lesson of tonight: four copies is four
chances for one to rot, and the one that rots is the one being read at the moment
somebody decides whether to speak. The policy carries the same facts inline
because it is a different workspace, and the check holds the two together.

Both removed sentences are gone: *"Both may use it only to reply to you"* and
*"Claude does not keep what it is sent for training"*. The voice sheet keeps one
extra line the others do not need — *"What you say is saved to your chat thread
like any other message"* — because it is the only screen where somebody is
deciding whether to speak, and the surprise is that the words persist afterwards.

**Anthropic's retention: I am not going to give you a number.** What is recorded
from their DPA is that it does **not** authorise training, and that data is
deleted within 30 days **on termination of the agreement**. That is not the same
as how long an ordinary request is held, and I have not read a figure for that.
Writing "30 days" into the policy would be exactly the mistake that produced "the
audio isn't kept" — a reassuring number nobody checked. Your paragraph does not
claim one, so the screen copy is safe as written.

**No new consent version.** The bump to "1 October 2026 (revised)" is still
pending on your phone — you have not answered it yet — so this wording lands
*before* the re-ask rather than after it. You will be asked once, on the final
text.

**No em dashes** in any of the new copy.

---

## Still outstanding, and not mine

1. **ICO registration reference** (C2047751 is the application number).
2. **A solicitor**, at 100 subscribers.

---

## D. Status of the five you asked about

| | |
|---|---|
| **Rules into chat** | **Not started.** `user_rules` is written by chat on a confirmed offer and enforced in code when a session is built; what does not exist is chat being able to *read them back* or discuss them, the way it now reads her week. |
| **The "this week" window** | **Not started.** Chat still gets a fixed recent-history window rather than a week-aligned one. |
| **Report Builder placement and vote button** | **Not started.** No work done today. |
| **Meal totals vs items** | **Partly done.** Removing an item re-states the parent's totals correctly (`check-food-item-remove.mjs`, 30 Sept). *Adding* an item to a logged meal is the next task in block C and is not built. |
| **Write-confirmation guard live on production** | **Done and live.** The app states a write, never the model: save claims are stripped, a failed write says so, and tonight's duplicate confirmation is fixed. Verified against production today — medication 11/11, skincare 7/7, week 13/13. |

---

## What I have not started

**Block B, all seven findings** — the empty first draft, the duplicate goals, the
keyboard covering the text box, sardines not saving, the week writes not saving,
the targets, and Valsalva.

Two of those are the same shape as the week deletion and I would start there:
**sardines** and **the week writes** both say "That did not save" after claiming
success, and B1's empty draft is probably the same root — something is failing on
write and the draft is reading from somewhere other than the database.

**Block C** — add an item to a meal, Skills Stage 1, the 11-step Google Doc.
