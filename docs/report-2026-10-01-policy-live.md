# Report — 1 October 2026, late afternoon

Privacy policy live, four untrue sentences caught, onboarding note fixed, new
reporting rule adopted.

---

## 1. Privacy policy — LIVE, and four sentences were not true

You said go, and asked me to check every sentence in the special-category
paragraph against the code first. **It found four.** Each was fixed before
applying; none went live as drafted.

### ❌ "They are used for nothing else."

**Not true.** The consent screen takes an **optional second permission**:
*"de-identified data from my use of Selodía to be used to help improve the
product and understand patterns across users."*

And it was worse than my draft. The **live policy already contradicted the consent
screen** — it said your data is not used *"to compare you against other users"*
while the consent screen asks to *"understand patterns across users"*. Two
documents describing one thing and flatly disagreeing, live since 19 September.

**Now says:** the permission exists, it is separate, it is changeable in Settings,
and **nothing is done with it today** — because nothing reads `research_opt_in`.
It is recorded and acted on by nobody. If that changes you will be told first.

### ❌ "Not used to decide anything about you."

**Too strong.** The app decides what to suggest you eat every day. The defensible
claim is the legal one, which the DPIA already makes: no automated decision with a
legal or similarly significant effect. **Now says** that, plus "Selodía describes
and suggests, and does not gate anything on what it finds."

### ❌ "Not used to train anybody's AI model."

**Evidenced for Anthropic**, whose commercial terms say so. **Not evidenced for
ElevenLabs**, whose retention setting has been an open pre-launch item since 10
September. A policy cannot assert a third party's account settings. **Now says**
only what can be shown, and names Anthropic as the one it can show.

### ❌ "Medication is only ever recorded after you have seen it written down."

**The one you singled out, and it was false as written.** It is true of the
**Medications card** — proved against production, 11/11, the card does not exist
before your yes. But the raw turn is inserted into `chat_messages` **before any
model call**, so a medication mentioned in passing is stored the moment you press
Send.

**Now says** which of the two it means, and says the other half out loud: *"That is
about the card. The conversation itself is saved as you type it, like every other
message, so anything you mention in chat is in your record from the moment you send
it."*

### What also went live

Eleven new categories (menopause status, hormones, medication, sleep, daily mood
and energy ratings, movement constraints including clinical advice, week/goals/
skills, beta membership, feedback, documents, operational records, safety
records); calcium, iron and sodium named in the food breakdown; clinical documents
described for the first time.

`UPDATED` and `PRIVACY_POLICY_VERSION` moved together in one commit, as you asked.
**Everyone is re-asked to confirm consent** — today that is you and the demo
account. Verified live: selodia.app/privacy now reads 1 October 2026 and carries
both corrected paragraphs.

---

## 2. Onboarding step 7 — note fixed

You confirmed one skill is intended. The note under the list said *"nothing is
offered here until it can actually be demonstrated"* — true of that list, and it
reads as a promise about Skills as a whole, while chat is about to be able to add a
skill with no clip at all.

**Now reads:** *"One is enough here — this is just to show how it works. These are
the ones with a demonstration drawn; 6 more are being made, including handstands
and the muscle up. Anything else can be added later by saying so in chat."*

---

## 3. Muscle-up rungs — recorded, with one thing to settle

Your wording is recorded in `docs/skills-brief-2026-10-01.md`, marked approved, with
the note that **the breathing line is guidance, not a Rule** — it excludes nothing
and must not reach `user_rules`.

**One open point.** Your approval mentions breathing cues; the text you pasted has
none. Either they are in a version I have not been sent, or the approval covers a
document held elsewhere. **I have not invented them** — your own item 10 forbids
writing anything you did not say. Paste them and the ladder is complete.

---

## 4. Onboarding wording — what I need

You approved it *"with the findings from her screenshots fixed"*. **I do not have a
list of findings from your screenshots.** I captured 18 setup screenshots today and
reported on them, but no list of faults came back to me. Send the findings, or point
me at the document holding them, and I will work through them.

---

## 5. Reporting rule — adopted and written down

Added to `mobile/WORKFLOW.md` as a standing rule, with the five lines in order
(done / phone check with exact steps / your decision / broken or reverted / the
link), which format to use when, and the part that is easiest to quietly undo:
**the document is not for you to read.** Never "see the attached document for
details" — that is handing the reading back to you, which is the thing the rule
removes.

This report is the first one under it.

---

## 6. Two tools fixed, because they cost time today

- **`check-live-deployment.mjs` crashed instead of skipping** when the Vercel
  token expired — so a wait-for-deploy loop ran for ten minutes against a script
  that was dying, not failing. Expired now reads as "I cannot tell", like absent.
  (The token on this laptop **has** expired: `npx vercel login` when convenient.
  Deploys still work; only the check is blind.)
- **`check-onboarding-copy.mjs`** went red on two setup screens and was right to.
  It holds the chat prefills as exact strings so a new first-person sentence
  cannot inherit the "her words, not the app's" exemption. Each gained a trailing
  colon when the conversation moved onto the setup screen. Updated, not loosened.

---

## Still waiting on somebody who is not me

1. **ICO registration reference.** C2047751 is the application number; a policy
   cites the ZA/ZB number on the certificate. The sentence is drafted.
2. **ElevenLabs retention for this account.** Three documents depend on "audio is
   not retained". This is now the only thing standing between the policy and being
   able to say more about training. It is a setting you can check in a minute.
3. **A solicitor**, at 100 subscribers, for the DPIA, terms, policy and beta
   agreement together.

---

## Next, unless you say otherwise

**Add an item to an existing meal.** It is the gate in front of Skills in your own
ordering, and it is genuinely not built: `writeItems` inserts items only as part of
logging a new meal, and `claimed-write.ts` already names it as a known "cannot".

Letter upload for Rules is now unblocked — the policy is live and declares document
processing — and sits behind that.
