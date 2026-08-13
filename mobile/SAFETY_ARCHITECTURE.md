# Unflump Safety State Machine: Engineering Design

*Written 2026-08-13. This is the **engineering** companion to `UNFLUMP_LANGUAGE_RULES.md` — that document is the clinical *what and why* (the five tiers, MI grounding, the C-SSRS-derived wording); this one is the *how*: the deterministic state machine that decides, turn by turn, whether the safety boundary fires, whether a resource card attaches, and whether we are still screening. Both are implemented once in the shared module `app/lib/safety-classification.ts` and used identically by `app/api/onboarding-chat/route.ts` and `app/api/ask-unflump/route.ts`. Any future emotionally-open touchpoint must use the same module rather than reimplementing this.*

---

## 1. The split: what the model decides vs. what the code decides

Each turn, the model is forced (via a tool call) to return a `classification` plus a `reply` and a few structured flags. Everything downstream of that — escalation stepping, whether a card attaches, which organization, what gets persisted — is **deterministic code** in `applySafetyStateMachine`, not the model's choice. The design rule (stated in the module header) is: *deterministic branching, not the model's decision*, so escalation/card behavior can never quietly drift between the two routes.

There is exactly **one** deliberate, bounded exception where a model judgment reaches into the gate: the `acuteExplicitIntent` flag (§4). It is called out explicitly because it is the one place we trade pure determinism for clinical appropriateness, and its failure modes are analyzed below.

### Inputs the state machine reads

- `result.classification` — the tier (or a route-specific non-distress category like `neutral` / `clear_goal`).
- `result.acuteExplicitIntent` — model-declared, meaningful only for `acute_crisis` (§4).
- `state.previousEscalationStep` — `null | 'gentle_asked' | 'direct_asked'`, read from the last assistant turn.
- `state.previousClassification` — the **persisted** classification of the last assistant turn (not always the model's raw output — see §6).

### Outputs it produces

- `replyText` — the model's reply, **or** the verbatim `DIRECT_ESCALATION_QUESTION` when we override it (§3).
- `nextEscalationStep`, `resourceCard`, `nextRevisitCount`, and `nextClassification` (the value to persist, §6).

---

## 2. The five tiers and their card mapping

| Classification | Card tier? | Organization | Notes |
|---|---|---|---|
| `ordinary_discouragement` | no | — | warm reframe |
| `ambiguous_distress` | no | — | drives the clarifying ladder; never cards |
| `eating_related_distress` | yes | Beat | care-first |
| `grief_related_distress` | yes | Cruse Bereavement Support | care-first |
| `acute_crisis` | yes | Shout | gated behind the direct question unless explicit (§3, §4) |

`CARD_TIERS = [eating_related_distress, grief_related_distress, acute_crisis]`. `ambiguous_distress` is deliberately **not** a card tier — it is the "still screening" state, which is what lets a genuine resolution *out of* the ladder (`ambiguous → eating/grief`) count as a fresh entry and keep its card (§5).

---

## 3. The generalized acute-gate and the consecutive-acute guard

The deterministic direct question (C-SSRS Q1, used verbatim) is the **single gate before any `acute_crisis` card**. Its job is to resolve genuine ambiguity before a resource appears, and to guarantee that a *probing question* and a *resource card* can never occupy the same turn (the original "premature card" defect).

```ts
const acuteExplicit =
  result.classification === 'acute_crisis' && result.acuteExplicitIntent === true;

const forceDirectQuestion =
  previousEscalationStep !== 'direct_asked' &&
  previousClassification !== 'acute_crisis' &&
  ((result.classification === 'acute_crisis' && !acuteExplicit) ||
    (result.classification === 'ambiguous_distress' && previousEscalationStep === 'gentle_asked'));
```

When `forceDirectQuestion` is true, the machine sets `nextEscalationStep = 'direct_asked'`, overrides `replyText = DIRECT_ESCALATION_QUESTION`, attaches **no card**, and persists the turn as `ambiguous_distress` (§6). Resolution and any card happen on the *following* turn, once the person answers.

Two conditions in that predicate matter and are easy to remove by accident:

- **`previousEscalationStep !== 'direct_asked'`** — once the direct question has been asked, the next turn *is* the genuine resolution and is allowed to card. Without this, acute could never resolve.
- **`previousClassification !== 'acute_crisis'`** (the *consecutive-acute guard*) — once an acute conversation is resolved and ongoing, subsequent acute turns must **not** bounce back into the screening question. Without this guard, after an acute resolution (`nextEscalationStep` returns to `null`) the very next acute turn would re-fire `DIRECT_ESCALATION_QUESTION` — an infinite screen/re-screen loop. With it, ongoing acute stays in care-first mode.

Non-explicit acute (passive language like *"I feel like giving up"*, *"I don't want to go on"*) is gated. Explicit acute (§4) is not. Eating- and grief-related distress are **never** gated — a clear disclosure of either is a genuine resolution and keeps its own Beat/Cruse card; routing them through a suicidal-ideation screen would be clinically wrong.

---

## 4. `acuteExplicitIntent` and its two-sided failure-mode analysis

The screen exists to resolve ambiguity. When the current message is *already* an explicit, unambiguous statement of intent (a plan, a stated intention, a plain "I want to die"), a milder screening question **under-responds** to what was plainly said. So the model sets `acuteExplicitIntent: true`, and the gate lets that turn resolve straight to `acute_crisis` with its card — the model's own care-first reply, not the screen.

This is the one **model-declared boolean inside a safety gate** — a deliberate, bounded exception to the "deterministic, not the model's decision" rule. It is defensible only because both failure directions degrade *safely*:

- **False positive — model marks passive as explicit → immediate card when a screen would have done.**
  Result: over-support. The reply is care-first (not a question), so there is **no** probing-question-plus-card contradiction — the original defect does not return. A crisis resource shown to someone who was not quite in crisis is a small, easily-ignored card (see the language-rules doc on graceful misclassification), not a harmful outcome.

- **False negative — model marks explicit as passive → routes a genuine explicit crisis through the screening question.**
  Result: the one-turn delay we already accept for the ambiguous case. Still safe: the person gets the warm C-SSRS question, and the card lands on the next turn once they answer. The direct question is itself a caring, validated response, not a dead end.

Neither direction reintroduces the contradiction the architecture exists to prevent, and the conservative prompt wording (explicit = a stated plan/intention/direct statement; passive/hedged = leave it false) keeps false positives rare. The debounce (§5) and gate (§3) still handle every non-explicit path deterministically, so the flag is a refinement layered on top of deterministic safety, never the sole line of defense.

---

## 5. The debounce, and why it is tier-specific

A resource card must fire **once per genuine entry into distress-support**, not on every turn while a conversation stays in the same emotional territory, and not when the tier label merely *switches* mid-thread. The original rule — `classification !== previousClassification` — was too naive: it treated any tier change as new, so a mid-conversation switch (e.g. `acute_crisis → grief_related_distress` while the person was actively declining) spawned a spurious card. That was the real cause of the "phantom" Cruse cards observed in live testing.

The fix is **two different debounce rules**, because eating/grief and acute have genuinely different safety requirements:

```ts
const previousWasInDistressSupport =
  previousClassification !== null && CARD_TIERS.includes(previousClassification);

const enteringDistressSupport = !previousWasInDistressSupport;      // eating & grief
const acuteNewlyTriggered = previousClassification !== 'acute_crisis'; // acute only
```

- **Eating/grief use `enteringDistressSupport`** — a card fires only when the previous turn was *not already* in any card-bearing distress state. A mere tier-switch within an ongoing distress thread does **not** re-card. Because `ambiguous_distress` is not a card tier, a genuine resolution out of the clarifying ladder still counts as a fresh entry and keeps its card.

- **Acute uses `acuteNewlyTriggered` (a safety-override)** — an explicit crisis must surface its card **even if an earlier eating/grief card already showed**. So acute is suppressed *only* when the previous turn was itself already `acute_crisis` (an ongoing acute conversation), never merely because some other card tier preceded it.

**Why acute cannot share the eating/grief rule:** if acute used `enteringDistressSupport`, then an explicit suicidal statement landing right after a grief or eating card (`previousWasInDistressSupport === true`) would be **suppressed** — the single most dangerous under-response the system could produce. The safety-override is the whole reason the two rules are separate. (This was caught during implementation, not in the original design walkthrough — see scenarios E2 and EA3.)

---

## 6. The persistence subtlety (`nextClassification`)

When `forceDirectQuestion` fires on a turn where the *model* said `acute_crisis`, the machine persists that turn as **`ambiguous_distress`**, not `acute_crisis`. This is essential and non-obvious:

- The direct-question turn is genuinely "still clarifying," so `ambiguous_distress` is the honest label.
- If we instead persisted `acute_crisis`, then the *next* turn (the genuine resolution) would see `previousClassification === 'acute_crisis'`, `acuteNewlyTriggered` would be false, and **the card would be suppressed** — the person would answer the crisis question and get no resource. Persisting `ambiguous_distress` keeps the resolution turn correctly "newly triggered."

`SafetyOutcome.nextClassification` carries this back to the routes, which persist *it* rather than `result.classification`.

---

## 7. Regression reference: the 23-scenario trace

These are the canonical behaviors, traced through the real `applySafetyStateMachine` (all passing as of commit `0230f12`, 2026-08-13). This table is the regression contract — if a change to the state machine alters any row, that change is either a bug or a deliberate, documented decision.

Columns: **prev step** / **prev class** = incoming `state`; **current** / **explicit** = the model's `result`; then the deterministic outputs — **card**, **next step**, **persisted class**, **direct-Q?** (whether `replyText` is the verbatim `DIRECT_ESCALATION_QUESTION`).

### Debounce
| # | prev step | prev class | current | explicit | → card | next step | persisted | direct-Q? |
|---|---|---|---|---|---|---|---|---|
| D1 | null | acute_crisis | grief | — | **none** | null | grief | no |
| D2 | null | acute_crisis | grief | — | **none** | null | grief | no |
| D3 | null | null | eating | — | Beat | null | eating | no |
| D4 | gentle_asked | ambiguous | grief | — | Cruse | null | grief | no |
| D5 | null | grief | grief | — | **none** | null | grief | no |
| D6 | null | grief | eating | — | **none** | null | eating | no |
| D7 | null | null | grief | — | Cruse | null | grief | no |

### Explicit / passive split
| # | prev step | prev class | current | explicit | → card | next step | persisted | direct-Q? |
|---|---|---|---|---|---|---|---|---|
| P1 | null | grief | acute | false | none | direct_asked | ambiguous | **yes** |
| P2 | null | null | acute | false | none | direct_asked | ambiguous | **yes** |
| P3 | null | null | acute | *(unset)* | none | direct_asked | ambiguous | **yes** |
| E1 | null | null | acute | true | **Shout** | null | acute | no |
| E2 | null | grief | acute | true | **Shout** | null | acute | no |
| E3 | gentle_asked | ambiguous | acute | true | **Shout** | null | acute | no |

### Consecutive-acute — no loop
| # | prev step | prev class | current | explicit | → card | next step | persisted | direct-Q? |
|---|---|---|---|---|---|---|---|---|
| C1 | direct_asked | ambiguous | acute | false | **Shout** | null | acute | no |
| C2 | null | acute_crisis | acute | false | none | null | acute | no |
| C3 | null | acute_crisis | acute | true | none | null | acute | no |

### Eating → acute still cards
| # | prev step | prev class | current | explicit | → card | next step | persisted | direct-Q? |
|---|---|---|---|---|---|---|---|---|
| EA1 | null | eating | acute | false | none | direct_asked | ambiguous | **yes** |
| EA2 | direct_asked | ambiguous | acute | false | **Shout** | null | acute | no |
| EA3 | null | eating | acute | true | **Shout** | null | acute | no |

### Normal ladder regression
| # | prev step | prev class | current | explicit | → card | next step | persisted | direct-Q? |
|---|---|---|---|---|---|---|---|---|
| L1 | null | null | ambiguous | — | none | gentle_asked | ambiguous | no |
| L2 | gentle_asked | ambiguous | ambiguous | — | none | direct_asked | ambiguous | **yes** |
| L3 | direct_asked | ambiguous | ordinary_discouragement | — | none | null | ordinary | no |
| L4 | direct_asked | ambiguous | neutral | — | none | null | neutral | no |

### Re-running the regression

The trace harness imports the real module and asserts every row. Node ≥ 23 strips TypeScript types, so the actual source runs directly — no separate build:

```bash
node sm_retest.mjs   # imports app/lib/safety-classification.ts, exits non-zero on any mismatch
```

Keep the harness in sync with this table. When adding a tier, an escalation step, or a new gate condition, add its scenarios here **and** in the harness before shipping — this table is only a safety guarantee if it stays exhaustive.

---

## 8. Known boundaries (stated honestly)

- **Classification is still the model's judgment.** The anchoring prompt ("classify the *current* message, not the conversation's mood") reduces, but cannot eliminate, the model over-weighting a distress-heavy history window. The debounce is the deterministic backstop that keeps a *misclassification* from producing a spurious *card*; the two are defense-in-depth, not one fix.
- **This is not a clinically validated deployment.** As the language-rules doc states, grounding specific wording in the C-SSRS grounds the *wording*, not the whole system in this context. This architecture makes the mechanism reliable and predictable; it does not make Unflump a crisis service.
