"""Add the funding section to Open Actionables, in place, without rewriting it.

Ruth, 29 September 2026: "keep these on the queue and in Open Actionables so
they don't get lost behind build work."

WHY IT INSERTS RATHER THAN REBUILDS. The document is hers and it is long - ten
sections and eleven tables, most of them history. Regenerating it from a
markdown source would be easier to write and would silently drop anything she
has edited by hand since. So this copies the file to a dated backup, inserts one
heading and one table in the right place, and touches nothing else.

The dates work back from an ASSUMED opening of 26 November 2026. The 2025/26
round ran 26 Nov 2025 to 4 Feb 2026, so that is a pattern of one, which is why
every row says what it assumes. If it opens later, everything below is still
worth having on the date given.
"""

import shutil
import sys
from copy import deepcopy
from pathlib import Path

import docx
from docx.text.paragraph import Paragraph

DRIVE = Path(r"H:\My Drive\Selodia App Project Master Folder\Build Specs")
DOC = DRIVE / "Selodia - Open Actionables.docx"
BACKUP = DRIVE / "Selodia - Open Actionables (backup 2026-09-29 before funding).docx"

HEADING = "Funding \u2014 added 29 September (Session 58 afternoon)"

ROWS = [
    ("What", "Note"),

    ("Accelerating FemTech: the email is drafted and NOT sent",
     "Waiting on her yes, and on nothing else. To hin.southlondon@nhs.net from hello@selodia.app. "
     "Draft: Build Specs / 2026-09-28 Accelerating FemTech email - for approval.docx. "
     "ONE THING TO CHECK BEFORE IT GOES: hello@selodia.app is a domain address, and the three known "
     "accounts are Gmail (helloselodia, unflumpapp, ruth.christianson). Confirm that address can "
     "actually send, or change the from line, otherwise the reply goes somewhere nobody reads."),

    ("Women in Innovation: the visibility decision is hers, and it is first",
     "By 31 October 2026, before any writing. The award requires a three-minute video pitch to camera "
     "(a scored question) and a minimum of four hours of role-modelling activity committed to at "
     "application. She is fine appearing on camera for applications and pitches; her standing rule is "
     "no face in the marketing. The two may not conflict, but winning makes her a public award holder "
     "and that is searchable. Decide before ten weeks of writing, not after."),

    ("Wave zero has to collect four things for this application",
     "Asked at the START of the test week, not afterwards, because none of them exist retrospectively. "
     "1. Permission to quote anonymously in a funding application, as a line in the beta agreement. "
     "2. A before and after: what a tester could not see about herself before, and can now. "
     "3. Retention: how many days out of each week she actually opened it. "
     "4. The moment it was useful, one sentence each. These become the quotes."),

    ("Evidence of a team beyond the founder",
     "By 14 November 2026. Their late-stage definition asks for it, and it does not mean employees - an "
     "advisor, a contractor or a clinical reviewer counts. The clinical advisor already on this list "
     "(GBP 600-1,200, for the red flags) would satisfy it and is needed anyway. One commission, two "
     "purposes."),

    ("Draft the questions that do not need beta data",
     "By 21 November 2026. Eleven scored questions of 300 words each. The ones about the problem, the "
     "approach, the market and question 17 on equality and inclusion can all be written before a single "
     "tester has opened the app. Doing them early leaves December for the ones that need evidence."),

    ("Confirm the round's real dates the week it opens",
     "Expected 26 November 2026, assumed from the 2025/26 round (26 Nov 2025 to 4 Feb 2026). That is a "
     "pattern of one. The Monday funding check is instructed to flag it the moment it opens; this row is "
     "the reminder to replace every assumed date below with the published ones."),

    ("First full pass of all eleven answers",
     "By 15 December 2026, using the wave-zero evidence. The draft application document already has every "
     "question in it with the strong answers filled: Build Specs / 2026-09-28 Women in Innovation - draft "
     "application.docx."),

    ("Record the three-minute video pitch",
     "By 12 January 2027, submitted through Pitchtape. It is scored, and it is the only part where an "
     "assessor sees her. Needs the visibility decision settled first."),

    ("Final read and submit",
     "By 26 January 2027, ahead of an expected early-February close. One application per woman and one "
     "woman per organisation, so there is no second attempt in the same round."),

    ("Check the subcontracting ceiling against the real plan",
     "Before submitting. Subcontracting cannot exceed 50% of the grant, so GBP 75,000 means at most GBP "
     "37,500 subcontracted. A solo founder's costed plan leans naturally on contractors, and this is the "
     "constraint most likely to bite quietly."),

    ("Declare prior subsidy",
     "Before submitting. Minimal Financial Assistance limit is GBP 315,000 over a rolling three years and "
     "anything already received must be declared. Check whether anything Selodia Ltd has had counts."),

    ("The weekly funding check has not run yet",
     "Not broken, just newer than it looks. Enabled, Mondays 09:02, next run Monday 5 October 2026. It was "
     "created on Monday 28 September AFTER that morning's slot, so it has never fired and there are no "
     "findings yet. Findings go to Competitor analysis / Competitor analysis and funding watch.docx, and "
     "it reports briefly in chat. Worth a look on 5 October to confirm it actually fires."),

    ("Funding status goes in every close-out from now on",
     "Her standing instruction, 29 September 2026. One line, every close-out, whether or not anything has "
     "moved - the point is that a quiet week is visible rather than absent."),
]


def main() -> int:
    if not DOC.exists():
        print(f"  NOT FOUND: {DOC}")
        return 1
    shutil.copy2(DOC, BACKUP)
    print(f"  backed up to: {BACKUP.name}")

    d = docx.Document(str(DOC))
    body = d.element.body
    children = list(body.iterchildren())

    # The heading whose formatting the new one copies, and the table whose
    # formatting the new one copies. Found by text rather than by index, so a
    # later edit that adds a paragraph above does not silently move the insert.
    anchor_i = None
    for i, child in enumerate(children):
        if child.tag.endswith("}p"):
            if Paragraph(child, d).text.strip().startswith("Open after Session 58"):
                anchor_i = i
                break
    if anchor_i is None:
        print("  could not find the 'Open after Session 58' heading - nothing written")
        return 1

    model_heading = children[anchor_i]
    model_table = children[anchor_i + 1]
    if not model_table.tag.endswith("}tbl"):
        print("  the heading is not followed by a table - nothing written")
        return 1
    # Insert after that table and its trailing blank paragraph.
    insert_after = children[anchor_i + 2]

    # The heading: a copy of the real one, with its text replaced, so it keeps
    # whatever styling she has applied to these.
    new_heading = deepcopy(model_heading)
    hp = Paragraph(new_heading, d)
    for run in hp.runs[1:]:
        run._element.getparent().remove(run._element)
    if hp.runs:
        hp.runs[0].text = HEADING
    else:
        hp.add_run(HEADING)

    new_table_el = deepcopy(model_table)
    insert_after.addnext(new_table_el)
    new_heading_blank = deepcopy(children[anchor_i + 2])
    insert_after.addnext(new_heading)

    # Rebuild the copied table to hold our rows.
    from docx.table import Table

    t = Table(new_table_el, d)
    while len(t.rows) > 1:
        t._tbl.remove(t.rows[-1]._tr)
    template_row = t.rows[0]._tr
    for r, (what, note) in enumerate(ROWS):
        if r == 0:
            row = t.rows[0]
        else:
            t._tbl.append(deepcopy(template_row))
            row = t.rows[-1]
        for cell, text in zip(row.cells, (what, note)):
            for p in cell.paragraphs[1:]:
                p._element.getparent().remove(p._element)
            p = cell.paragraphs[0]
            for run in p.runs[1:]:
                run._element.getparent().remove(run._element)
            if p.runs:
                p.runs[0].text = text
            else:
                p.add_run(text)
    new_table_el.addnext(new_heading_blank)

    # And the date line at the top.
    for par in d.paragraphs:
        if par.text.strip().startswith("Last updated:"):
            if par.runs:
                par.runs[0].text = (
                    "Last updated: Tuesday 29 September 2026, Session 58 "
                    "(the Plans build, the drag, and the funding queue)."
                )
                for run in par.runs[1:]:
                    run._element.getparent().remove(run._element)
            break

    d.save(str(DOC))

    back = docx.Document(str(DOC))
    found = [p.text.strip() for p in back.paragraphs if p.text.strip() == HEADING]
    print(f"  heading present after save: {bool(found)}")
    print(f"  tables now: {len(back.tables)} (was 11)")
    print(f"  funding rows written: {len(ROWS) - 1}")
    return 0 if found else 1


if __name__ == "__main__":
    sys.exit(main())
