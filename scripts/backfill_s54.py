"""Backfill Session 54 into the close-out workbook.

WHY IT WAS MISSING. The close-out ceremony's steps are automated; its TRIGGER
is not. WORKFLOW.md step 6 is "the gate on the whole ceremony" and needs four
facts that "none of is inferable", and line 108 says a session that is pausing
rather than ending does not warrant a full ceremony.

S54 never had an ending. Ruth said "I will be going to sleep now" and asked for
the work to continue overnight; it ran through the night and straight into S55
the next morning. By the letter the protocol behaved correctly, which is the
gap: there is no rule for "the human goes to bed and the agent keeps working",
and that is now a normal shape for these sessions. Twenty-four commits went
unrecorded.

Appends to both continuous sheets, in the existing shape - a session header row
in column A, then one row per item - and reuses the fills already in the file
rather than inventing new ones.
"""

import io
import sys

import openpyxl
from copy import copy

BOOK = r"H:\My Drive\Selodia App Project Master Folder\Build Specs\Selodia-Session-Closeouts.xlsx"

# (item, status, date, notes)
CHECKLIST = [
    ("Turn abandonment: work stops when nobody is waiting", "Done", "2026-09-25",
     "A turn whose caller has gone is no longer computed. Cuts wasted model spend on voice turns the user talked over."),
    ("Prompt caching on the static half of the turn prompt", "Done", "2026-09-25",
     "The conduct block never changes between turns, so it sits before the cache breakpoint. Pairs with the tool-schema caching from S53."),
    ("Seeded chat broke the app's own rule about praise", "Done", "2026-09-25",
     "The demo seed data contained congratulatory replies the voice rules forbid. Rewritten."),
    ("Screens one level in had no name of their own", "Done", "2026-09-25",
     "Food, Activity and Measurements were unlabelled once opened; four screens also carried two titles at once."),
    ('"Log" was drawing as "Loq"', "Done", "2026-09-25",
     "Android measured the label in the system face and drew it in Comfortaa, so the tail of the g was clipped."),
    ("Food/Activity/Measurements switch said something untrue", "Done", "2026-09-25",
     "The strip named views that had moved to other tabs."),
    ("Plans could never be deleted, by anything", "Done", "2026-09-25",
     "No control, no chat route, and nothing said so. Every card on a main list can now be deleted where it sits, and Plans reorders."),
    ("Swipe-to-delete rebuilt", "Done", "2026-09-25",
     "The wrapper was trying to own the card's shape. A mark rather than the word Delete on the reveal."),
    ("Today redesigned: figures, not a dashboard of widgets", "Done", "2026-09-25",
     "Her 15-item UI pass. Cards became figure rows, the flower moved to the Almanac, the daily line became a closing epigraph."),
    ("The greeting was too wide for its own column", "Done", "2026-09-25",
     'The real bug behind "the flower is cut off". 50pt in a 312pt column put "Good afternoon," on three lines - only ever visible after midday.'),
    ("The wheel's sentence twice said something untrue", "Done", "2026-09-25",
     'Called an uneven week "fairly evenly spread" twice. First fix compared only the leader to the runner-up; second sent three joint leaders back to the same sentence. Probe now carries both bugs.'),
    ("The More mark sat at four offsets and three heights", "Done", "2026-09-25",
     "One component now, measured at top 8 and 32 from the right on all twelve screens. Two probes so it and the back arrow cannot drift again."),
    ("Today shows today only; water became a bare droplet", "Done", "2026-09-25",
     "Her request: no box around the droplet, total below, no guidance on how much."),
    ("Movement, not Activity - and the prompt described screens that had moved", "Done", "2026-09-25",
     "The system prompt was describing an app layout that no longer existed."),
    ("Measurements rebuilt from her written spec", "Done", "2026-09-25",
     "Latest / History / Then & now, rows not tables, no card fill. Me cards can be edited and discussed."),
    ('Robotic voice measured: "Got it" openers at 39%', "Diagnosed", "2026-09-25",
     'Measured free from stored replies: 3% on 10 Aug, 39% by 21 Sept. The phrase is in no prompt - the model copies its own last forty turns. Instruction now names the loop.'),
    ('Thighs in cm were reading "-0.9%"', "Done", "2026-09-25",
     "changeLabel asked the metric for its unit and derived metrics carry none. The probe had a case that passed because it handed the metric 'cm' explicitly - it tested the shape the code wanted, not the shape the app produces."),
    ("Clean-up: 1,250 dead lines removed", "Done", "2026-09-26",
     "14 files deleted. The scan also caught 'What you burn' having vanished from the app entirely - moved off Today in the morning, then left out when Measurements was rebuilt at night."),
    ("Two things I had told her did not exist", "Done", "2026-09-26",
     "I said the app had no measurement icon family (measurement-icon.tsx existed, orphaned) and twice that nothing in Selodia is botanical (three drawings exist, two used). Watercolour genuinely does not exist."),
    ("Error toast on every screen with a drawing on it", "Done", "2026-09-26",
     "accessible={false} on three SVGs leaks to the DOM through react-native-svg on web. Fixing it, I put the explanation in a JSX comment beside the root element and broke all three files."),
    ('Settings said "Waist - no unit" beside "79 cm"', "Done", "2026-09-26",
     "Derived entries now carry their rows' unit."),
    ("Expo web bundler degradation", "Unresolved", "2026-09-25",
     "Went from ~15s to 150-900s bundles roughly six times across the session, recovering only on restart. Root cause still unexplained. I nearly reported 25 headless Chrome processes as the cause - they were her own browser's renderers, zero headless."),
    ("Session 54 close-out", "Outstanding", "2026-09-25",
     "Never ran. The session did not end - it went overnight and into S55. Backfilled 26 September. See the Decisions sheet for the protocol gap."),
    ("/terms on selodia.app", "Outstanding", "2026-09-26",
     "Returns 404. No terms page exists anywhere in the repo and no commit has ever touched one, so nothing 'fixed' it in S54. A live domain with no terms page is a Play Store and GDPR exposure."),
]

# (decision, date, rationale)
DECISIONS = [
    ("The close-out ceremony has no trigger, only steps", "2026-09-26",
     'Its steps are automated; the trigger is a person saying the session is ending. WORKFLOW.md step 6 is "the gate on the whole ceremony" and needs four facts none of which is inferable, and line 108 exempts a session that is pausing. S54 never ended - she went to sleep and the agent kept working - so by the letter nothing was owed, and twenty-four commits went unrecorded. The protocol needs a rule for an overnight run: when the human leaves and work continues, the close-out is owed at the handover, not at some later ending that never comes.'),
    ("The greeting, not the flower, was the Today bug", "2026-09-25",
     'She reported the flower being cut off. The cause was a 50pt greeting in a 312pt column pushing everything down - three lines from midday, and only ever checked in the morning. The seeds being inline was the same bug\'s earlier workaround. Fixing the reported symptom would have moved the flower and left the cause.'),
    ("Banning a repeated phrase would only move it", "2026-09-25",
     '"Got it" reached 39% of replies without appearing in any prompt: the last forty turns are in context and the model copies itself, so the more it happens the more it happens. Banning the phrase moves it - "got that" was already at 1.9%. The instruction names the LOOP instead, and points out the app prints its own save confirmation so an acknowledging opener does no work at all.'),
    ("A probe can pass by testing the shape the code wants", "2026-09-25",
     "The thighs percentage bug had a probe case covering it that passed, because the case handed the metric a unit explicitly while the app produces metrics with no unit. A probe that constructs its own input can confirm the bug rather than catch it. Probe inputs should come from the same path the app uses."),
    ("Dead-code scans find missing features, not just dead ones", "2026-09-26",
     "'What you burn' had vanished from the app entirely and nobody noticed for a day. It surfaced because use-burn-figures.ts showed as unreferenced - the scan was looking for code to delete and found a feature to restore."),
]


def main() -> int:
    wb = openpyxl.load_workbook(BOOK)

    check = wb["Checklist"]
    dec = wb["Decisions"]

    # Reuse the fills already in the file rather than inventing colours.
    done_fill = copy(check.cell(check.max_row, 2).fill)
    header_font = copy(check.cell(456, 1).font)

    def append(ws, header, rows, status_col):
        r = ws.max_row + 1
        ws.cell(r, 1, header).font = copy(header_font)
        r += 1
        for row in rows:
            for c, value in enumerate(row, start=1):
                cell = ws.cell(r, c, value)
                if status_col and c == status_col and isinstance(value, str) and value in ("Done", "Diagnosed"):
                    cell.fill = copy(done_fill)
            r += 1
        return r

    append(check, "S54: 25Sep26  (backfilled 26 Sep - no close-out was run)", CHECKLIST, 2)
    append(dec, "S54: 25Sep26  (backfilled 26 Sep)", DECISIONS, None)

    wb.save(BOOK)
    print(f"Checklist now {check.max_row} rows, Decisions now {dec.max_row} rows.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
