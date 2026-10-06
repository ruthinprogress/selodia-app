"""The before and after, as a document, from the probe's own output.

    node --import ./scripts/ts-resolve-hook.mjs scripts/probe-deflection.mjs > out.txt
    python scripts/deflection_doc.py out.txt

WHY IT IS BUILT FROM THE OUTPUT AND NOT RETYPED. The whole value of a before and
after is that it is what the model actually said. A version I summarised would be
a claim about the change rather than evidence of it, and this week has already
produced four faults of exactly that shape.
"""

import io
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(r"C:\Users\ruthi\unflump-app")
OUT = Path(
    r"H:\My Drive\Selodia App Project Master Folder\Build Specs"
    r"\2026-10-06 Healthcare replies - before and after the deflection rule.docx"
)

raw = Path(sys.argv[1]).read_text(encoding="utf-8")

# The probe prints a banner per case and per side; split on those.
blocks = []
current_case = "Her screenshot: They don't actually know anything"
current_said = (
    "Asked about her saturated fat against a cholesterol flag, then: "
    "\u201cThey don't actually know anything.\u201d"
)
side = None
buf = []


def flush():
    if side and buf:
        text = "\n".join(buf).strip()
        if text:
            blocks.append((current_case, current_said, side, text))


for line in raw.split("\n"):
    if line.startswith("#" * 10):
        continue
    header = re.match(r"^\s{2}([A-Z][A-Z ,'\-]+)$", line)
    if header and header.group(1).strip() not in ("BEFORE", "AFTER"):
        flush()
        buf = []
        side = None
        current_case = header.group(1).strip().title()
        continue
    quoted = re.match(r'^\s{2}"(.+)"$', line)
    if quoted:
        current_said = quoted.group(1)
        continue
    if line.startswith("=" * 10):
        continue
    marker = re.match(r"^\s{2}(BEFORE|AFTER)\b(.*)$", line)
    if marker:
        flush()
        buf = []
        side = marker.group(1)
        continue
    if side:
        buf.append(line)
flush()

doc = []
doc.append("# Healthcare replies, before and after")
doc.append("")
doc.append("## The same message, the same model, one block of the prompt different")
doc.append("")
doc.append("### 6 October 2026")
doc.append("")
doc.append("---")
doc.append("")
doc.append("## What changed")
doc.append("")
doc.append("The prompt used to carry this sentence:")
doc.append("")
doc.append(
    "> You are not a clinician and this is not a medical service. Where something is "
    "genuinely medical, say what is in their record and suggest they take it to their "
    "GP, without alarm and without diagnosis."
)
doc.append("")
doc.append(
    "It is replaced by your Health section, in the first person, with only the "
    "capabilities that exist. Everything else in both runs is identical."
)
doc.append("")
doc.append("**Two honest limits.** One run each, not an average. And this isolates the rule: "
           "there is no food log, no Me tab and no history in these prompts, so it is "
           "evidence about the rule rather than a prediction of every reply.")
doc.append("")
doc.append("---")
doc.append("")

seen = []
for case, said, which, text in blocks:
    if (case, said) not in seen:
        seen.append((case, said))
        doc.append(f"## {case}")
        doc.append("")
        doc.append(f"*\u201c{said}\u201d*")
        doc.append("")
    doc.append(f"**{which}**")
    doc.append("")
    for para in text.split("\n"):
        if para.strip():
            doc.append(f"> {para.strip()}")
            doc.append(">")
    if doc[-1] == ">":
        doc.pop()
    doc.append("")

doc.append("---")
doc.append("")
doc.append("## What to look for")
doc.append("")
doc.append(
    "The change is not politeness. In every BEFORE the reply **ends**: it states a "
    "limit and hands you on. In every AFTER it **continues**: it asks something, or "
    "offers to keep something, or names the next small thing."
)
doc.append("")
doc.append(
    "**And one case where it barely changes.** Finding an NHS number was answered "
    "well by both, because nothing in that message invited a deflection. The fix "
    "matters where the old rule was being triggered, not everywhere, and a document "
    "showing seven dramatic improvements would be a document that had been curated."
)
doc.append("")

md = ROOT / "scripts" / "_deflection.md"
md.write_text("\n".join(doc), encoding="utf-8")
subprocess.run(["python", "scripts/md2docx.py", str(md), str(OUT)], cwd=str(ROOT), check=True)
md.unlink()
print(f"  {len(seen)} cases")
print(f"  {OUT}")
