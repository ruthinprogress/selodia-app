# Exercise Animatic — Open Questions for Consolidated Email

*A running list of every genuine open question for the Exercise Animatic vendor, collected across sessions so nothing is lost before we send **one warm, consolidated email**. The email itself gets drafted later, in the build chat, once testing and refining are far enough along.*

**Do not send anything from this list.** Its only job is to stay current and complete. Add to it whenever a new vendor question surfaces; mark items answered rather than deleting them, so we never re-ask something they've already covered.

*Lives in the repo so it is versioned and cannot quietly disappear (a prior animatics decision record existed only in Drive plus a branch that never reached origin — it was nearly lost). Synced to Drive `Build Specs/Excersise Animatics/` alongside the other animatics documents.*

---

## Open

| # | Question | Why it matters | Raised |
|---|---|---|---|
| 1 | **Are all exercises available as vertical masters**, across the full library — not just the samples checked so far? | The movement-demo slot is 4:5 portrait, and vertical masters carry higher resolution on the figure than the horizontal versions. Blocks the batch recolour. | 2026-08-19 |
| 2 | **Is the source background consistent library-wide?** Newer samples arrive on white; one older clip came on green screen. | The recolour is a colour-range LUT — it maps the background by its colour, so an inconsistent source background breaks the identical-treatment guarantee. Blocks the batch recolour. | 2026-08-19 |
| 3 | **Is the landmine / kettlebell single-leg RDL close enough to a true hip hinge** to build safety copy around, given the different equipment setup from a plain barbell RDL? | Safety copy is exercise-specific by rule, never generic boilerplate. The existing copy was written for barbell RDL form and cannot simply be repointed at a different implement and stance. Gates that movement's safety note. | 2026-08-19 |
| 4 | **Are clean / unbranded masters available**, if still relevant by the time we send? | The delivered clips carry a burned-in Unflump watermark, encoded by the vendor from the logo kit we supplied. Adding it ourselves in the existing offline ffmpeg pass would keep placement, opacity and size tunable, and removes one variable from automated crop detection. Lower priority — the recolour LUT largely absorbs the current watermark — hence "if still relevant". | 2026-08-21 |
| 5 | **Can you provide your official muscle-group / movement-pattern tagging data per exercise?** | Their coverage workbook states plainly that its categorisation was built by *keyword matching against exercise filenames* — "not their official muscle-tagging data, which wasn't provided", and "directional shape of coverage, not an authoritative count". Real per-movement metadata is a hard prerequisite for the conversational-substitution mechanism (Part Ten / build item 46): without it we would be classifying movements from a closed keyword list, which Part Two principle 13 rules out as a permanent classifier. Getting it from source beats re-deriving it. | 2026-08-21 |

## Answered

| # | Question | Answer | Date |
|---|---|---|---|
| A1 | Can you deliver per-element layers, or a flat colour / ID pass, so individual elements can be recoloured separately? | **No.** Confirmed a permanent ceiling: clothing and hair share one black source colour and cannot be separated; body and light shoes are one light group. Controllable groups are only {muscle, dark, light, background}. | 2026-08-19 |
| A2 | Do the vertical masters exist with `_Female` variants, or are they male-only? (and the green-screen set) | **Resolved 2026-08-21 without needing to ask — Ruth checked the Verticals folder directly and confirmed a normal male/female mix, consistent with the rest of the library.** The earlier signal (zero `_Female` in header scans of the truncated archives — 0 of 58 and 0 of 26) was a **sample artefact of where the incomplete downloads happened to stop**, not a structural gap. It was raised as a signal rather than a finding, and checking the source beat asking the vendor. Clears the dependency for both the **4:5 portrait slot** (which sources from vertical masters) and the **female-only content rule**. | 2026-08-21 |
