# Pricing and tiers

**STATUS: DRAFT, 7 October 2026.** Decided in conversation, provisional, and
expected to change. Nothing in this document is built. Do not implement anything
here without asking Ruth first.

Kept in the repo rather than only in Drive because these numbers decide things
the code will eventually have to enforce, and a decision that lives only in a
chat log gets re-litigated every time somebody touches the subject.

## Positioning

**Priced against human attention, not against trackers.** Target £20 to £30 a
month. Nothing below £20.

The benchmark behind this is in Drive, at `Competitor analysis / Selodia -
Pricing benchmark across the three categories.docx`, re-run monthly. Its finding
in one line: the three markets Selodía sits in have price floors that differ by
more than ten times. Trackers £2 to £5.25, algorithmic workout coaching £5 to
£6.30, and anything that helps somebody actually get seen £15 to £56.

## Unit economics

Measured from `model_usage`, not estimated.

| | |
| --- | --- |
| Cost per turn | 5.41 US cents, average over 262 real turns |
| Heavy user | about £11.50 a month to serve |
| £20, after the 15% store cut | nets £17.00, margin £5.50 |
| £30, after the store cut | nets £25.50, margin £14.00 |
| £8 | **loses £4.70 per user** |

**That last row is why there is no £8 beta.** The tracker category's ceiling is
below the cost of serving an engaged user, so the tracker framing does not fail
on margin, it fails on arithmetic.

## Launch sequence

1. **Free invited capped beta.** 10 to 15 women, each with a hard turn limit.
2. **Founding members at £20.** 10 to 25 seats, rate locked for life.
3. **Plus at £30**, once the movement library is good enough to demo.

## Tiers, and there are only ever two

| | Core, £20 | Plus, £30 |
| --- | --- | --- |
| Logging | yes | yes |
| Narrated reasoning | yes | yes |
| Cycle-aware nutrition | yes | yes |
| Turn allowance | monthly | higher |
| Movement and physio layer | - | yes |
| Proactive check-ins | - | yes |

## Price rises

A rise follows a **visible release** and applies to **new users only**. Founding
members keep their rate for life.

Worth writing down because it is the operational cost of that promise: a
grandfathered rate means keeping a legacy product ID alive on both stores
indefinitely.

## The narration boundary

Selodía informs and flags. It never diagnoses and never directs treatment.

Current lean is **hybrid: the rules decide what to say, the model phrases it.**
That is already how the food lens works today - `app/lib/health-context.ts`
holds the protective rules as fixed strings and the model only words them - so
this is a description of the existing architecture rather than a new one.

## Still open

- The turn allowance for Core and for Plus. No number has been chosen.
- A typical-user cost model. Everything above is measured from Ruth's own
  account, which is the heaviest use there is, so it is a ceiling and not an
  average. This cannot be settled until beta data exists.

## What exists in the code today

**Nothing.** Checked 7 October 2026:

- No price, plan or tier value anywhere in `app/` or `mobile/src/`.
- No turn cap, quota, allowance or rate limit of any kind.
- No founding-member flag.
- No model routing: `app/api/ask-selodia/route.ts` sets one `MODEL`
  (`claude-sonnet-5`) and every call uses it, so there is no cheap-versus-main
  split to tier against.
- `beta_members` exists in Supabase and grants free access, keyed on `user_id`,
  with a `wave` column. It is the only thing here that is real.
- `model_usage` records the per-turn cost. That is measurement, not enforcement.

So everything in this document is a decision, not a description. The gap between
the two is the whole implementation.
