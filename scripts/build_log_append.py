"""Append a session to the build log. The step WORKFLOW says is automatic.

WHY THIS FILE EXISTS, 27 September 2026. Ruth, item 12: "Session logs and article
logs: verify and backfill, find why it stopped, fix so it can't silently fail."

WHAT THE CHECK FOUND. Sessions 45 to 53 - nine of them, 16 to 24 September - are
missing from Selodia-Build-Log.docx. The close-out WORKBOOK has every one of those
dates, so the sessions themselves were closed out properly. Only the build log
was skipped.

AND WHY IT WAS SKIPPED. WORKFLOW.md describes step 5 as a Word document "appended
automatically at step 5 of the automated close-out below". It never was. No script
for it has ever existed in this repository - the history was searched. Every entry
in that file was written by hand, and a hand-written step described in the
documentation as automated is a step nobody checks, because the document says it
takes care of itself. Nine sessions is what that costs.

So there is now a script, and closeout_check.py refuses to pass a close-out whose
session is not in this file.

WHAT THIS DOES NOT DO. It does not write the prose. The build log is the one
artefact in the close-out that is written rather than tabulated, and generating
those paragraphs would defeat the point of having it. It takes the text and puts
it in the file correctly.

    python scripts/build_log_append.py entry.txt
    python scripts/build_log_append.py entry.txt --before 54

The log is chronological, so a backfilled session has to go where it belongs
rather than on the end. `--before N` inserts it immediately ahead of session N's
header. Without it the entry goes at the end, which is right for the session just
finishing.

The file is a header line, then a Toggl line, then one paragraph per
non-empty line:

    Session 56 | 27 September 2026 | Laptop, Felix's room | 08:30 | both
    First paragraph.
    Second paragraph.

The four facts on the header line are not inferable and are not guessed at. Pass
"?" for any that is genuinely unknown and it is written as a placeholder in the
same style as the Toggl line, which is the existing convention in this document
for a fact only Ruth has.
"""

import re
import shutil
import sys
import zipfile
from pathlib import Path

BOOK = Path(
    r"H:\My Drive\Selodia App Project Master Folder\Build Specs\Selodia-Build-Log.docx"
)

# Word's own shape in this file: a plain paragraph, no styles. Matched from the
# existing entries rather than invented, so an appended session is indistinguishable
# from a hand-written one.
PARA = "<w:p><w:pPr/><w:r><w:t>{}</w:t></w:r></w:p>"
BLANK = "<w:p><w:pPr/></w:p>"
PLACEHOLDER = "\u2014 Ruth fills in"


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def header_line(spec: str) -> str:
    """Session N · Date · Location · Start · Tools, with unknowns marked."""
    parts = [p.strip() for p in spec.split("|")]
    if len(parts) != 5:
        raise SystemExit(
            f"  The header needs five fields separated by | - got {len(parts)}:\n    {spec}"
        )
    session, date, location, start, tools = (p if p and p != "?" else PLACEHOLDER for p in parts)
    return f"{session} \u00b7 {date} \u00b7 {location} \u00b7 {start} \u00b7 Tools: {tools}"


def session_numbers(xml: str) -> set[int]:
    return {int(n) for n in re.findall(r">Session (\d+)", xml)}


def insertion_point(xml: str, before: int | None) -> int:
    """Where the new block goes: ahead of a session, or at the end of the body."""
    if before is None:
        # Before the section properties, which are the last thing in the body.
        # Appending after </w:body> produces a file Word opens as corrupt.
        return xml.rindex("<w:sectPr")

    # The paragraph that OPENS that session, so the new entry lands in front of it
    # rather than inside it. Search back from the header text to the <w:p> that
    # contains it, and then back again over the blank spacer paragraph that
    # separates entries, so the spacing pattern survives.
    m = re.search(rf">Session {before}\b", xml)
    if not m:
        raise SystemExit(f"  Session {before} is not in the build log, so there is nothing to insert before.")
    i = xml.rindex("<w:p>", 0, m.start())
    if xml[:i].endswith(BLANK):
        i -= len(BLANK)
    return i


# The Contents list at the top, as Word wrote it: a plain paragraph per session,
# with two spaces either side of the separator. The body headers use one space,
# which is what tells the two apart.
CONTENTS_ENTRY = (
    '<w:p><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>'
    '<w:b w:val="0"/><w:color w:val="2D2B28"/><w:sz w:val="20"/></w:rPr>'
    "<w:t>Session {n}  ·  {date}</w:t></w:r></w:p>"
)


def rebuild_contents(xml: str) -> str:
    """Regenerate the Contents list from the body's own session headers.

    IT HAD GONE STALE, and silently. The list stopped at session 44 while the body
    ran to 55 - eleven sessions in the document and not in its own contents page,
    with nothing to mark the moment it fell behind. WORKFLOW says to "update the
    table of contents afterwards", which is a step somebody has to remember, and the
    evidence that nobody did is the document itself.

    So it is not updated, it is rebuilt, every time, from the headers that are
    actually there. There is no second list to keep in step - the same design the
    ceremony already uses for the specification renderings.
    """
    # EITHER SEPARATOR, and the reason is a bug this very function had. The
    # template in WORKFLOW uses a middle dot and sessions 36 to 53 all use one,
    # but 54 and 55 were written with an em dash - so the first version of this
    # rebuild silently produced a contents list ending at 53, with the two newest
    # sessions missing and nothing to say why. A separator is a detail; a list that
    # quietly omits the newest entries is the exact failure this is fixing.
    sessions = re.findall(r">Session (\d+) [·—] ([^·—<]+?) [·—]", xml)
    if not sessions:
        return xml

    start = xml.find("<w:t>Contents</w:t>")
    if start < 0:
        return xml
    start = xml.index("</w:p>", start) + len("</w:p>")

    # Consume the existing entries, however many there are, and only those.
    end = start
    while True:
        m = re.match(r"<w:p>(?:(?!</w:p>).)*?>Session \d+ {2}· {2}[^<]*</w:t></w:r></w:p>", xml[end:], re.S)
        if not m:
            break
        end += m.end()

    fresh = "".join(CONTENTS_ENTRY.format(n=n, date=d.strip()) for n, d in sessions)
    return xml[:start] + fresh + xml[end:]


def append(entry_path: Path, before: int | None = None) -> int:
    lines = [l.rstrip() for l in entry_path.read_text(encoding="utf-8").split("\n")]
    lines = [l for l in lines if l.strip()]
    if len(lines) < 2:
        raise SystemExit("  Needs a header line and at least one paragraph.")

    header = header_line(lines[0])
    paragraphs = lines[1:]

    if not BOOK.exists():
        raise SystemExit(f"  Not found, and this script does not create it:\n    {BOOK}")

    with zipfile.ZipFile(BOOK) as z:
        parts = {n: z.read(n) for n in z.namelist()}
    xml = parts["word/document.xml"].decode("utf-8")

    m = re.match(r"Session (\d+)", header)
    if m and int(m.group(1)) in session_numbers(xml):
        raise SystemExit(f"  Session {m.group(1)} is already in the build log. Nothing written.")

    block = (
        BLANK
        + PARA.format(esc(header))
        + PARA.format(esc(f"Toggl session: {PLACEHOLDER}"))
        + "".join(PARA.format(esc(p)) for p in paragraphs)
    )

    i = insertion_point(xml, before)
    xml = xml[:i] + block + xml[i:]
    xml = rebuild_contents(xml)

    # A BACKUP FIRST, BECAUSE THIS FILE IS THE ONLY COPY. Everything else in the
    # close-out is regenerated from the repository; the build log is not, and its
    # nine missing sessions are not recoverable from anywhere.
    backup = BOOK.with_name(BOOK.stem + " (backup before append).docx")
    shutil.copy2(BOOK, backup)

    # WELL-FORMED OR NOTHING IS WRITTEN (added 2026-09-28).
    #
    # Adding Ruth's locations by hand put "V&A East Storehouse" into the document
    # with a bare ampersand and produced a file Word opens as corrupt. This
    # function escapes properly and that edit bypassed it, which is the argument
    # for the check rather than for being careful: the file is the only copy of
    # the build log, and a corrupt one is not obviously corrupt until somebody
    # opens it.
    import xml.dom.minidom

    try:
        xml.dom.minidom.parseString(xml.encode("utf-8"))
    except Exception as exc:  # noqa: BLE001 - any parse failure means do not write
        raise SystemExit(
            "  The document would not be well-formed XML, so nothing was written.\n"
            f"    {exc}"
        )

    parts["word/document.xml"] = xml.encode("utf-8")
    with zipfile.ZipFile(BOOK, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in parts.items():
            z.writestr(name, data)

    print(f"  appended: {header}")
    print(f"  {len(paragraphs)} paragraph(s), backup at {backup.name}")
    return 0


if __name__ == "__main__":
    args = sys.argv[1:]
    before = None
    if "--before" in args:
        j = args.index("--before")
        before = int(args[j + 1])
        del args[j : j + 2]
    if len(args) != 1:
        raise SystemExit(__doc__)
    sys.exit(append(Path(args[0]), before))
