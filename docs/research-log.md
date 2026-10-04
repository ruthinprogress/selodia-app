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
