# CORRECT THE COMPANY NUMBER AND THE LEGAL NAME, EVERYWHERE.
#
#     python scripts/fix-company-identity.py [--drive]
#
# Ruth, 8 October 2026. The number published on selodia.app, in the privacy
# policy, the terms, the beta agreement, the DPIA and the breach-response
# procedure was 12246794. That is SILODIA LIMITED, an unrelated property
# company in Orpington, incorporated 7 October 2019.
#
# VERIFIED ON THE COMPANIES HOUSE REGISTER before anything was changed, both
# ways round:
#
#   17435894  SELODIA LTD, active, incorporated 3 September 2026,
#             19 Campbell Road, London, England, E17 6RR. Ours.
#   12246794  SILODIA LIMITED, active, incorporated 7 October 2019,
#             186 Petts Wood Road, Orpington. Not ours.
#
# AND THE NAME. The company is registered as SELODIA LTD with no accent. The
# PRODUCT is Selodía and keeps its accent everywhere. Only the exact string
# "Selodía Ltd" changes, which is unambiguous: the product is never written
# with "Ltd" after it.
#
# WHY A SCRIPT RATHER THAN SIXTEEN EDITS. It is the same two substitutions in
# sixteen files across two trees, it has to be complete rather than mostly
# complete, and it prints what it touched so the change can be checked line by
# line afterwards.

import io
import os
import sys

WRONG_NUMBER = "12246794"
RIGHT_NUMBER = "17435894"
WRONG_NAME = "Selod\u00eda Ltd"
RIGHT_NAME = "Selodia Ltd"

SELF = os.path.basename(__file__)

SKIP_DIRS = {"node_modules", ".next", ".git", ".expo", "dist", "build", "__pycache__"}
TEXT_EXT = {
    ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".txt", ".html",
    ".css", ".sql", ".py", ".yml", ".yaml",
}

DRIVE = (
    r"H:\My Drive\Selodia App Project Master Folder\Build Specs"
)


def walk(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            # NEVER ITSELF. On the first run it rewrote its own constants and
            # the comment recording which number was wrong, which is the one
            # file in the tree whose whole value is quoting the bad values.
            if name == SELF:
                continue
            if os.path.splitext(name)[1].lower() in TEXT_EXT:
                yield os.path.join(dirpath, name)


def fix(path):
    """Returns (number_hits, name_hits) and rewrites the file if either is non-zero."""
    try:
        text = io.open(path, encoding="utf-8").read()
    except (UnicodeDecodeError, PermissionError, OSError):
        return (0, 0)

    n = text.count(WRONG_NUMBER)
    m = text.count(WRONG_NAME)
    if n == 0 and m == 0:
        return (0, 0)

    out = text.replace(WRONG_NUMBER, RIGHT_NUMBER).replace(WRONG_NAME, RIGHT_NAME)
    if "\x08" in out:
        raise SystemExit("REFUSING: control character in {}".format(path))
    io.open(path, "w", encoding="utf-8", newline="").write(out)
    return (n, m)


def main():
    roots = ["."]
    if "--drive" in sys.argv:
        roots = [DRIVE]

    touched = []
    total_n = total_m = 0
    for root in roots:
        if not os.path.isdir(root):
            print("MISSING: {}".format(root))
            return 1
        for path in walk(root):
            n, m = fix(path)
            if n or m:
                touched.append((os.path.relpath(path, root), n, m))
                total_n += n
                total_m += m

    if not touched:
        print("  nothing to change")
        return 0

    print("\n  {} file(s) changed\n".format(len(touched)))
    print("  {:<58} {:>7} {:>7}".format("file", "number", "name"))
    for path, n, m in sorted(touched):
        print("  {:<58} {:>7} {:>7}".format(path.replace("\\", "/")[:58], n or "", m or ""))
    print("\n  {} number corrections, {} name corrections\n".format(total_n, total_m))

    # Nothing may be left behind.
    left = []
    for root in roots:
        for path in walk(root):
            try:
                t = io.open(path, encoding="utf-8").read()
            except (UnicodeDecodeError, PermissionError, OSError):
                continue
            if WRONG_NUMBER in t or WRONG_NAME in t:
                left.append(path)
    if left:
        print("  STILL PRESENT IN:")
        for p in left:
            print("    {}".format(p))
        return 1
    print("  verified: neither the old number nor the old name remains\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
