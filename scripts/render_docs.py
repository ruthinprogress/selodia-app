"""Render the project's markdown into formats Ruth can actually read.

WHY THIS EXISTS. Ruth cannot read `.md` files. That is a fact about her setup,
not a preference — so every document written for her to *read* rather than for
a tool to consume has to exist as Word, or as a self-contained HTML page. The
markdown stays the source of truth; these are derived copies, regenerated
rather than hand-edited.

WHAT IT PRODUCES, all into the Drive folder:

  Build Specs/Selodia Build Specification.docx   the spec, Word
  Build Specs/Selodia Build Specification.html   the spec, browser reader
  Branding/Marketing Articles and Copy/*.docx    one per build-log article

RUN IT AT SESSION CLOSE-OUT, after the Drive sync and before the final push
(WORKFLOW.md, Automated close-out). A stale rendering of a document whose
recurring defect is stale status claims is worse than no rendering at all,
which is why every output stamps the commit it was generated from.

    python scripts/render_docs.py

Needs `python-docx`. If it is missing the script says so and stops rather than
half-rendering.

NOT into `Claude Code Working Build Specs/`. That folder holds exactly five
documents and the close-out verifies all five byte-identical against the repo;
a sixth file in it breaks that check. Derived renderings go one level up.
"""

from __future__ import annotations

import base64
import re
import subprocess
import sys
from pathlib import Path

try:
    from docx import Document
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Inches, Pt, RGBColor
except ImportError:
    sys.exit("render_docs: python-docx is not installed.  pip install python-docx")

REPO = Path(__file__).resolve().parents[1]
SPEC = REPO / "mobile" / "SELODIA_SPEC.md"

# The synced Drive folder. A remotely-executed session has no H: drive at all
# (WORKFLOW.md, "Where the session is EXECUTING"), so this is checked rather
# than assumed — the ceremony must say plainly that it could not write, never
# appear to succeed.
DRIVE = Path(r"H:\My Drive\Selodia App Project Master Folder\Build Specs")
ARTICLES = DRIVE / "Branding" / "Marketing Articles and Copy"

# Part Fifteen's locked palette.
CHARCOAL = RGBColor(0x2D, 0x2B, 0x28)
TERRACOTTA = RGBColor(0x87, 0x4C, 0x3A)
FOREST = RGBColor(0x37, 0x58, 0x4A)
GREY = RGBColor(0x5F, 0x57, 0x4D)

# Comfortaa is the brand face but is not installed as a system font, so Word
# would silently fall back. Georgia is chosen rather than fallen into.
BODY_FACE = "Georgia"
MONO_FACE = "Consolas"

MONTHS = {m: i for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July",
     "August", "September", "October", "November", "December"], 1)}

INLINE = re.compile(r"(\*\*.+?\*\*|\*[^*]+?\*|`[^`]+?`|~~.+?~~)", re.S)


def commit_hash() -> str:
    out = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=REPO,
                         capture_output=True, text=True)
    return out.stdout.strip() or "unknown"


def add_runs(par, text: str) -> None:
    """Bold / italic / code / strikethrough as real runs, not literal markers."""
    for piece in INLINE.split(text):
        if not piece:
            continue
        if piece.startswith("**") and piece.endswith("**") and len(piece) > 4:
            par.add_run(piece[2:-2]).bold = True
        elif piece.startswith("~~") and piece.endswith("~~") and len(piece) > 4:
            # Recursive, because strikethrough wraps bold in this project — a
            # struck-out defect heading. Handling it flat left the inner `**`
            # sitting in the text as literal asterisks.
            first = len(par.runs)
            add_runs(par, piece[2:-2])
            for r in par.runs[first:]:
                r.font.strike = True
        elif piece.startswith("`") and piece.endswith("`") and len(piece) > 2:
            r = par.add_run(piece[1:-1])
            r.font.name = MONO_FACE
            r.font.size = Pt(9.5)
        elif piece.startswith("*") and piece.endswith("*") and len(piece) > 2:
            par.add_run(piece[1:-1]).italic = True
        else:
            par.add_run(piece)


def base_styles(doc, body_pt: float = 10.5) -> None:
    n = doc.styles["Normal"]
    n.font.name = BODY_FACE
    n.font.size = Pt(body_pt)
    n.font.color.rgb = CHARCOAL
    n.paragraph_format.space_after = Pt(8)
    n.paragraph_format.line_spacing = 1.2
    # REAL heading styles, and this is the whole point rather than decoration:
    # Word builds its Navigation Pane from them, which is what turns 52,000
    # words into something navigable instead of something to scroll.
    for name, size, colour, before in (
        ("Heading 1", 19, TERRACOTTA, 26),
        ("Heading 2", 15, FOREST, 18),
        ("Heading 3", 12.5, CHARCOAL, 13),
        ("Heading 4", 11, GREY, 11),
    ):
        st = doc.styles[name]
        st.font.name = BODY_FACE
        st.font.size = Pt(size)
        st.font.bold = True
        st.font.color.rgb = colour
        st.paragraph_format.space_before = Pt(before)
        st.paragraph_format.space_after = Pt(4)
        st.paragraph_format.keep_with_next = True


def centred(doc, text, size, colour, italic=False):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(text)
    r.font.size = Pt(size)
    r.font.color.rgb = colour
    r.italic = italic
    return p


def _is_table_row(line: str) -> bool:
    return line.startswith("|") and line.endswith("|")


def markdown_body(doc, md: str) -> None:
    """Headings, paragraphs, lists, tables, quotes and fenced code into Word."""
    lines = md.replace("\r\n", "\n").split("\n")
    i, in_code, code_buf = 0, False, []

    while i < len(lines):
        line = lines[i].rstrip()

        if line.startswith("```"):
            if in_code:
                p = doc.add_paragraph()
                r = p.add_run("\n".join(code_buf))
                r.font.name = MONO_FACE
                r.font.size = Pt(9)
                p.paragraph_format.left_indent = Inches(0.3)
                code_buf, in_code = [], False
            else:
                in_code = True
            i += 1
            continue
        if in_code:
            code_buf.append(lines[i])
            i += 1
            continue

        if not line.strip():
            i += 1
            continue

        if line.startswith("#"):
            level = len(line) - len(line.lstrip("#"))
            doc.add_heading(line.lstrip("#").strip().replace("**", ""), min(level, 4))
            i += 1
            continue

        if set(line.strip()) <= {"-", "*", "_"} and len(line.strip()) >= 3:
            i += 1  # horizontal rule
            continue

        if _is_table_row(line):
            rows = []
            while i < len(lines) and _is_table_row(lines[i].rstrip()):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                # Skip the |---|---| separator, never a real row.
                if not all(c and set(c) <= {"-", ":", " "} for c in cells):
                    rows.append(cells)
                i += 1
            if rows:
                width = max(len(r) for r in rows)
                tb = doc.add_table(rows=0, cols=width)
                tb.style = "Table Grid"
                tb.alignment = WD_TABLE_ALIGNMENT.CENTER
                for n, cells in enumerate(rows):
                    wrow = tb.add_row().cells
                    for cell, text in zip(wrow, cells + [""] * (width - len(cells))):
                        cell.paragraphs[0].text = ""
                        add_runs(cell.paragraphs[0], text)
                        for run in cell.paragraphs[0].runs:
                            run.font.size = Pt(9)
                            if n == 0:
                                run.bold = True
                doc.add_paragraph()
            continue

        if line.startswith(">"):
            p = doc.add_paragraph()
            add_runs(p, line.lstrip(">").strip())
            p.paragraph_format.left_indent = Inches(0.35)
            for r in p.runs:
                r.font.color.rgb = GREY
                r.italic = True
            i += 1
            continue

        m = re.match(r"^(\s*)([-*+]|\d+[.)])\s+(.*)$", line)
        if m:
            indent, marker, body = m.groups()
            p = doc.add_paragraph(
                style="List Number" if marker[0].isdigit() else "List Bullet")
            add_runs(p, body)
            if len(indent) >= 2:
                p.paragraph_format.left_indent = Inches(0.55)
            i += 1
            continue

        add_runs(doc.add_paragraph(), line.strip())
        i += 1


# --------------------------------------------------------------------------
# 1. the spec, as Word
# --------------------------------------------------------------------------

def render_spec_docx(commit: str) -> Path:
    md = SPEC.read_text(encoding="utf-8")
    doc = Document()
    base_styles(doc)
    for s in doc.sections:
        s.left_margin = s.right_margin = Inches(1.0)

    centred(doc, "selodía", 34, CHARCOAL)
    centred(doc, "Build Specification", 16, TERRACOTTA)
    centred(doc, "A body literacy app for women 40+", 10.5, FOREST, italic=True)
    # The commit stamp is the point, not the flourish: this document's own
    # recurring defect is stale status, and "which version is this" is the
    # question that catches it.
    centred(doc, f"Generated from commit {commit}  ·  {len(md.split()):,} words",
            9, GREY)
    centred(doc, "View \u203a Navigation Pane for a clickable contents tree",
            9, GREY, italic=True)
    doc.add_page_break()

    markdown_body(doc, md)
    out = DRIVE / "Selodia Build Specification.docx"
    doc.save(out)
    return out


# --------------------------------------------------------------------------
# 2. the spec, as a self-contained browser reader
# --------------------------------------------------------------------------

READER_TEMPLATE = (Path(__file__).resolve().parent / "spec_reader_template.html")


def render_spec_html(commit: str) -> Path:
    md = SPEC.read_text(encoding="utf-8")
    # Base64 rather than inlining the text: the spec is full of angle brackets,
    # backticks and accented characters, and encoding sidesteps every escaping
    # question at once instead of handling them one at a time.
    payload = base64.b64encode(md.encode("utf-8")).decode("ascii")
    html = (READER_TEMPLATE.read_text(encoding="utf-8")
            .replace("__PAYLOAD__", payload)
            .replace("__COMMIT__", commit)
            .replace("__KB__", f"{len(md.encode('utf-8')) / 1024:.0f}")
            .replace("__WORDS__", f"{len(md.split()):,}")
            .replace("__PARTS__", str(md.count("\n# "))))
    out = DRIVE / "Selodia Build Specification.html"
    out.write_text(html, encoding="utf-8", newline="")
    return out


# --------------------------------------------------------------------------
# 3. the build-log articles, as Word, named by date
# --------------------------------------------------------------------------

def render_articles() -> list[Path]:
    """One .docx per article, `YYYY-MM-DD Title.docx` — date only, no numbering."""
    if not ARTICLES.is_dir():
        return []
    written = []
    for src in sorted(ARTICLES.glob("*.md")):
        # A reference doc, not an article.
        if src.name == "Selodia-Brand-Marketing-Spec.md":
            continue
        lines = src.read_text(encoding="utf-8").replace("\r\n", "\n").split("\n")
        title = date_human = None
        start = 0
        for n, raw in enumerate(lines[:6]):
            s = raw.strip()
            if not s:
                continue
            if title is None:
                m = re.match(r"^#\s+(.*)$", s) or re.match(r"^\*\*(.*?)\*\*$", s)
                if m:
                    title = m.group(1).strip()
                    continue
            if date_human is None:
                m = re.match(r"^\*(.+?)\*$", s)
                if m:
                    date_human = m.group(1).strip()
                    start = n + 1
                    continue
        if not title or not date_human:
            print(f"    skipped (no title/date header): {src.name}")
            continue
        m = re.match(r"^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$", date_human)
        if not m:
            print(f"    skipped (unparseable date {date_human!r}): {src.name}")
            continue
        iso = f"{int(m.group(3)):04d}-{MONTHS[m.group(2)]:02d}-{int(m.group(1)):02d}"

        doc = Document()
        base_styles(doc, body_pt=11)
        h = doc.add_paragraph()
        r = h.add_run(title)
        r.font.size = Pt(20)
        r.bold = True
        r.font.color.rgb = TERRACOTTA
        h.paragraph_format.space_after = Pt(2)
        d = doc.add_paragraph()
        r = d.add_run(date_human)
        r.font.size = Pt(10)
        r.italic = True
        r.font.color.rgb = CHARCOAL
        d.paragraph_format.space_after = Pt(18)

        markdown_body(doc, "\n".join(lines[start:]))
        out = ARTICLES / f"{iso} {title}.docx"
        doc.save(out)
        written.append(out)
    return written


def main() -> int:
    if not DRIVE.is_dir():
        print("render_docs: the Drive folder is not reachable.")
        print(f"  expected: {DRIVE}")
        print("  A remotely-executed session has no H: drive (see WORKFLOW.md).")
        print("  Nothing was written. Say so plainly at close-out rather than")
        print("  reporting a sync that did not happen.")
        return 1

    commit = commit_hash()
    print(f"  commit {commit}")
    print(f"    {render_spec_docx(commit).name}")
    print(f"    {render_spec_html(commit).name}")
    for p in render_articles():
        print(f"    {p.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
