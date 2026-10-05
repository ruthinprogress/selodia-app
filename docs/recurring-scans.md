# Regular scans: what runs, how often, and where the reports go

Ruth, 4 October 2026: *"Is there a Place in the Build specs that documents Regular
scans with frequencies and where to go for the reports created?"*

There was not. This is it, and it is the index — if something runs on a schedule
and produces a report, it belongs in the table below with the folder its reports
land in. An automation nobody can find the output of is one nobody checks, and
this project already has a weekly job that has never once fired without either of
us noticing.

## What runs

| What | When | Where the report goes | Applies changes? |
| --- | --- | --- | --- |
| **Weekly funding check** | Monday **00:40** | Appended to `Competitor analysis\Competitor analysis and funding watch.docx` | No |
| **Overnight queue** | 23:00, **01:00**, 03:00, 05:00 daily | Commits and a close-out line | Yes — it builds |
| **Monthly research scan** | Monday **02:10**, first Monday of the month only. First real run **Mon 2 Nov 2026**. | `Build Specs\Research scans\YYYY-MM-DD Selodia research scan.docx` | **No.** Proposes on a branch, never merges. |
| **November readiness** | Monday **04:20** | Reported in chat | No |

Listed in the order they fire, and staggered into the gaps between the overnight
queue's four slots so two jobs never start together.

## Why they all run at night (5 October 2026)

**They only run while the Claude desktop app is open**, and a task due while it is
shut runs on next launch instead. Everything above was scheduled for Monday
morning, which is the worst possible time: the funding check had never once fired,
and the November readiness check had the same problem.

Ruth's answer, and it is the right one:

> turn it to a night time task and that will be fine as i leave it on overnight -
> it's daytime use that can be choppy as i move around

So all three joined the overnight queue's window. The laptop is on and the app is
open through the night, which makes "only runs while the app is open" a fact about
these jobs rather than a weakness in them — and nothing now competes with her
using the machine.

**What is still true.** If the laptop is genuinely off overnight on a Monday, the
job runs when she next opens the app. That is fine for all four: a funding round
and a research finding are both things where a day late costs nothing. If
something ever genuinely must fire on time, it needs GitHub Actions, which runs in
the cloud whether or not anything is open here. There is no cloud Routine on this
account; what exists is a desktop task tied to the app.

**The clock times shown in the sidebar are a few minutes later than the ones
above.** Recurring tasks get a small fixed delay at dispatch to spread load, so
00:40 is listed as 00:42 and so on. Nothing to correct.

## The monthly research scan, in more detail

It reads the rules the app actually runs — `scripts/mode-matrix.json`, which is
generated from the code and carries a `basis` and a `lastReviewed` date on every
rule — searches primary sources only for work published since those dates, and
writes a report comparing what it found against what the app does.

**It proposes and never applies.** A change goes onto a branch called
`research-scan/YYYY-MM` with the checks run and green, and stops there. Ruth
approves, then it is applied, `lastReviewed` is updated, and it ships. Nothing
about anybody's calorie target changes because a scheduled job read a paper.

It will never lower a calorie floor or raise a surplus ceiling without saying so
in the first line of the report. Those two bounds exist to stop the arithmetic
harming somebody, and a research finding is not on its own a reason to move them.

A month with nothing new still writes a file saying so, so that **a missing report
means the scan did not run** rather than that nothing happened. That distinction
is the whole reason the "no change" note exists.

## Runs so far

| Date | What it found | Report | Branch |
| --- | --- | --- | --- |
| 2026-10-04 | Trial run, by hand. Two basis texts proposed for revision; no value changed. | `Build Specs\Research scans\2026-10-04 Selodia research scan.docx` | `research-scan/2026-10` |

## If you want to change one

The schedules live in `C:\Users\ruthi\.claude\scheduled-tasks\<id>\SKILL.md`, one
folder per task, and the prompt in there is the whole of what the task does. They
are also listed in the Scheduled section of the app's sidebar, where "Run now"
starts one by hand — worth doing once after any change, because tool approvals
granted during a run are remembered for later ones.
