"""Find every place Ruth is named, across the repository and the Drive folder.

Two different corrections, and telling them apart is the whole job:

  IN THE APP AND ITS LEGAL DOCUMENTS she is not named at all. Her instruction,
  29 September 2026: "Nothing in the app should have my name anyway, it should
  all say Selodia Ltd. I am not named." A privacy policy names the data
  CONTROLLER, which is the company; a beta agreement is between a tester and
  the company.

  WHERE SHE IS PERSONALLY NAMED AS FOUNDER - the Women in Innovation
  application, Companies House, correspondence she signs - the correction is to
  her full name, Ruth Christianson-Monroy.

WHAT MUST NOT CHANGE, and this is why the script reports before it edits:
  - ruth.christianson@gmail.com and any other address or account identifier
  - the Dropbox vendor path in monthly-animatic-sync.mjs, which is a folder
    name on somebody else's service
  - anything already reading Christianson-Monroy
  - a record of something already SENT. The FemTech email went out today with
    "Ruth Christianson" in the signature. Editing that file would make it stop
    describing what the recipient actually received.

Read-only. It prints; it does not write.
"""

import sys
import zipfile
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DRIVE = Path(r"H:\My Drive\Selodia App Project Master Folder")
REPO = Path(__file__).resolve().parents[1]

NEEDLE = "Ruth Christianson"
GOOD = "Ruth Christianson-Monroy"

TEXT_SUFFIXES = {".md", ".ts", ".tsx", ".js", ".mjs", ".json", ".py", ".txt", ".html", ".css", ".sql"}
SKIP_DIRS = {"node_modules", ".git", ".next", ".expo", "dist", "build"}


def docx_text(path: Path) -> str:
    try:
        with zipfile.ZipFile(path) as z:
            out = []
            for name in z.namelist():
                if name.startswith("word/") and name.endswith(".xml"):
                    out.append(z.read(name).decode("utf-8", "replace"))
            return "\n".join(out)
    except Exception:
        return ""


def hits(text: str) -> tuple[int, int]:
    """(bare occurrences, already-hyphenated occurrences)."""
    full = text.count(GOOD)
    bare = text.count(NEEDLE) - full
    return bare, full


def scan_repo():
    print("\n" + "=" * 74)
    print("  REPOSITORY")
    print("=" * 74)
    found = False
    for p in REPO.rglob("*"):
        if not p.is_file() or p.suffix.lower() not in TEXT_SUFFIXES:
            continue
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        bare, full = hits(text)
        if bare or full:
            found = True
            rel = p.relative_to(REPO)
            for i, line in enumerate(text.splitlines(), 1):
                if NEEDLE in line:
                    tag = "OK  " if GOOD in line else "BARE"
                    print(f"  {tag}  {rel}:{i}")
                    print(f"        {line.strip()[:120]}")
    if not found:
        print("  nothing")


def scan_drive():
    print("\n" + "=" * 74)
    print("  DRIVE  (Word documents, full text including headers and footers)")
    print("=" * 74)
    if not DRIVE.exists():
        print("  H: drive not available")
        return
    rows = []
    for p in sorted(DRIVE.rglob("*.docx")):
        if p.name.startswith("~$"):
            continue
        bare, full = hits(docx_text(p))
        if bare or full:
            rows.append((p, bare, full))
    if not rows:
        print("  nothing")
        return
    for p, bare, full in rows:
        tag = "BARE" if bare else "OK  "
        rel = p.relative_to(DRIVE)
        print(f"  {tag}  {rel}    (bare {bare}, already hyphenated {full})")

    print("\n  Other file types that CANNOT be edited here, listed so they are not")
    print("  silently assumed clean:")
    for suffix in (".pdf", ".gdoc", ".gsheet", ".xlsx"):
        for p in sorted(DRIVE.rglob(f"*{suffix}")):
            if p.name.startswith("~$"):
                continue
            if suffix in (".gdoc", ".gsheet"):
                print(f"    {suffix}  {p.relative_to(DRIVE)}   (a pointer; the content is in Google Drive)")
            elif suffix == ".xlsx":
                bare, full = hits(docx_text(p))
                if bare or full:
                    print(f"    xlsx  {p.relative_to(DRIVE)}   (bare {bare})")
            else:
                print(f"    {suffix}  {p.relative_to(DRIVE)}   (not searched)")


if __name__ == "__main__":
    scan_repo()
    scan_drive()
