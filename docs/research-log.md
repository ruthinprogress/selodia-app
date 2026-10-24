# Selodía research log

Every monthly research scan, newest first. One continuous document, like the
build log, so there is one place to look rather than a folder of files to sort
by date.

**This file is the source.** `Selodia-Research-Log.docx` in Build Specs is
rendered from it by `scripts/md2docx.py` after every scan, so the Word document
and the record cannot drift apart. Edit this, never the .docx.

**What the scan is.** First Monday of each month, it reads the rules the app
actually runs - `scripts/mode-matrix.json`, generated from the code, with a
`basis` and a `lastReviewed` date on every rule - searches primary sources for
work published since those dates, and compares. It **proposes and never
applies**: a change goes onto a branch called `research-scan/YYYY-MM` with the
checks green and stops there, for Ruth to approve.

It will never lower a calorie floor or raise a surplus ceiling without saying so
in the first line of its report.

A month with nothing new still gets an entry, so that a missing month means the
scan did not run rather than that nothing happened.

---

# Selodía nutrient reference values — 24 October 2026

Not a monthly scan. A task Ruth asked for while building the food log's nutrient
screens: *"All nutrients should have the correct figure for women in the range
of the age that is actually recorded for the user. If this needs a research
task, then let's do it properly and save the research links into the citings
doc."*

**Four of the ten figures changed. One changed for a reason worth stating on its
own.**

## The finding

The familiar gram figures are the percentages, with the arithmetic already done
for somebody who is not the user.

"70 g of fat, 20 g of saturates, 260 g of carbohydrate" are the UK label
Reference Intakes. The guidance that sets them says in terms that they are
*"based on an average sized woman doing an average amount of physical activity"*
eating 2,000 kcal. They are not separate advice from the percentage
recommendations; they are one step past them.

So a woman eating 1,560 kcal who keeps under 20 g of saturated fat is at **11.5%
of her energy** — over the 10% ceiling — while an app built on the flat figure
tells her she is in range. The same error, smaller, ran through total fat,
carbohydrate and free sugars.

This is the same class of fault as the salt bug found the day before: a
plausible number, the wrong basis, and no visible symptom.

## What the sources say against what the app does

| Nutrient | Was | Now | Basis |
|---|---|---|---|
| Saturated fat | 20 g flat | 10% of her energy | SACN; NHS states 20 g for women, which is that 10% at 2,000 kcal |
| Total fat | 70 g flat | 35% of her energy | UK DRV; label RI of 70 g is that share at 2,000 kcal |
| Carbohydrate | no figure | ~50% of her energy, as a wide band | SACN, *Carbohydrates and Health* (2015) |
| Free sugars | 30 g flat | 5% of her energy | SACN 2015; NHS states 30 g for adults |
| Fibre | 30 g | **unchanged** | SACN 2015 sets an absolute for adults 17+, not a share of energy |
| Salt | 6 g | **unchanged** | NHS, an absolute for adults |
| Calcium | 700 mg | **unchanged** | NHS, adults 19+. The UK does **not** raise this after the menopause, unlike several other countries |
| Iron | 14.8 mg under 50, 8.7 mg over | see below | NHS |

Fibre, salt and calcium were each checked for the same fault and do not have it.
A check now holds all three as absolutes so that nobody "improves" them later by
scaling them.

## Iron: the cliff is softer than a birthday

The NHS gives 14.8 mg for women aged 19 to 49 and 8.7 mg from 50 — and adds that
**women who continue menstruating after 50 may require the higher amount.**

The app had been dropping everybody to 8.7 mg on their fiftieth birthday, which
is the app quietly deciding that somebody's periods have stopped. It now reads
the life stage the user has already recorded, and where that says nothing the
higher figure stands: under-stating iron for a woman still losing it monthly is
the costlier of the two mistakes. "Prefer not to say" is treated as *not told*,
never as *no*.

## Carbohydrate: a band, not a floor

SACN's 50% is a **population average recommendation**. Plenty of women eat
deliberately below it, for reasons that are theirs. Scoring an individual as
"Lower" against it would be the app taking a side in an argument it has no
business in, so the band runs from two thirds of the figure to a third above it,
and only a day well outside it says anything at all.

## Sources

All read on 24 October 2026. Quotes are from the page, not paraphrased.

- Saturated fat — NHS, *Eat less saturated fat*: "the average woman should eat
  no more than 20g of saturated fat a day".
  https://www.nhs.uk/live-well/eat-well/how-to-eat-a-balanced-diet/eat-less-saturated-fat/
- Total fat and the reference-intake basis — British Nutrition Foundation,
  *Food labelling*: reference intakes "are based on an average sized woman doing
  an average amount of physical activity"; Total fat 70 g.
  https://www.nutrition.org.uk/creating-a-healthy-diet/food-labelling/
- Carbohydrate — SACN, *Carbohydrates and Health* (2015): "the dietary reference
  value for carbohydrates be maintained at a population average of approximately
  50% of total dietary energy intake".
  https://assets.publishing.service.gov.uk/media/5a7f7cc3ed915d74e622ac2a/SACN_Carbohydrates_and_Health.pdf
- Free sugars — NHS, *How does sugar in our diet affect our health?*: "Adults
  should have no more than 30g of free sugars a day".
  https://www.nhs.uk/live-well/eat-well/food-types/how-does-sugar-in-our-diet-affect-our-health/
- Fibre — NHS, *How to get more fibre into your diet*: "Government guidelines
  say our dietary fibre intake should increase to 30g a day ... for adults (aged
  17 years and over)".
  https://www.nhs.uk/live-well/eat-well/digestive-health/how-to-get-more-fibre-into-your-diet/
- Salt — NHS, *Salt in your diet*: "Adults should have no more than 6g of salt a
  day (around 1 level teaspoon)."
  https://www.nhs.uk/live-well/eat-well/food-types/salt-in-your-diet/
- Calcium — NHS, *Calcium*: "Adults aged 19 to 64 and over need 700mg of calcium
  a day."
  https://www.nhs.uk/conditions/vitamins-and-minerals/calcium/
- Iron — NHS, *Iron*: "14.8mg a day for women aged 19 to 49 ... 8.7mg a day for
  women aged 50 and over", with the note on women still menstruating after 50.
  https://www.nhs.uk/conditions/vitamins-and-minerals/iron/

## Where this lives in the code

`mobile/src/lib/nutrient-citations.ts` carries every figure with its page, its
quote, the date it was read, and whether the app scales it. `referenceFor` in
`mobile/src/lib/nutrient-standing.ts` applies them, and
`scripts/check-where-the-day-stands.mjs` holds the scaling behaviour — including
that fibre, salt and calcium must not scale, and that a birthday alone must not
lower anybody's iron.

## What I could not establish

Whether the UK has any post-menopausal calcium figure distinct from the 700 mg
adult RNI. The NHS page gives one figure for all adults 19 and over. Several
other countries raise it after the menopause, and the National Osteoporosis
Society's own guidance was not checked. **No figure was invented for it** — the
app shows 700 mg and names the NHS. Worth a proper look before the app ever says
anything about bone density, which is behind the clinical gate in any case.

---

# Selodía research scan — October 2026

Trial run, done by hand on Sunday 4 October 2026 so Ruth can see the format. The
first scheduled run is Monday 2 November.

**No value changed this month.** No calorie floor was lowered and no ceiling was
raised. Two *basis* texts are proposed for revision, because both describe the
evidence less precisely than they could, and one of them could mislead.

The rules were set on 4 October, so this is not a month of accumulated drift. It
is a first look at whether the numbers chosen that day match what the primary
sources actually say.

## What the sources say against what the app does

| Rule | Current value | What the sources say | Verdict | Confidence |
| --- | --- | --- | --- | --- |
| Build surplus | 5% of TDEE (78 kcal) | The commonly cited range for maximising hypertrophy is **10–20% above maintenance**, or 200–500 kcal/day, in resistance-trained populations. Larger surpluses add fat without adding muscle. | **Hold the value, revise the basis** | Moderate |
| Protein | 2.0–2.4 g/kg lean mass (82–98 g) | General older-adult guidance is 1.0–1.3 g/kg **bodyweight**. A 2025 trial in 126 postmenopausal women found 1.2 g/kg bodyweight beat the 0.8 g/kg RDA on both fat loss and muscle. | **Hold, revise the basis** | Moderate |
| Deficit rate | 0.5% bodyweight/week | Unchanged. A deficit around 500 kcal/day was found to prevent lean mass gains, which supports the slow end for anyone training. | Hold | Good |
| Recomposition at maintenance | maintenance | Unchanged, and consistent with the finding above: a deficit competes with the muscle side. | Hold | Good |
| Gain rate and bounds | 0.25%/week, 100–300 kcal | No primary source found this month on bodyweight-scaled gain rates specifically. | Hold, unexamined | Low — see below |
| Calorie floor | max(BMR, 1,200) | Nothing found that would move it, and nothing was sought that could lower it. | Hold | Good |
| Perimenopause / menopause energy needs | not a rule yet | No primary source found this month. | — | — |

## The two proposed changes, both to wording

**1. The build surplus basis should say it is deliberately below the literature.**

The current basis says 5% is "low on purpose, because fat is easier to gain than
muscle at this stage of life". True, but it does not say that the published range
is 10–20%, which is two to four times higher. Somebody reading the basis in six
months should be able to see that the app sits *well under* the usual advice by
choice, not by oversight — otherwise the next person to review it may "correct" it
upwards on finding the literature.

Worth saying plainly: the 10–20% figures come from studies of resistance-trained
people, largely younger and largely male, aiming to maximise hypertrophy. That is
not the population this app is for, and maximising hypertrophy is not the goal.
The low figure is defensible. It should simply be defended in writing.

**2. The protein basis should name which population and which denominator.**

This is the one that could mislead. Protein advice is quoted two different ways:

- **per kg of bodyweight**, in general-health and older-adult guidance — 1.0–1.3 g/kg
- **per kg of lean mass**, in athletic literature — which is what Selodía uses

Ruth's range of 82–98 g is 2.0–2.4 g per kg of *lean mass*. On her bodyweight of
56.55 kg that is **1.45–1.73 g/kg bodyweight** — above the 1.0–1.3 general
guidance, and squarely inside the 1.6–2.2 g/kg range usually given for people
doing resistance training.

So the rule is right, and the basis does not currently say which of the two
denominators it is drawn from. A future scan comparing "2.0–2.4" against "1.0–1.3"
without converting would conclude the app is nearly twice too high and propose
cutting it. The conversion belongs in the basis so that mistake cannot be made.

## What I could not establish

- **No primary source on bodyweight-scaled weight-gain rates.** The 0.25%/week
  figure is a reasonable halving of the fat-loss rate rather than something found
  in a guideline. It is marked low confidence and should stay marked that way
  until something is found.
- **Nothing on perimenopause-specific energy requirements** that rises to the
  standard of a position stand or systematic review. There is a good deal written
  about it, little of it primary.
- **No 2025–26 position stand** specifically on protein for postmenopausal women.
  The 2025 trial below is a single randomised trial, not a position stand, and is
  described as such above.
- Several searches returned secondary sources only. Those are recorded as "no
  primary source found" rather than quietly used.

## Sources

- *International Society of Sports Nutrition position stand: diets and body composition.* ISSN, 2017. https://link.springer.com/article/10.1186/s12970-017-0174-y
- *Effect of Small and Large Energy Surpluses on Strength, Muscle, and Skinfold Thickness in Resistance-Trained Individuals.* Sports Medicine – Open, 2023. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10620361/
- *Energy Deficiency Impairs Resistance Training Gains in Lean Mass but not Strength: A Meta-Analysis and Meta-Regression.* 2021. https://www.researchgate.net/publication/355179847
- *Protein Requirements and Recommendations for Older People: A Review.* Nutrients, 2015. https://pmc.ncbi.nlm.nih.gov/articles/PMC4555150/
- *The Impact of Protein in Post-Menopausal Women on Muscle Mass and Strength: A Narrative Review.* MDPI, 2024. https://www.mdpi.com/2673-9488/4/3/16
- *Optimizing Performance and Health: Nutrition Considerations for Female Athletes in Strength and Conditioning.* 2025. https://pmc.ncbi.nlm.nih.gov/articles/PMC12803723/

## What happens next

Nothing, until Ruth says so. The two wording changes are on the branch
`research-scan/2026-10` with the checks run and green. Neither changes a figure
anybody's app would show.
