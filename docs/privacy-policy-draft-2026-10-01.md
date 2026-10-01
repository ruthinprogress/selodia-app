# Privacy policy — proposed update, 1 October 2026

**DRAFT. NOT LIVE.** The policy at selodia.app/privacy is unchanged and still says
19 September. This file is the proposed replacement text, written so Ruth can read
what would change before it goes anywhere near a user. Nothing here is published
until she says so.

**Applying it** means two edits in the same commit, and they must not be split:

1. `app/privacy/page.tsx` — the section text below, and `UPDATED = '1 October 2026'`.
2. `mobile/src/lib/consent.ts` — `PRIVACY_POLICY_VERSION` bumped to match.

**It re-asks everybody to confirm their consent**, which is the point: the page's
own note says `UPDATED` is the field that does that, and that it should move only
when the SUBSTANCE changes. This change adds three new kinds of special category
data — where somebody is with the menopause, what hormones they take, and what
medication they take. That is as substantive as it gets. Today that re-ask reaches
Ruth and the demo account.

---

## Why it needs updating

The policy was written from the actual tables on 19 September and was accurate
that day. Since then the app has started collecting eleven things it does not
mention, three of them special category data. The gap is not a drafting style
problem: a policy that does not name medication while the app stores medication is
simply wrong, and it is the document somebody would be shown if they asked what is
held about them.

---

## Section: "What is collected" — the list

Eleven bullets are added or changed. The existing bullets are unchanged except
where marked.

**CHANGED — Health context.** Was:

> Health context: conditions, markers and allergies you choose to disclose, and
> menstrual cycle dates if you record them.

Becomes:

> Health context: conditions, markers and allergies you choose to disclose, and
> menstrual cycle dates if you record them.
>
> Where you are with periods: whether you describe yourself as having regular
> periods, perimenopausal, post-menopausal, or not having periods for another
> reason — and the reason, if you give one.
>
> Hormones and medication: whether you use hormonal contraception or HRT, and
> anything you tell Selodía you take regularly, including prescribed medicine,
> things bought over the counter, and supplements. This is only ever held after
> Selodía has read back what it understood and you have agreed to it being kept.
>
> Sleep: when you slept, for how long, how it felt, and how often you woke.
>
> How your days feel: the daily ratings you give for things like mood and energy.
>
> Movement constraints: anything you say you must avoid, including advice a
> clinician has given you, so it can be kept out of what the app builds for you.

**NEW — Your week and your plans.**

> Your week and your plans: the activities in your week and when you do them, the
> goals you set, and the skills you are working towards.

**NEW — Beta membership.**

> Beta membership: whether you are in the beta, and which version of the beta
> agreement you accepted and when.

**NEW — Feedback.**

> Feedback: anything you send through the in-app feedback form, together with
> which screen you were on and which version of the app you were using, so it can
> be reproduced.

**NEW — Documents you choose to read in.**

> Documents you show it: if you photograph or upload a letter or a result — for
> example from a clinic — the pages are sent to be read, and what Selodía
> understood from them is shown to you. **The pages themselves are not stored.**
> What is kept is only what you then agree to keep.

**NEW — Operational records.**

> Operational records: a note of how much of the AI service each conversation
> used, and timings for the steps inside it, so faults and costs can be traced.
> These are attached to your account but contain no part of what you said.

**CHANGED — Food and drink.** Was:

> Food and drink: what you log, in your own words, with the nutritional breakdown
> worked out from it, and any photographs you send.

Becomes (the only change is naming the nutrients, because the breakdown now covers
more than calories and protein):

> Food and drink: what you log, in your own words, with the nutritional breakdown
> worked out from it — calories, protein, carbohydrate, fat, and the nutrients
> that matter most at this stage of life, including calcium, iron and sodium — and
> any photographs you send.

**NEW — Safety records.**

> Safety records: if Selodía has raised something with you that it thinks is worth
> taking to a doctor, a note that it has already been raised, so you are not asked
> the same thing repeatedly.

---

## Section: "What is collected" — the special category paragraph

Was:

> Special category data. Health, and information about your menstrual cycle, are
> special category data under UK GDPR. They are held because you asked an app
> about your body to help you understand it, which is explicit consent for that
> specific purpose, and for no other.

Becomes:

> **Special category data.** Health information is special category data under UK
> GDPR, and several of the things above are squarely within it: your menstrual
> cycle, where you are with the menopause, the hormones and medication you take,
> any condition you disclose, and anything a clinician has told you to avoid.
>
> They are held on your **explicit consent**, given on the first screen, for one
> purpose: so that an app you asked about your own body can answer from your own
> record. They are used for nothing else. They are not used to decide anything
> about you, not shared with any insurer, employer or advertiser, and not used to
> train anybody's AI model.
>
> **Medication is only ever recorded after you have seen it written down.**
> Selodía reads back what it understood, and nothing is kept unless you agree to
> it. Selodía is not a prescriber and will not tell you whether a dose is right or
> suggest you change anything — that belongs with your GP or pharmacist.

---

## Section: "Who is responsible" — one sentence, when the certificate arrives

The controller paragraph gains the ICO registration reference once it exists.
**Not now, and not the application number** — C2047751 is the application, and the
reference a policy cites is the ZA/ZB number on the certificate. Nothing in the
current text claims a registration, so nothing is wrong today. When it arrives:

> Selodía Ltd is registered with the Information Commissioner's Office, registration
> reference [ZA……].

---

## What is deliberately NOT changing

- **No new processors.** Nothing above sends data anywhere the policy does not
  already list. Calcium and iron come from a UK Government dataset held in
  Selodía's own database, not from a service.
- **The retention section.** Nothing added here changes how long anything is kept.
- **"Not collected" claims.** All still true: no location, no contacts, no
  advertising identifier, no third-party analytics, and no photographs of bodies.
