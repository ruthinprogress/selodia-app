"""The eighteen red flags, as a document Ruth can read and sign off.

    python scripts/red_flags_doc.py

WHY IT IS GENERATED AND NOT WRITTEN. Ruth, 6 October 2026: "where's the 18 red
flags - i can't see them so i can't read them." They have been sitting in
app/lib/red-flags.ts since they were built, behind a switch whose own comment
says they stay off until she has read them - and nobody ever put them anywhere
she could.

A HAND-TYPED COPY WOULD BE THE FAULT THIS PROJECT KEEPS HAVING. She would be
approving a document, and the app would run a list. This reads the actual array
and the actual wording, so what she signs off is what fires.
"""

import io
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(r"C:\Users\ruthi\unflump-app")
SRC = ROOT / "app" / "lib" / "red-flags.ts"
BUILD_SPECS = Path(r"H:\My Drive\Selodia App Project Master Folder\Build Specs")


def out_path(count: int) -> Path:
    """Named by the count, because the count changes.

    It was eighteen this morning and twenty by lunchtime. A document called "the
    eighteen" sitting beside a list of twenty is the kind of small untruth that
    makes somebody doubt the rest of it.

    A NEW FILE RATHER THAN AN OVERWRITE is also what makes this work while she has
    the previous one open in Word. The first regeneration failed on a locked file,
    and from where she sat it had simply not happened.
    """
    return BUILD_SPECS / f"2026-10-06 The {count} red flags - for Ruth to approve.docx"

# The array is TypeScript, so it is read by node rather than by a regex here.
READER = ROOT / "scripts" / "_read_red_flags.mjs"
READER.write_text(
    "const root = 'file://' + process.cwd().replace(/\\\\/g, '/');\n"
    "const m = await import(root + '/app/lib/red-flags.ts');\n"
    "console.log(JSON.stringify({ flags: m.RED_FLAGS, live: m.RED_FLAGS_LIVE }));\n",
    encoding="utf-8",
)
raw = subprocess.run(
    ["node", "--import", "./scripts/ts-resolve-hook.mjs", "scripts/_read_red_flags.mjs"],
    cwd=str(ROOT),
    capture_output=True,
    text=True,
)
line = [l for l in raw.stdout.splitlines() if l.startswith("{")]
if not line:
    raise SystemExit("could not read the flags:\n" + raw.stderr[-800:])
data = json.loads(line[0])
flags = data["flags"]
READER.unlink()

# The reply each urgency produces, read out of the same file.
src = SRC.read_text(encoding="utf-8")
lines = {}
for urgency in ("999", "111", "gp"):
    key = f"'{urgency}':" if urgency != "gp" else "gp:"
    at = src.index(key, src.index("const LINES"))
    quoted = re.search(r"'([^']+)'", src[at : at + 400])
    lines[urgency] = quoted.group(1)

third = re.search(r"const THIRD_PARTY = \[(.*?)\];", src, re.S).group(1)
third_party = re.findall(r"'([^']+)'", third)

HEADING = {
    "999": "Call 999 now",
    "111": "Call 111 today",
    "gp": "Book with your GP",
}

doc = []
doc.append(f"# The {len(flags)} red flags")
doc.append("")
doc.append("## Everything the app would say, and when. For you to approve, reject or change.")
doc.append("")
doc.append("### Generated from the code on 6 October 2026")
doc.append("")
doc.append("---")
doc.append("")
doc.append("## What this is")
doc.append("")
doc.append(
    "These are physical symptoms that, if you typed one into chat, would make Selod\u00eda stop "
    "whatever else it was saying and tell you to get help. They are **switched off right now** "
    "and have never run."
)
doc.append("")
doc.append(
    "The switch has two gates on it, written when it was built: **you reading this list, and a "
    "clinician reviewing it.** This document is the first gate. It has existed only as code "
    "until today, which is my fault, not yours."
)
doc.append("")
doc.append("**How it works, in three sentences.**")
doc.append("")
doc.append(
    "It matches your words, not clinical terms, so it looks for \"chest hurts\" rather than "
    "\"angina\". It is deterministic: the model cannot decide a flag does not apply, cannot be "
    "talked out of it, and cannot soften it. And it only reads your own message."
)
doc.append("")
doc.append(
    "**It will not fire when you are asking about somebody else.** These phrases switch it off: "
    + ", ".join(f"*{t}*" for t in third_party)
    + "."
)
doc.append("")
doc.append("---")
doc.append("")
doc.append("## What it would say")
doc.append("")
doc.append("Three lines, fixed, identical every time. No hedging and no extra alarm.")
doc.append("")
for urgency in ("999", "111", "gp"):
    doc.append(f"**{HEADING[urgency]}**")
    doc.append("")
    doc.append(f"> {lines[urgency]}")
    doc.append("")
doc.append("---")
doc.append("")

for urgency in ("999", "111", "gp"):
    group = [f for f in flags if f["urgency"] == urgency]
    doc.append(f"## {HEADING[urgency]} \u2014 {len(group)} of the {len(flags)}")
    doc.append("")
    for n, flag in enumerate(group, start=1):
        doc.append(f"**{n}. {flag['name']}**")
        doc.append("")
        doc.append("Fires on: " + "; ".join(f"\u201c{p}\u201d" for p in flag["phrases"]))
        if flag.get("notAbout"):
            doc.append("")
            doc.append(
                "Does not fire if the message also says: "
                + "; ".join(f"\u201c{p}\u201d" for p in flag["notAbout"])
            )
        doc.append("")
    doc.append("---")
    doc.append("")

doc.append("## What I need from you")
doc.append("")
doc.append("For each one, any of: **keep it**, **drop it**, **change the words it fires on**, or **change its urgency**.")
doc.append("")
doc.append(
    "You do not have to do all eighteen at once. The ones under **Call 999** are the ones worth "
    "your attention first, because they are the ones that interrupt."
)
doc.append("")
doc.append(
    "**And the second gate is still open.** Approving this list is you, not a clinician. I would "
    "rather ship with your approval and a note saying no clinician has read it than ship silently, "
    "but that is your call and I want it written down either way."
)
doc.append("")

md = ROOT / "scripts" / "_red_flags.md"
md.write_text("\n".join(doc), encoding="utf-8")

out = out_path(len(flags))
subprocess.run(
    ["python", "scripts/md2docx.py", str(md), str(out)],
    cwd=str(ROOT),
    check=True,
)
md.unlink()
print(f"  {len(flags)} flags")
print(f"  {out}")
