# CORRECT THE COMPANY NUMBER AND NAME IN THE DRIVE FOLDER.
#
#     python scripts/fix_company_identity_drive.py [--apply]
#
# Dry run by default. Nothing in Ruth's Drive is written without --apply.
#
# THE PART THAT NEEDED THINKING ABOUT, because a blanket find-and-replace here
# would destroy evidence.
#
# Some of these documents are WORKING documents: a spec, a draft, a procedure,
# a list of actions. They will be read again and acted on, so they have to be
# right, and correcting them loses nothing.
#
# Others are RECORDS OF WHAT ALREADY WENT OUT or what was already true on a
# date: an email as sent, a privacy policy "as live 2026-09-28", a folder of
# dated backups. Correcting those would make them lie about the past, and the
# past is the thing they exist to hold. The wrong number WAS on the live site
# and WAS in an email to an NHS body, and a file that quietly says otherwise is
# worse than no file.
#
# So this carries an explicit do-not-touch list with a reason for each, and
# anything not matched by it is corrected. Every decision is printed.

import io
import os
import sys

WRONG_NUMBER = "12246794"
RIGHT_NUMBER = "17435894"
WRONG_NAME = "Selod\u00eda Ltd"
RIGHT_NAME = "Selodia Ltd"

ROOT = r"H:\My Drive\Selodia App Project Master Folder"

# Path fragments that must NOT be corrected, and why.
LEAVE_ALONE = [
    ("Script backups (superseded",
     "an archived, dated backup; its job is to hold what the file said then"),
    ("(as live 2026-09-28)",
     "a snapshot of what was published on a date; correcting it would make it lie about that date"),
    ("Accelerating FemTech email - for approval",
     "records an email that was SENT to hin.southlondon@nhs.net carrying the wrong number"),
]


def leave_reason(path):
    for fragment, reason in LEAVE_ALONE:
        if fragment in path:
            return reason
    return None


def fix_text_file(path, apply):
    t = io.open(path, encoding="utf-8").read()
    n = t.count(WRONG_NUMBER)
    m = t.count(WRONG_NAME)
    if n or m:
        if apply:
            out = t.replace(WRONG_NUMBER, RIGHT_NUMBER).replace(WRONG_NAME, RIGHT_NAME)
            if "\x08" in out:
                raise SystemExit("REFUSING: control character in {}".format(path))
            io.open(path, "w", encoding="utf-8", newline="").write(out)
    return n, m


def fix_docx(path, apply):
    from docx import Document

    doc = Document(path)
    n = m = 0

    def do_para(p):
        nonlocal n, m
        full = p.text
        if WRONG_NUMBER not in full and WRONG_NAME not in full:
            return
        n += full.count(WRONG_NUMBER)
        m += full.count(WRONG_NAME)
        if not apply:
            return
        # Per run first, which keeps the formatting of everything around it.
        done = True
        for r in p.runs:
            if WRONG_NUMBER in r.text or WRONG_NAME in r.text:
                r.text = r.text.replace(WRONG_NUMBER, RIGHT_NUMBER).replace(WRONG_NAME, RIGHT_NAME)
        if p.text.count(WRONG_NUMBER) or p.text.count(WRONG_NAME):
            # It was split across runs. Collapse to one run, which loses any
            # formatting inside this one paragraph and keeps the text correct.
            done = False
            fixed = p.text.replace(WRONG_NUMBER, RIGHT_NUMBER).replace(WRONG_NAME, RIGHT_NAME)
            for r in list(p.runs):
                r._element.getparent().remove(r._element)
            p.add_run(fixed)
        return done

    for p in doc.paragraphs:
        do_para(p)
    for tb in doc.tables:
        for row in tb.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    do_para(p)

    if apply and (n or m):
        doc.save(path)
    return n, m


def main():
    apply = "--apply" in sys.argv
    corrected, skipped = [], []

    for dp, dn, fn in os.walk(ROOT):
        for name in fn:
            path = os.path.join(dp, name)
            ext = os.path.splitext(name)[1].lower()
            rel = os.path.relpath(path, ROOT)

            try:
                if ext in (".md", ".txt", ".html", ".csv", ".json"):
                    t = io.open(path, encoding="utf-8").read()
                    hit = WRONG_NUMBER in t or WRONG_NAME in t
                elif ext == ".docx":
                    from docx import Document
                    d = Document(path)
                    t = "\n".join(x.text for x in d.paragraphs)
                    for tb in d.tables:
                        for r in tb.rows:
                            for c in r.cells:
                                t += "\n" + c.text
                    hit = WRONG_NUMBER in t or WRONG_NAME in t
                else:
                    continue
            except Exception:
                continue

            if not hit:
                continue

            reason = leave_reason(rel)
            if reason:
                skipped.append((rel, reason))
                continue

            try:
                n, m = fix_text_file(path, apply) if ext != ".docx" else fix_docx(path, apply)
                corrected.append((rel, n, m))
            except Exception as e:
                skipped.append((rel, "FAILED: {}".format(e)))

    print("\n  {}\n".format("APPLIED" if apply else "DRY RUN, nothing written"))
    print("  CORRECTED ({}):".format(len(corrected)))
    for rel, n, m in sorted(corrected):
        print("    {:<70} {} number, {} name".format(rel[:70], n, m))
    print("\n  LEFT ALONE ON PURPOSE ({}):".format(len(skipped)))
    for rel, reason in sorted(skipped):
        print("    {}\n        {}".format(rel[:78], reason))
    print("")
    return 0


if __name__ == "__main__":
    sys.exit(main())
