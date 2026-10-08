# If something leaks — what to do, in order

**Selodia Ltd**, 19 Campbell Road, London, E17 6RR, company number 17435894.
**Version 1.0 · 28 September 2026.** Review yearly, and after any incident.

**Why this exists.** The DPIA names a breach of the database as the worst case on
the page, and named the absence of this document as one of three things blocking
wave one. The 72-hour clock in the UK GDPR starts when you become **aware**, not
when you have finished investigating, and nobody reads a procedure for the first
time while that clock is running.

**Who does this.** Ruth, for now. There is no one else, and pretending otherwise
in a document that has to work at 11pm would be worse than saying it.

---

## 1. What counts

A personal data breach is any **destruction, loss, alteration, unauthorised
disclosure of, or access to** personal data. It does not have to be malicious and
it does not have to be an attack.

**These count:**

- Someone gets into the Supabase database, the service-role key, or the Vercel,
  GitHub or Anthropic account.
- A bug shows one person's data to another — the wrong record on a screen, a reply
  that quotes somebody else's log, an export containing more than one account.
- Data is destroyed with no backup: a table dropped, a migration that deletes.
- A device holding credentials is lost or stolen.
- A processor tells you they have had a breach. **Their breach is your breach**,
  because Selodía is the controller.

**These do not:**

- Selodía being wrong about somebody's body. That is a quality failure and it
  matters, but it is not a data breach.
- A save that fails and is reported honestly.
- Downtime with no data lost or exposed.

**When it is unclear, treat it as a breach until it is ruled out**, and write down
the time you first heard about it. That timestamp is the single most important
fact in the whole procedure.

---

## 2. The first hour

**Write down the time. Then, in this order:**

1. **Stop it getting worse.** If a key is exposed, rotate it — Supabase service
   role, `SUPABASE_ACCESS_TOKEN`, the Anthropic and ElevenLabs keys, the Vercel
   and GitHub tokens. Rotating a key you did not need to rotate costs an
   afternoon; not rotating one costs everything.
2. **Do not delete anything.** Not logs, not rows, not the offending deploy. The
   evidence of what happened is also the evidence of how much happened, and you
   cannot report a scale you have destroyed.
3. **Write down what you know**, in a file with the date in its name, in the
   Selodía Drive folder under Licences & Legals. Four things: when you found out,
   what appears to have happened, which tables or accounts are involved, and what
   you did about it. Keep adding to it as you learn more. **This file is the
   record the ICO asks for**, whether or not you end up reporting.
4. **Only then start investigating.**

---

## 3. What to work out

- **What data?** Which tables. Health data, conversations and cycle information
  are **special category** and raise the severity of everything.
- **Whose, and how many?** Even approximately. "Fewer than twenty, all beta
  testers" is a usable answer.
- **Still exposed, or closed?**
- **Who could have seen it** — a specific person, anyone with a link, or nobody
  in practice.
- **What can be done for them** — a password reset, a revoked session, an export
  so they can see what was held.

---

## 4. Telling the ICO: 72 hours

**Report unless it is unlikely to result in a risk to people's rights and
freedoms.** For a health app the honest default is **report**, because the data is
special category and the bar for "unlikely to result in a risk" is correspondingly
harder to meet.

- **How:** the ICO's online form, or 0303 123 1113. There is a self-assessment
  tool on ico.org.uk that walks through the decision and is worth using even when
  the answer is obvious, because it produces a record of the reasoning.
- **Deadline: 72 hours from awareness.** Not from confirmation, not from
  understanding it.
- **A late report is still better than none**, and you are asked to explain the
  delay. An incomplete report is explicitly allowed: send what you have and
  follow up. **Do not miss the deadline waiting to know everything.**
- **If you decide not to report, write down why**, in the same file. An
  undocumented decision not to report is indistinguishable from not having
  noticed.

---

## 5. Telling the people affected

**Required "without undue delay" when the breach is likely to result in a HIGH
risk** to them. Exposed health conversations would be.

Say, in plain words and without hedging: what happened, when, what data, what you
have done, what they should do, and how to reach you — **hello@selodia.app**.

**One paragraph is better than a page**, and the tone matters. These are people
who told an app about their body because it asked them to.

Not required if the data was encrypted in a way that makes it unusable, if you
have since made the risk unlikely to materialise, or if contacting everyone
individually is disproportionate — in which case a public notice does instead.

---

## 6. Afterwards

- **Finish the record**, with the timeline and what changed as a result.
- **Fix the cause**, and write it down where it will be read again — the decision
  patterns file, or the spec.
- **Update the DPIA** if the risk picture moved.

---

## Contacts

| | |
| --- | --- |
| **ICO** | ico.org.uk/make-a-complaint/report-a-breach, or 0303 123 1113 |
| **Supabase** | supabase.com/dashboard support, project `jwyzpkxcaxdnjkykoahn` |
| **Anthropic** | Per the DPA's incident terms; sub-processor list at anthropic.com/subprocessors |
| **ElevenLabs** | compliance.elevenlabs.io |
| **Vercel** | vercel.com/support |

---

## What this document does not do

**It is not legal advice**, and it goes to the solicitor with the terms, the
privacy policy and the beta agreement at 100 subscribers. What it does is remove
the worst part of a bad night, which is deciding what to do while the clock runs.

**The judgement calls stay judgement calls.** Whether a given incident is likely
to result in a risk, and whether it is high risk, cannot be written down in
advance. What can be written down — and is, above — is that the timestamp gets
recorded first, nothing gets deleted, and the reasoning gets kept whichever way
the decision goes.
