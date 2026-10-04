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
| **Monthly research scan** | First Monday of the month, 09:11. First real run **Mon 2 Nov 2026**. | `Build Specs\Research scans\YYYY-MM-DD Selodia research scan.docx` | **No.** Proposes on a branch, never merges. |
| **Weekly funding check** | Mondays, 09:02 | Appended to `Competitor analysis\Competitor analysis and funding watch.docx` | No |
| **November readiness** | Mondays, 09:18 | Reported in chat | No |
| **Overnight queue** | 23:00, 01:00, 03:00, 05:00 daily | Commits and a close-out line | Yes — it builds |

## The thing to know about all of them

**They only run while the Claude desktop app is open.** If the app is shut when a
task is due, it runs on next launch instead. That is why the two Monday jobs above
have no `lastRunAt` at all, and why the overnight queue last ran on 2 October
despite being due four times a day.

This is fine for the monthly scan — a month has plenty of slack, and a first
Monday missed because the laptop was closed simply runs on the Tuesday. It is a
real weakness for anything that has to happen on a particular day. If one of these
ever genuinely must fire on time, it needs GitHub Actions instead, which runs in
the cloud whether or not anything is open here. There is no cloud Routine on this
account; what exists is a desktop task tied to the app.

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
