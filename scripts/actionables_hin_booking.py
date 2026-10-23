"""The HIN reply arrived. Turn the clinic row from "waiting" into "book it".

Ruth photographed the email on 23 October 2026. It is from the Innovator
Support Team at Health Innovation Network South London, to hello@selodia.app,
and her phone showed it as two days old, so 21 October 2026. THAT DATE IS FROM
A RELATIVE TIMESTAMP IN A SCREENSHOT, not from a header, and the note says so.

WHY THIS IS A NEW STATE AND NOT A NEW ROW. The row below already exists and
already says the open part is the reply. The reply has now come, so the same row
changes state: it is no longer waiting on anybody at HIN, it is waiting on one
click from Ruth. A second row would split one thing in two.

WHAT THE EMAIL ACTUALLY SAYS, which is less than it looks and more than enough:

  The engagement form was received. That half of the row is done.

  There is a booking link in the email body. It is the only route given, and it
  is not reproduced here because the connected Gmail account is her personal
  one and hello@selodia.app sits on another, so nothing here has ever seen the
  URL. Writing a guessed link into her actionables list would be worse than
  writing none.

  Two names are recommended BECAUSE the innovation is in Women's Health:
  Lavinia or Vanessa. That is the part most likely to be lost, and it is the
  part that decides whether the clinic is useful.

  hin.innovatorsupport@nhs.net is the address for anything else.

IT APPENDS AND IT DOES NOT REWRITE, same as actionables_hin_clinic.py: her
words and the earlier record stay, the new state goes on the end.

NO BACKUP COPY. docs/where-things-go.md: Drive keeps version history.
"""

import sys
from pathlib import Path

import docx

DOC = Path(
    r"H:\My Drive\Selodia App Project Master Folder\Build Specs"
) / "Selodia - Open Actionables.docx"

# Matched on opening words, so a later edit to the rest of the title does not
# stop this finding it.
ROW_STARTS = "HIN innovation clinic"

# The title changes because the state changed. Anyone scanning the list should
# see at a glance that this one is hers to do, not hers to wait for.
NEW_TITLE = "HIN innovation clinic: REPLY RECEIVED, A SLOT IS HERS TO BOOK"

# The sentinel this script checks for on a second run.
MARK = "REPLY RECEIVED"

APPENDED = (
    " REPLY RECEIVED 21 October 2026 (the phone showed it as two days old on "
    "the 23rd; there is no header date here to confirm it). From the Innovator "
    "Support Team at Health Innovation Network South London, to "
    "hello@selodia.app. The engagement form was received, so that half is done "
    "and nothing further is owed to them on it. WHAT IS OUTSTANDING IS ONE "
    "BOOKING, and it is Ruth's: the email carries a booking link, and clicking "
    "it is the only route offered. BOOK WITH LAVINIA OR VANESSA. They are named "
    "in the reply as the two to pick BECAUSE the innovation is in the Women's "
    "Health field, so choosing anyone else gives up the one piece of matching "
    "they did for her. The link is not written here: the Gmail account "
    "connected to Claude is her personal one and hello@selodia.app is on "
    "another, so nothing on this machine has seen the URL and a guessed one "
    "would be worse than none. It is in the email, and the email is in that "
    "inbox. Anything else goes to hin.innovatorsupport@nhs.net. THE QUESTIONS "
    "TO TAKE INTO THE SLOT ARE ALREADY WRITTEN, in Build Specs / 2026-10-07 HIN "
    "innovation clinic - what to send and what to ask.docx, and the first of "
    "them is still the Software as a Medical Device one. STILL WORTH DOING "
    "SOON rather than in November: a clinic has to be booked before it can be "
    "attended, and the SaMD answer is most useful before the Women in "
    "Innovation round opens, expected around 26 November."
)


def main() -> int:
    if not DOC.exists():
        print(f"  NOT FOUND: {DOC}")
        return 1

    doc = docx.Document(DOC)

    target = None
    for table in doc.tables:
        for row in table.rows:
            if row.cells[0].text.strip().startswith(ROW_STARTS):
                target = row
                break
        if target:
            break

    if not target:
        print(f'  NOT FOUND: no row starting "{ROW_STARTS}". Nothing written.')
        return 1

    note = target.cells[1]
    if MARK in note.text:
        print("  Already recorded. Nothing written.")
        return 0

    # The title cell: replace the text of its first run and drop the rest, so
    # the row keeps the face the rest of the table is wearing.
    title_para = target.cells[0].paragraphs[0]
    for run in title_para.runs[1:]:
        run._r.getparent().remove(run._r)
    if title_para.runs:
        title_para.runs[0].text = NEW_TITLE
    else:
        title_para.add_run(NEW_TITLE)

    para = note.paragraphs[-1]
    if para.runs:
        para.runs[-1].text = para.runs[-1].text + APPENDED
    else:
        para.add_run(APPENDED)

    doc.save(DOC)

    # READ BACK. A save that silently wrote nothing is the failure this kind of
    # script produces most often, and the one that cost two rounds on 22 Oct.
    check = docx.Document(DOC)
    rows = [
        r
        for t in check.tables
        for r in t.rows
        if r.cells[0].text.strip().startswith(ROW_STARTS)
    ]
    ok_title = any(NEW_TITLE in r.cells[0].text for r in rows)
    ok_note = any(MARK in r.cells[1].text for r in rows)
    # Case-insensitive on purpose. The first version of this check looked for
    # "Lavinia" while the sentence it was checking says "LAVINIA OR VANESSA",
    # so it reported a failure on a write that had worked. A check anchored on
    # a casing is anchored on wording, not on whether the names are there.
    ok_names = any(
        "lavinia" in r.cells[1].text.lower() and "vanessa" in r.cells[1].text.lower()
        for r in rows
    )
    print(f"  read back: title={ok_title} note={ok_note} names={ok_names}")
    return 0 if (ok_title and ok_note and ok_names) else 1


if __name__ == "__main__":
    sys.exit(main())
