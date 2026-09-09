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
"""

import io
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SYNCED = Path(r"H:\My Drive\Selodia App Project Master Folder\Build Specs"
              r"\Claude Code Working Build Specs")

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


def main():
    blocking = 0
    print("\n" + "=" * 74)
    print("  CLOSE-OUT CHECK")
    print("=" * 74)

    print("\n  GIT\n")
    dirty, ahead = sh("git", "status", "--porcelain"), sh("git", "log", "--oneline", "origin/main..HEAD")
    print(f"    working tree      {'DIRTY' if dirty else 'clean'}")
    print(f"    pushed            {'NO (' + str(len(ahead.splitlines())) + ' unpushed)' if ahead else 'yes'}")
    print(f"    head              {sh('git', 'log', '--oneline', '-1')}")
    blocking += bool(dirty) + bool(ahead)

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
    sys.exit(main())
