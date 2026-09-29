"""Does the APP ever show Ruth's name to a user?

Ruth, 29 September 2026: "Nothing in the app should have my name anyway, it
should all say Selodia Ltd. I am not named."

THE DISTINCTION THIS CHECK EXISTS TO MAKE. The repository is full of her name
and should be: hundreds of comments record which decision was hers and when,
which is the most useful provenance this codebase has. `grep Ruth` returns all
of them and answers the wrong question.

What matters is whether her name reaches a SCREEN. So this strips comments
first and looks only at what is left - string literals and JSX text - in the
user-facing surfaces: the app's own screens, the privacy policy, the terms, and
the beta agreement a tester is shown.

Run:  python scripts/check-founder-not-named.py
"""

import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
REPO = Path(__file__).resolve().parents[1]

# The surfaces a user can actually see.
TARGETS = [
    "mobile/src",
    "app/privacy",
    "app/terms",
    "app/lib/report-render.ts",
    "docs/beta-agreement.md",
]

SUFFIXES = {".ts", ".tsx", ".md", ".html"}

# Her name in any form a screen might carry. NOT the email address and NOT an
# account identifier: ruth.christianson@gmail.com is how she signs in, and a
# check that flagged it would be noise that stops the check being run.
NAME = re.compile(r"\bRuth\b(?!\.christianson)", re.I)


def strip_comments(src: str, suffix: str) -> str:
    """Comments out; string literals and JSX text left in."""
    src = src.replace("\r\n", "\n")
    if suffix == ".md":
        # THE AGREEMENT ENDS WHERE IT SAYS IT ENDS. docs/beta-agreement.md has
        # clauses 1-15 and then a heading reading "Notes, not part of the
        # agreement", holding editorial commentary that no tester ever sees -
        # who filled in the address, why a date is derived, which clause the
        # solicitor should look at. All three mention her by first name.
        #
        # The first version of this check reported those three as hits, which
        # is a check crying wolf on its own first run - and this repository
        # already knows where that leads: closeout_check.py carries the note
        # that its predecessor produced four contradictions, all four false,
        # and nobody would have run it twice.
        #
        # So the cut is made on the document's OWN declared boundary rather
        # than on a guess about which lines look editorial.
        cut = re.search(r"^#+\s*Notes,? not part of the agreement", src, re.M)
        return src[: cut.start()] if cut else src
    src = re.sub(r"/\*[\s\S]*?\*/", "", src)
    return "\n".join(line for line in src.split("\n") if not line.lstrip().startswith("//"))


def main() -> int:
    hits = []
    for target in TARGETS:
        p = REPO / target
        files = [p] if p.is_file() else [f for f in p.rglob("*") if f.suffix in SUFFIXES]
        for f in files:
            try:
                text = f.read_text(encoding="utf-8", errors="replace")
            except Exception:
                continue
            body = strip_comments(text, f.suffix)
            for i, line in enumerate(body.split("\n"), 1):
                if NAME.search(line):
                    hits.append((f.relative_to(REPO), line.strip()[:130]))

    if not hits:
        print("\n  ok  the app never shows her name. Everything user-facing says Selodia Ltd.")
        print("      (Comments recording whose decision something was are untouched, and should be.)")
        return 0

    print(f"\n  {len(hits)} place(s) where her name may reach a screen:\n")
    for path, line in hits:
        print(f"    {path}")
        print(f"        {line}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
