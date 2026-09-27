# What the chat prompt learned, and why it is not in the prompt any more

Moved here on 27 September 2026, when the prompt was rebuilt from a baseline
upwards. Ruth: *"Move incident notes and statistics out of the prompt into
docs."*

**Why this file exists.** Every note below was a real finding, and every one of
them earned its place in the prompt at the time. What nobody noticed is that
they never left. `GENERAL_CONDUCT` reached **11,666 tokens**, and reading it, the
shape is unmistakable: a rulebook assembled one incident at a time. A statistic
about a bug from one particular week was sitting in the instructions for every
reply the app would ever write.

These are worth keeping. They were never worth sending to a model on every turn.

---

## The "Got it" measurement, 25 September 2026

Replies opening with the words "Got it" went **3% in August to 39% in the week
of 21 September**. Reply length never changed, about 45 words throughout, so
nothing got terser — the OPENING collapsed onto one phrase.

**The phrase appears in no prompt anywhere.** It is a feedback loop: the last
forty turns go into the model's context, a fifth of them opened that way, and it
copied itself. Every reply written that way made the next one likelier, which is
why it accelerated rather than levelling off.

Banning the phrase would have moved it — "got that" was already at 1.9% on the
same measurement.

**Why it is not a rule any more:** the app prints its own save confirmation, so
an acknowledging opener was never doing any work. The rebuilt prompt says
replies are short and answer what she said; there is nothing left for a
throat-clear to attach to. `scripts/probe-reply-variety.mjs` measures it, which
is the right place for a statistic.

## The water that was lost, 27 August 2026

A reply said the almonds and the coffee were logged as food and the litre of
water was in too. The water was not in. It had been lost that day.

**The rule this produced** was several hundred words telling the model never to
list back what went in, because it does not know what landed.

**Why it is not a rule any more:** the app now tells the model what actually
happened to the data *before* it writes, so there is nothing to guess about.
That is the fix; the paragraph was a workaround for not having it.

## "Waist 70cm / Thighs 52.5cm", 27 August 2026

Came back "Got those down". Nothing was stored — waist and thigh had no field in
the measurement parser at the time. She re-entered the same numbers two hours
later, because the only signal that nothing had been kept was the ABSENCE of a
save toast.

**This is the origin of `save-honesty.ts`**, which is deterministic code and
stays exactly where it is. The model writes the reply; the app states what
happened to the data.

## The invented hard session, 27 September 2026

After a weigh-in, the chat explained a rise with *"you had a hard session a day
or two ago"*. Her movement log for that week held two minutes of pushups.

Her words: *"the app is only useful if people can trust that what it says about
their body comes from their own record."*

**Why it is not a long rule any more:** it is one sentence in the baseline, and
the real fix was never prompt text — it was giving the model computed facts that
say plainly when a log is empty. A list somebody has to *notice* is empty is what
produced this.

## The 1.4 that should have been 1.3, 27 September 2026

The same reply said *"up 1.4 kg since your reading 2 days ago"* where the screen
said +1.3 and the reading was three days earlier.

**The mechanism, confirmed in code:** the measurement block interpolated
`m.weight_kg` unrounded. The model saw `55.58` where her screen showed `55.6`,
did its own arithmetic against 56.9, got 1.32, and rendered 1.4.

**Why it is not a rule any more:** the app does the arithmetic and rounds the way
the screen rounds. The model is told to use the figures exactly and not to
calculate its own — one line, because the numbers are now correct before they
reach it.

## The voice fillers, 24–27 September 2026

"Hold on", "just a sec", "let me see" were reported as the model padding for
time. A rule was added to the voice block telling it never to say them.

**That rule could never have worked.** The words are literal strings in the
ElevenLabs agent configuration — `soft_timeout_config.additional_soft_timeout_messages`
— fired by the platform after a silent wait. Enabled on 24 September, and
written up as a win.

**Why it is not a rule any more:** it never belonged in a prompt. The setting was
changed instead: the timeout went from 3 seconds to 8.

---

## The pattern in all of them

Five of these six were fixed by a prompt rule when the actual cause was
somewhere else: a missing field, a missing fact, an unrounded number, a platform
setting. The rule did not fix it; the rule made the prompt longer, and the model
had one more thing to weigh against everything else.

**So the rule for adding a rule:** a prompt rule is the right fix only when the
model has everything it needs and is still choosing wrongly. If it is choosing
wrongly because it was not told something, tell it — as a fact, not as an
instruction.
