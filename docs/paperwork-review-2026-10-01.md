# Paperwork review — 1 October 2026

What changed in the privacy policy, the DPIA and the Play Data Safety form, and
what is waiting on you. **Nothing is live.** The policy at selodia.app/privacy is
untouched and still dated 19 September; no Data Safety answer has been entered in
the Play Console.

---

## The short version

The three documents had fallen behind the app by **eleven things**, three of them
special category data: where somebody is with the menopause, what hormones they
take, and what medication they take.

And one was not a gap but an error. **Clinical document reading is built and
live** — somebody can photograph a letter in chat today — and the Data Safety form
says "not built yet" while the "not collected" list claims *files and docs* is not
collected. That is an under-declaration, which is the kind Google acts on rather
than rejects.

---

## 1. Privacy policy — DRAFT, needs your yes

`docs/privacy-policy-draft-2026-10-01.md`. Written out in full there; the summary:

**Eleven additions to "What is collected":** where you are with periods · hormonal
contraception and HRT · medication and supplements · sleep · daily mood and energy
ratings · movement constraints including clinical advice · your week, goals and
skills · beta membership and which agreement you accepted · in-app feedback with
the screen and build version · documents you have read in (processed, not stored) ·
operational records of AI usage and timings.

**One bullet reworded:** the food breakdown now names calcium, iron and sodium,
because it covers more than calories and protein.

**The special category paragraph is rewritten.** It named only the menstrual cycle.
It now names menopause status, hormones, medication, disclosed conditions and
clinical advice, and states three things plainly: they are held on explicit
consent for one purpose, they are never used to decide anything about you or
shared with an insurer, employer or advertiser, and **medication is only recorded
after you have seen it written down.**

### What applying it does, so it is not a surprise

It **re-asks everybody to confirm their consent.** The page's own note says the
`UPDATED` field is what does that and should move only when the substance changes
— and three new kinds of special category data is as substantive as it gets.
Today that re-ask reaches you and the demo account.

Applying it is two edits in one commit: the policy text and `UPDATED`, and
`PRIVACY_POLICY_VERSION` in the app. **Say go and I will do both.**

---

## 2. DPIA — updated in place, version 1.1

`docs/dpia.md`. It is an internal accountability record, not published, so it is
updated rather than drafted — but here is everything that moved:

- **Section 2 rewritten.** Was "39 tables"; it is 51, 47 of them per-user. Every
  new special category item is listed individually with why it is collected —
  including that hormone use exists because a withdrawal bleed is not a natural
  cycle, and reading one as the other makes every cycle observation wrong.
- **A processing activity it did not describe at all.** Clinical documents are
  photographed, sent to Anthropic to be read, and never written to the database.
  Under UK GDPR that is processing whether or not it is retained.
- **The processor table** now says what actually reaches Anthropic: the turn, plus
  document pages and food photographs, neither stored.
- **New risk 5.7 — medication recorded wrongly, or at all without agreement.** Two
  risks under one name: holding a list somebody did not knowingly agree to, and a
  misread dose. "75mcg" stored as "75mg" is a thousandfold error in a record the
  app may later reason from. The controls are written down, and they are verified
  against production rather than asserted: the card does not exist after the
  reading-back turn and does exist after the yes.

---

## 3. Play Data Safety — three rows changed, needs re-approving

`mobile/SELODIA_STORE_SUBMISSION.md`. You approved these answers on 24 September.
Three rows are marked ⚠ and the rest are untouched.

| Row | Change |
|---|---|
| Health and fitness → Health info | Adds sleep, daily mood and energy ratings, menopause status, hormonal contraception and HRT, medication and supplements, and movement constraints including clinical advice |
| App activity → Other actions | Adds goals, skills and the shape of the week |
| **Files and docs** | **NEW. Was declared "not collected".** A letter or result the person photographs so Selodía can read it — processed, not stored. Declared because Google counts processing |

The App Store "nutrition label" (section 8) gets the matching change to *User
content: photos*.

**The note that caused this** said "Changes the day clinical-letter upload is
built — not built yet" and sat there while the feature shipped. The form is only
ever as current as the sentence telling you when to change it, so that note now
records the date it was wrong.

---

## Still waiting, and not on me

1. **The ICO registration reference.** C2047751 is the *application* number; the
   reference a privacy policy cites is the ZA/ZB number on the certificate.
   Nothing in the policy claims a registration, so nothing is wrong today. The
   sentence is drafted and goes in the controller paragraph when it arrives.
2. **ElevenLabs retention settings for this account.** Three documents depend on
   the sentence "audio is not retained" — the policy, the Play form and the App
   Store form. It has been marked "to confirm before launch" since 10 September.
   This is the one I would do next, because declaring *Voice or sound recordings*
   as not collected is a statement about somebody else's settings.
3. **A solicitor.** The DPIA, the terms, the policy and the beta agreement go
   together at 100 subscribers. All four still say "not yet reviewed".

---

## What I did not change, and why

- **No new processors.** Nothing added sends data anywhere not already listed.
  Calcium and iron come from CoFID, a UK Government dataset held in Selodía's own
  database.
- **Retention.** Nothing here changes how long anything is kept.
- **The red-flag layer** stays off pending clinical review. `red_flags_raised` is
  declared because the table exists and would hold data the moment it is switched
  on, which is the honest way round.
