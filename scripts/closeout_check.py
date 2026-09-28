"""Check, at close-out, whether the documents still tell the truth.

WHY THIS EXISTS NOW, AND NOT BEFORE. WORKFLOW.md held it back deliberately: "the
rule above costs nothing and might be sufficient on its own, and a script written
before we know that would be tooling built to compensate for a convention nobody
tried. Revisit if drift recurs after this rule is in force."

The rule went in on 2026-09-08. On 2026-09-09 three more status claims were found
false - the hydration quick-tap marked unbuilt in two places while it had eight
real rows in the database, conversational personal-metric correction marked
unbuilt twelve days after it shipped, and item 35 marked unbuilt with both its
tables carrying rows. Ruth found the first by knowing the app, not by reading the
document. That is the recurrence the note names, so this is the revisit it asks
for rather than a decision being overridden.

WHAT THE FIRST VERSION GOT WRONG, kept here because it shaped this one. It tried
to detect contradictions automatically: find a not-built claim, look for a file,
table or route named nearby, and flag it if that thing existed. On its first run
it produced four contradictions and ALL FOUR WERE FALSE - "no such test" matched
the source file rather than a test, a claim about the unbuilt Almanac SCREEN
matched the `almanac_entries` table, and WORKFLOW's own history of the nine stale
claims matched the spec's filename. Proximity cannot recover which artefact a
sentence is about. A checker that cries wolf on its first run is one nobody runs
twice, so the guessing is gone.

WHAT IT DOES INSTEAD, and the split is the point:

  1. THE INVENTORY, always. Every status claim across the six documents, on one
     scannable page. It asserts nothing about correctness - it just puts the
     claims in front of a person who knows the app, which is exactly how all
     three of today's were actually caught.

  2. VERIFIED CLAIMS, opt-in and exact. A claim can name what would disprove it,
     inline: `<!-- verify: table hydration_logs -->`. Then this checks that
     precisely, with no inference and no false positives. Markers get added as
     claims are written, so coverage grows without anyone retrofitting 52,000
     words in an afternoon.

Plus the mechanical half of ceremony step 1 - working tree, push state, and the
five Drive documents byte-identical - which was previously done by hand.

    python scripts/closeout_check.py
    python scripts/closeout_check.py --session 56

Pass --session so the log checks can say whether THIS session is in the build
log. Without it they report the latest entry and leave the judgement to you,
because a session number is not inferable - see step 6 of the ceremony.
"""

import datetime as dt
import io
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SYNCED = Path(r"H:\My Drive\Selodia App Project Master Folder\Build Specs"
              r"\Claude Code Working Build Specs")

# THE TWO WRITTEN LOGS AND THE WORKBOOK, which nothing checked until 27 September
# 2026 and which had between them lost nine sessions and three days.
DRIVE = SYNCED.parent
BUILD_LOG = DRIVE / "Selodia-Build-Log.docx"
CAPTURES_DOCX = DRIVE / "Selodia Article Captures.docx"
WORKBOOK = DRIVE / "Selodia-Session-Closeouts.xlsx"
CAPTURES_MD = REPO / "ARTICLE_CAPTURES.md"

SYNC_PAIRS = [
    ("mobile/SELODIA_SPEC.md", "selodia-build-specification.md"),
    ("mobile/WORKFLOW.md", "selodia-workflow.md"),
    ("mobile/SELODIA_LANGUAGE_RULES.md", "selodia-mi-language-rules.md"),
    ("mobile/SAFETY_ARCHITECTURE.md", "selodia-safety-architecture.md"),
    ("mobile/DECISION_PATTERNS.md", "selodia-decision-patterns.md"),
]
DOCS = [p for p, _ in SYNC_PAIRS] + ["mobile/SELODIA_MARKETING_SPEC.md"]

# Narrow on purpose. A wider net catches reasoning ("we rejected X because it does
# not scale"), and noise is what stops a check being run.
CLAIM_RE = re.compile(
    r"not yet built|\bunbuilt\b|is not built|does not exist|not implemented|"
    r"remains? open|still open|not wired|no such (?:test|file|table|route)",
    re.I,
)

# A claim already written as history is exempt - WORKFLOW's own escape hatch is
# "write what it WAS and mark it as history", so the tool has to honour it or the
# convention and the tool disagree with each other.
HISTORY_RE = re.compile(
    r"~~|at that time|as of \d|was the position|kept because|corrected \d{4}|"
    r"until \d{4}-\d{2}-\d{2}|previously said|used to say|no longer|had been",
    re.I,
)

# The opt-in marker. Sits in an HTML comment so it is invisible in the rendered
# Word document and in any Markdown preview.
VERIFY_RE = re.compile(r"<!--\s*verify:\s*(file|table|route)\s+([^\s>]+)\s*-->", re.I)


def sh(*args):
    return subprocess.run(args, cwd=REPO, capture_output=True, text=True).stdout.strip()


def env():
    out, p = {}, REPO / ".env.local"
    if p.exists():
        for line in io.open(p, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                out.setdefault(k.strip(), v.strip().strip("\"'"))
    return out


def live_tables():
    e = env()
    url, key = e.get("NEXT_PUBLIC_SUPABASE_URL"), e.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    req = urllib.request.Request(
        url.rstrip("/") + "/rest/v1/",
        headers={"apikey": key, "Authorization": f"Bearer {key}",
                 "Accept": "application/openapi+json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return set(json.loads(r.read().decode()).get("definitions", {}).keys())
    except (urllib.error.URLError, ValueError, TimeoutError):
        return None


def artefact_exists(kind, name, tables):
    if kind == "file":
        return any((base / name).exists()
                   for base in (REPO, REPO / "mobile", REPO / "mobile" / "src", REPO / "app"))
    if kind == "route":
        return (REPO / "app" / name.lstrip("/")).is_dir()
    if kind == "table":
        return None if tables is None else name in tables
    return None


def docx_text(path):
    """Every run of text in a .docx, joined. Enough to ask whether a date is in it."""
    try:
        with zipfile.ZipFile(path) as z:
            xml = z.read("word/document.xml").decode("utf-8")
    except (OSError, KeyError, zipfile.BadZipFile):
        return None
    return " ".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", xml, re.S))


def xlsx_text(path):
    """Every inline string across every sheet. Same purpose as docx_text."""
    try:
        with zipfile.ZipFile(path) as z:
            sheets = [n for n in z.namelist() if n.startswith("xl/worksheets/sheet")]
            xml = " ".join(z.read(n).decode("utf-8") for n in sheets)
    except (OSError, zipfile.BadZipFile):
        return None
    return " ".join(re.findall(r"<t[^>]*>(.*?)</t>", xml, re.S))


def check_logs(session):
    """The two written logs and the workbook. Returns the number of blocking items.

    EVERY ONE OF THESE BLOCKS, deliberately. The information was always available -
    anybody could have opened the build log and seen it end at session 44 - and
    nobody did for nine sessions. A check that prints a note at the end of a long
    report is the same as no check.
    """
    blocking = 0
    today = dt.date.today()
    # "27 September 2026", the form both logs actually use.
    human = f"{today.day} {today.strftime('%B')} {today.year}"

    print("\n  THE WRITTEN LOGS  (nothing checked these until 27 September 2026)\n")

    # 1. The build log, by session number.
    text = docx_text(BUILD_LOG)
    if text is None:
        print("    SKIPPED          build log unreadable or no H: drive")
    else:
        found = sorted({int(n) for n in re.findall(r"Session (\d+)", text)})
        latest = max(found) if found else None
        gaps = [n for n in range(min(found), max(found) + 1) if n not in found] if found else []
        if session is None:
            print(f"    latest entry     Session {latest} (pass --session N to check this one)")
        elif session in found:
            print(f"    in the log       Session {session}")
        else:
            print(f"    MISSING          Session {session} is not in the build log (latest is {latest})")
            print("                     python scripts/build_log_append.py entry.txt")
            blocking += 1
        if gaps:
            print(f"    GAPS             sessions absent from the run: {gaps}")
            blocking += 1

    # 2. The article log, by today's date.
    if not CAPTURES_MD.exists():
        print("    MISSING          ARTICLE_CAPTURES.md")
        blocking += 1
    else:
        md = CAPTURES_MD.read_text(encoding="utf-8")
        dates = re.findall(r"^## (\d+ \w+ \d{4})", md, re.M)
        if human in md:
            print(f"    in the log       article entries for {human}")
        else:
            print(f"    MISSING          no article entry for {human} (last was {dates[-1] if dates else 'none'})")
            blocking += 1

        # 3. And the Word copy, which is what she can actually read.
        docx = docx_text(CAPTURES_DOCX)
        if docx is None:
            print("    SKIPPED          article captures .docx unreadable or no H: drive")
        elif dates and dates[-1] in docx:
            print("    rendered         article captures .docx is up to date")
        else:
            print("    STALE            article captures .docx does not have the newest entry")
            print("                     python scripts/make-captures-docx.py ARTICLE_CAPTURES.md \"<drive path>\"")
            blocking += 1

    # 4. The workbook, by today's date. This one has never drifted, and is checked
    #    anyway: the reason it has not drifted is that a script writes it, and a
    #    script can start failing.
    book = xlsx_text(WORKBOOK)
    if book is None:
        print("    SKIPPED          workbook unreadable or no H: drive")
    elif today.isoformat() in book:
        print(f"    in the workbook  rows dated {today.isoformat()}")
    else:
        print(f"    MISSING          no workbook rows dated {today.isoformat()}")
        blocking += 1

    return blocking


def main(session=None):
    blocking = 0
    print("\n" + "=" * 74)
    print("  CLOSE-OUT CHECK")
    print("=" * 74)

    print("\n  GIT\n")
    dirty = sh("git", "status", "--porcelain")

    # AGAINST THIS BRANCH'S OWN UPSTREAM, not against origin/main (fixed
    # 2026-09-29). It compared `origin/main..HEAD`, so a session working on a
    # branch - which is what the overnight brief asked for - reported nine
    # unpushed commits and one blocking item AFTER the branch had been pushed
    # and was byte-identical to its remote.
    #
    # That is this file's own stated failure mode, from the comment at the top:
    # "a checker that cries wolf on its first run is one nobody runs twice".
    # A false blocker is worse than a missing one, because the response to it is
    # to stop believing the blockers.
    upstream = sh("git", "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
    branch = sh("git", "rev-parse", "--abbrev-ref", "HEAD")
    against = upstream if upstream else "origin/main"
    ahead = sh("git", "log", "--oneline", f"{against}..HEAD")

    print(f"    working tree      {'DIRTY' if dirty else 'clean'}")
    if ahead:
        print(f"    pushed            NO ({len(ahead.splitlines())} unpushed vs {against})")
    elif upstream:
        print(f"    pushed            yes ({branch} -> {upstream})")
    else:
        # No upstream at all. Not pushed anywhere, and saying so is the point.
        print(f"    pushed            NO UPSTREAM for {branch}")
    print(f"    head              {sh('git', 'log', '--oneline', '-1')}")
    blocking += bool(dirty) + bool(ahead) + (0 if upstream else 1)

    # A BRANCH THAT IS PUSHED IS NOT A BRANCH THAT IS MERGED, and the close-out
    # should not let that blur. Stated rather than blocking: the decision to
    # merge is Ruth's, and a session can legitimately close with work parked on
    # a branch awaiting her review.
    if branch != "main":
        unmerged = sh("git", "log", "--oneline", f"origin/main..HEAD")
        if unmerged:
            print(f"\n    ON A BRANCH       {branch}, {len(unmerged.splitlines())} commit(s) not in main")
            print("                      Not blocking. Merging is a decision, not a chore.")

    print("\n  DRIVE SYNC  (byte-identical, ceremony step 1)\n")
    if not SYNCED.is_dir():
        print("    SKIPPED - no H: drive. A remote session cannot do this, and must say so.")
    else:
        for repo_rel, drive_name in SYNC_PAIRS:
            src, dst = REPO / repo_rel, SYNCED / drive_name
            if not src.exists():
                state = "MISSING SOURCE"
            elif not dst.exists():
                state = "NOT ON DRIVE"
            elif src.read_bytes() != dst.read_bytes():
                state = "DIFFERS"
            else:
                state = "same"
            print(f"    {state:<17} {drive_name}")
            blocking += state != "same"

    blocking += check_logs(session)

    tables = live_tables()
    claims, verified, contradicted, unknown = [], 0, [], 0

    for rel in DOCS:
        path = REPO / rel
        if not path.exists():
            continue
        for n, line in enumerate(io.open(path, encoding="utf-8"), start=1):
            for m in CLAIM_RE.finditer(line):
                lo, hi = max(0, m.start() - 300), min(len(line), m.end() + 300)
                window = line[lo:hi]
                if HISTORY_RE.search(window):
                    continue
                marker = VERIFY_RE.search(window)
                if marker:
                    kind, name = marker.group(1).lower(), marker.group(2)
                    exists = artefact_exists(kind, name, tables)
                    if exists is None:
                        unknown += 1
                    elif exists:
                        contradicted.append((rel, n, m.group(0), kind, name))
                    else:
                        verified += 1
                else:
                    claims.append((rel, n, m.group(0).strip(), window.strip()))

    print(f"\n  VERIFIED CLAIMS  (live tables: {len(tables) if tables else 'unavailable'})\n")
    if contradicted:
        print("    CONTRADICTED - the claim says not-built and the named artefact is there:\n")
        for rel, n, claim, kind, name in contradicted:
            print(f"      {rel}:{n}  \"{claim}\"  ->  {kind} {name} EXISTS")
        blocking += len(contradicted)
        print()
    checked = verified + len(contradicted) + unknown
    if checked == 0:
        print("    No claims carry a verify marker yet.")
        print("    Add one where a claim has a definite disproof:")
        print("      <!-- verify: table hydration_logs -->   <!-- verify: file src/x.tsx -->")
    else:
        print(f"    {verified} still true, {len(contradicted)} contradicted, {unknown} uncheckable.")

    print(f"\n  CLAIMS TO CONFIRM BY EYE  ({len(claims)})\n")
    print("    Nothing here is wrong. These are the sentences that CAN go stale,")
    print("    listed so somebody who knows the app can scan them in a minute -")
    print("    which is how all three of today's were actually caught.\n")
    current = None
    for rel, n, claim, ctx in claims:
        if rel != current:
            print(f"    {rel}")
            current = rel
        snippet = re.sub(r"\s+", " ", ctx)
        i = snippet.lower().find(claim.lower())
        snippet = snippet[max(0, i - 40):i + 80]
        print(f"      {n:>5}  \"{claim}\"  … {snippet}")

    print("\n" + "=" * 74)
    print(f"  {blocking} blocking item(s)." if blocking else "  Nothing blocking.")
    print("  The list above is not blocking and is the point of running this.")
    print("=" * 74 + "\n")
    return 1 if blocking else 0


if __name__ == "__main__":
    args = sys.argv[1:]
    session_arg = None
    if "--session" in args:
        session_arg = int(args[args.index("--session") + 1])
    sys.exit(main(session_arg))
