"""Correct the founder's name in Drive documents, and mark the FemTech email sent.

Two documents change and one deliberately does not, which is the interesting
part.

WOMEN IN INNOVATION - "what it asks for and what we build first". One sentence
names her as a founder in an innovation award. She IS personally named there,
legitimately, so it becomes Ruth Christianson-Monroy.

ACCELERATING FEMTECH - the email. SUPERSEDED THE SAME DAY; see
femtech_name_correction.py, which is the script that actually holds.

What this one did was leave the signature reading "Ruth Christianson" on the
grounds that the email had been sent and a record must describe what the
recipient received. The principle was right and the fact was wrong: she had
edited the signature before sending, so it went out as Ruth Christianson-Monroy.
The same principle then required the opposite action - correct the file, because
the version on disk no longer matched the email. Kept here rather than deleted
because the reasoning is the reusable part, and it is easy to mistake "do not
edit a record" for a rule about not editing rather than a rule about matching
reality.

The rest of the repository and Drive is already right, which the scan showed:
the privacy policy and terms never name her, the beta agreement's clauses never
name her (only its "Notes, not part of the agreement" section does), and the
app itself never shows her name to anybody.
"""

import shutil
import sys
from pathlib import Path

import docx

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DRIVE = Path(r"H:\My Drive\Selodia App Project Master Folder\Build Specs")
WII = DRIVE / "2026-09-28 Women in Innovation - what it asks for and what we build first.docx"
FEMTECH = DRIVE / "2026-09-28 Accelerating FemTech email - for approval.docx"

BARE = "Ruth Christianson"
FULL = "Ruth Christianson-Monroy"

SENT_NOTE = (
    "SENT on Tuesday 29 September 2026, from hello@selodia.app to "
    "hin.southlondon@nhs.net. The signature below reads \u201cRuth Christianson\u201d, "
    "which is what the recipient received, so it is left exactly as it went out "
    "rather than corrected \u2014 a record that is edited afterwards stops being a "
    "record. Her full name is Ruth Christianson-Monroy, and that is the name to "
    "use in any reply or follow-up."
)


def replace_in_paragraph(par, old: str, new: str) -> int:
    """Replace within runs where possible, so formatting survives."""
    if old not in par.text:
        return 0
    done = 0
    for run in par.runs:
        if old in run.text:
            run.text = run.text.replace(old, new)
            done += 1
    if done:
        return done
    # The name is split across runs. Put the whole paragraph in the first run
    # and drop the rest: these paragraphs are plain body text, so nothing is
    # lost but the split itself.
    text = par.text.replace(old, new)
    for run in par.runs[1:]:
        run._element.getparent().remove(run._element)
    if par.runs:
        par.runs[0].text = text
    return 1


def fix_wii() -> int:
    if not WII.exists():
        print(f"  MISSING  {WII.name}")
        return 0
    shutil.copy2(WII, WII.with_name(WII.stem + " (backup 2026-09-29).docx"))
    d = docx.Document(str(WII))
    n = 0
    for par in d.paragraphs:
        if BARE in par.text and FULL not in par.text:
            n += replace_in_paragraph(par, BARE, FULL)
    for t in d.tables:
        for row in t.rows:
            for cell in row.cells:
                for par in cell.paragraphs:
                    if BARE in par.text and FULL not in par.text:
                        n += replace_in_paragraph(par, BARE, FULL)
    d.save(str(WII))
    back = docx.Document(str(WII))
    text = "\n".join(p.text for p in back.paragraphs)
    bare_left = text.count(BARE) - text.count(FULL)
    print(f"  {WII.name}")
    print(f"      replaced {n}, bare occurrences left: {bare_left}")
    return n


def mark_femtech_sent() -> int:
    if not FEMTECH.exists():
        print(f"  MISSING  {FEMTECH.name}")
        return 0
    shutil.copy2(FEMTECH, FEMTECH.with_name(FEMTECH.stem + " (backup 2026-09-29).docx"))
    d = docx.Document(str(FEMTECH))
    if any(p.text.strip().startswith("SENT on") for p in d.paragraphs):
        print(f"  {FEMTECH.name}\n      already marked sent")
        return 0
    # Replace the "Nothing has been sent" line, which is now false, and put the
    # sent note in its place.
    hit = None
    for par in d.paragraphs:
        if "Nothing has been sent" in par.text:
            hit = par
            break
    if hit is None:
        print("      could not find the 'Nothing has been sent' line - nothing written")
        return 0
    for run in hit.runs[1:]:
        run._element.getparent().remove(run._element)
    if hit.runs:
        hit.runs[0].text = SENT_NOTE
    else:
        hit.add_run(SENT_NOTE)
    d.save(str(FEMTECH))
    back = docx.Document(str(FEMTECH))
    ok = any(p.text.strip().startswith("SENT on") for p in back.paragraphs)
    still_bare = any(BARE in p.text and FULL not in p.text for p in back.paragraphs)
    print(f"  {FEMTECH.name}")
    print(f"      marked sent: {ok}")
    print(f"      signature left as sent: {still_bare} (deliberate - see the note in this script)")
    return 1


if __name__ == "__main__":
    print("\n  DRIVE DOCUMENTS\n")
    fix_wii()
    mark_femtech_sent()
