"""Session 58's morning - the merge - into both sheets of the close-out workbook."""

import sys
from copy import copy

import openpyxl

BOOK = r"H:\My Drive\Selodia App Project Master Folder\Build Specs\Selodia-Session-Closeouts.xlsx"

LABEL = "S58 continued: 29Sep26  (the merge)"

CHECKLIST = [
    ("Her focus states set, and the numbers shown", "Done", "2026-09-29",
     "Lose fat, maintain muscle, at her instruction. 1,440 kcal and 83-99g protein on her current reading - a 313 kcal deficit on a TDEE of 1,756, which is about 0.5% of body weight a week with protein held high. scripts/show-targets.mjs reads the real rows and does the same arithmetic the phone does, so the answer could be checked before the phone had it."),

    ("Allergies into the tap onboarding - the merge blocker", "Done", "2026-09-29",
     "The conversational health-context step was the only way an allergy ever reached the database, and the tap spine took it out of the chain. The allergy gate and meal suggestions both depend on it and BOTH WOULD HAVE FAILED SILENTLY - no error, just an app confidently offering a vegetarian a chicken salad. Writes to the `allergies` table through the same upsert the chat route uses, with kinds, because a contact allergy treated as a food restriction is what blocked two honest questions about nickel."),
    ("One honest limit on dietary needs, recorded rather than glossed", "Diagnosed", "2026-09-29",
     "The gate's deterministic layer matches the stored NAME against a reply, so 'peanuts' catches peanuts and 'vegetarian' never appears in 'have some chicken'. A dietary need is caught by the prompt and the model layer, not the string layer: two of four rather than three. Weaker than an allergen, and the difference is written in the file."),

    ("The branch merged to main", "Done", "2026-09-29",
     "Her change of plan: the missing goals and plans structure is part of why the app did not make sense, so the test week runs on the version that has it. Eleven commits. Before merging: both typechecks, every check file, the chat test set at 51/51, RLS verified, migrations already live with a rehearsed rollback."),
    ("Exactly what was on main, asked and answered", "Done", "2026-09-29",
     "She caught a contradiction in my own log - 'nothing on main' beside 'the red flags are on main behind a switch'. NOTHING from the overnight run was on main; all ten commits were branch-only, confirmed file by file. I had written 'on main' meaning the mainline rather than a parked experiment, and as written it was simply false. Corrected in the code, the spec and the log."),

    ("THE RED FLAGS ARE NOT APPROVED BY HER", "Done", "2026-09-29",
     "Her correction, and an important one. She asked for them to be BUILT, which is not a sign-off on eighteen clinical judgements, and 'approved by Ruth' in a code comment would have become cover - for a future reader and for me - for a list she had never read. Two reviews outstanding now, hers then a clinician's. Corrected in red-flags.ts, check-red-flags.mjs, SAFETY_ARCHITECTURE section 10, the build log and this workbook."),
    ("The 18 flags written out in plain English", "Done", "2026-09-29",
     "In Drive, GENERATED FROM THE CODE rather than typed beside it, because a hand-copied list of clinical judgements drifts and the day it drifts is the day somebody signs off something that is not what ships. It runs the ten informational questions through the real matcher as it writes them, so if one ever starts firing the document says so in the middle of the list."),

    ("Skills ladders show clipless rungs as text", "Done", "2026-09-29",
     "Her correction to the overnight reading of 'seed only what the library can honestly show'. The dishonesty was never in naming a movement, only in pretending to demonstrate one. So her muscle-up and handstand ladders exist now, text-only, and the check REFUSES a text-only rung with no cue - for those rungs the words are the whole demonstration. A splits ladder was added because the orphan-gap check said two commissions had no rung wanting them, and it was right."),

    ("Redo my setup", "Done", "2026-09-29",
     "Settings, Profile. Moves the onboarding step back and touches nothing else: every screen in the spine replaces its own answers, and the ones that must not be replaced upsert instead. IT NEVER DELETES A LOG, which is the distinction the whole feature turns on - setup is what she decided, a log is what happened."),
    ("Pushed to her phone", "Done", "2026-09-29",
     "EAS update to the preview channel, runtime 1.0.0, which is what her 21 September build is on. Checked first that no native code or dependency changed since that build, so an over-the-air update is enough and no reinstall is needed."),

    ("A check of mine that only worked on LF files", "Fixed", "2026-09-29",
     "check-onboarding-copy passed on the branch and failed on main with byte-identical content. In a JavaScript regex `.` does not match `\\r`, so on a CRLF file the comment stripper silently did nothing and every comment ABOUT the letter upload was read as an offer OF one. Green when you write it, red when it matters, trusted in between. The self-test now runs its fixture twice, once with CRLF."),
    ("check-food-parse could not run at all", "Fixed", "2026-09-29",
     "Pre-existing and identical on main: it copied only ANTHROPIC_API_KEY into the environment, so the dynamic import still reached a Supabase client that threw at module scope. 19 passed, 0 failed once it could run."),
    ("A check testing a wording, for the second time in that file", "Fixed", "2026-09-29",
     "'says it is 5 of 7 days' failed a reply saying 'Monday through Friday, minus Saturday and Sunday which have nothing recorded' - the same fact in better English, and MORE informative than the phrase being hunted for. Rewritten to test the behaviour and proved against six sentences. DECISION_PATTERNS already carried the rule; this is the second time it has caught something in this one file."),

    ("Large text: NOT TESTED, and why", "Outstanding", "2026-09-29",
     "The web preview cannot simulate Android font scaling - React Native declares sizes in points and the browser renders fixed pixels, with no equivalent knob. My first attempt injected CSS that compounded at every nesting level and produced nonsense, which I deleted rather than reporting. What IS checked: none of the new components has a fixed height, maxHeight or numberOfLines. That is reasoning, not evidence. Needs her phone."),
    ("The 12 health test cases", "Queued", "2026-09-29",
     "Still listed and not run. Each needs a live turn and real money, and the output says so every time rather than letting a green tick imply otherwise."),
    ("Open Actionables rebuilt", "Done", "2026-09-29",
     "Five items closed with what each was checked against, eight opened - including the privacy policy and Play Data Safety form as the named PREREQUISITE for the letter upload, and the clinical advisor at GBP 600-1,200 as a pre-launch item."),
]

DECISIONS = [
    ("A request to build is not a sign-off on what gets built", "2026-09-29",
     "I recorded eighteen clinical judgements as 'approved by Ruth' because she had asked for them to be built. She had not read them. The failure is not the wording, it is what the wording would have done: a future reader - including me - would have treated her name as cover for a list she had never seen, and the flag would have been turned on one day by somebody who thought the review had happened. When writing down that something is approved, name WHAT was approved and by WHOM, and if the answer is 'she asked for it to exist', write that instead."),

    ("A check that depends on the working tree is worse than no check", "2026-09-29",
     "check-onboarding-copy passed on the branch and failed on main with identical file contents, because one working tree was LF and the other CRLF, and `.` does not match `\\r` in a JavaScript regex. It was green exactly when it was written and red exactly when it mattered, which is the shape that gets trusted in between. Any script in this repository that reads source has the same trap waiting: Windows autocrlf means every file is CRLF on disk and LF in git. Normalise at read time, and make the self-test run the fixture in BOTH line endings, because the LF fixture is precisely what failed to catch it."),

    ("Naming a movement is honest; pretending to demonstrate one is not", "2026-09-29",
     "'Seed only ladders the library can honestly show' was read as 'a ladder with any undemonstrable rung cannot exist', and the consequence was that Ruth's own joy track - her headline goal - could not be offered by an app built for her. Her correction: show them as text, with the cue. The dishonesty was never in the name. The rule that follows: when a constraint about honesty removes something a person wanted, check whether it is protecting them from a false claim or just from an absence. An absence with an explanation is not a false claim."),

    ("A rehearsed rollback and an untested one are different things", "2026-09-29",
     "The migrations went to the live database while the code sat on a branch, which is a real asymmetry and was worth being asked about. 'A snapshot exists' is not an answer - it is an artefact nobody has tried to use. The restore was run for real inside a transaction that discarded itself, all three rows came back exactly, and the live rows were then re-read to confirm nothing had moved. Also worth recording: the snapshot predates her own later change, so a full rollback would undo that too, which is the kind of thing only a rehearsal tells you."),
]


def main() -> int:
    wb = openpyxl.load_workbook(BOOK)
    check, dec = wb["Checklist"], wb["Decisions"]
    done_fill = copy(check.cell(479, 2).fill)
    header_font = copy(check.cell(477, 1).font)

    def append(ws, header, rows, status_col):
        r = ws.max_row + 2
        ws.cell(r, 1, header).font = copy(header_font)
        r += 1
        for row in rows:
            for c, value in enumerate(row, start=1):
                cell = ws.cell(r, c, value)
                if status_col and c == status_col and value.startswith(("Done", "Fixed", "Diagnosed")):
                    cell.fill = copy(done_fill)
            r += 1
        return r - 1

    check_last = append(check, LABEL, CHECKLIST, 2)
    dec_last = append(dec, LABEL, DECISIONS, None)
    wb.save(BOOK)

    back = openpyxl.load_workbook(BOOK)
    print(f"  sheets: {back.sheetnames}")
    print(f"  Checklist: {back['Checklist'].max_row} rows, label at {check_last - len(CHECKLIST)}")
    print(f"  Decisions: {back['Decisions'].max_row} rows, label at {dec_last - len(DECISIONS)}")
    print(f"  label: {LABEL}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
