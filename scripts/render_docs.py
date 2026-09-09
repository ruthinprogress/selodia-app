"""Render the project's markdown into formats Ruth can actually read.

WHY THIS EXISTS. Ruth cannot read `.md` files. That is a fact about her setup,
not a preference — so every document written for her to *read* rather than for
a tool to consume has to exist as Word, or as a self-contained HTML page. The
markdown stays the source of truth; these are derived copies, regenerated
rather than hand-edited.

WHAT IT PRODUCES, all into the Drive folder:

  Build Specs/Spec Documents (Word)/*.docx       all SIX working documents
  Branding/Marketing Articles and Copy/*.docx    one per build-log article

Each .docx opens on a REAL CONTENTS PAGE of clickable internal links, not just
Word's Navigation Pane. The pane is a side panel someone has to know to switch
on (View > Navigation Pane); a contents page is simply there when the document
opens. Both work, and only one of them works without being told about it.

An HTML reader was built alongside these on 2026-09-08 and REMOVED on 09-09.
It was written when Word was not yet on the table, and once all five documents
rendered as Word it was a second format of one document — the exact duplication
that rots quietly while nobody is looking at it.

EVERY working document, not just the specification. The first version rendered
only the spec, because that was the one being asked about — leaving four others
as markdown Ruth still could not open, including the language rules the whole
safety architecture is built from. Four unreadable documents is the same defect
as five; the count was never the point. The brand and marketing spec joined on
09-09 for the same reason, having been readable by nobody since it was written.

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

import re
import subprocess
import sys
from pathlib import Path

try:
    from docx import Document
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.enum.text import WD_BREAK
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Inches, Pt, RGBColor
except ImportError:
    sys.exit("render_docs: python-docx is not installed.  pip install python-docx")

REPO = Path(__file__).resolve().parents[1]
MOBILE = REPO / "mobile"

# The working documents, each with the subtitle its cover carries. Repo and
# Drive names differ deliberately (WORKFLOW.md, "Note the filenames still
# differ"), and the Word name is a third form again — a title, not a filename,
# because this is the copy meant to be read rather than synced.
#
# SELODIA_MARKETING_SPEC.md joined on 2026-09-09. It had been living only in
# Drive, under Branding, so it was version-controlled nowhere and rendered
# never. Its markdown is now in the repo like the other five; the Branding
# copy is archived rather than deleted, because deleting the only source of a
# document to tidy up its output is not a trade worth making.
#
# ADDING A SEVENTH: put it here. That is the whole change — the contents
# page, the styles and the close-out step all follow from this table.
DOCUMENTS = [
    ("SELODIA_SPEC.md", "Selodia Build Specification",
     "Build Specification", "What the product is and how it works"),
    ("WORKFLOW.md", "Selodia Workflow",
     "Workflow & Collaboration Process", "How Ruth, Claude and Claude Code actually work together"),
    ("SELODIA_LANGUAGE_RULES.md", "Selodia MI Language Rules",
     "Language Rules: Emotionally Open Moments", "The MI-grounded safety-boundary language"),
    ("SAFETY_ARCHITECTURE.md", "Selodia Safety Architecture",
     "Safety State Machine", "Engineering design for the distress classification"),
    ("DECISION_PATTERNS.md", "Selodia Decision Patterns",
     "Ruth's Decision Patterns", "Observed patterns in how the decisions actually get made"),
    ("SELODIA_MARKETING_SPEC.md", "Selodia Brand and Marketing Spec",
     "Brand & Marketing Spec", "For designers, copywriters and collaborators"),
]

# The synced Drive folder. A remotely-executed session has no H: drive at all
# (WORKFLOW.md, "Where the session is EXECUTING"), so this is checked rather
# than assumed — the ceremony must say plainly that it could not write, never
# appear to succeed.
DRIVE = Path(r"H:\My Drive\Selodia App Project Master Folder\Build Specs")

# The Word copies go in their own folder rather than loose in Build Specs,
# where they sat among the close-out workbook and the build log and were hard
# to pick out (Ruth, 2026-09-09: "I want them to live inside the build spec
# folder, not loose"). Deliberately NOT inside `Claude Code Working Build
# Specs`: that folder runs one file per document, and a .docx beside its own
# .md is exactly the duplication that rule prevents.
WORD = DRIVE / "Spec Documents (Word)"
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


def _bookmark(paragraph, name: str, bid: int) -> None:
    """Mark a heading so a contents link can point at it."""
    start = OxmlElement("w:bookmarkStart")
    start.set(qn("w:id"), str(bid))
    start.set(qn("w:name"), name)
    end = OxmlElement("w:bookmarkEnd")
    end.set(qn("w:id"), str(bid))
    paragraph._p.insert(0, start)
    paragraph._p.append(end)


def _link(paragraph, text: str, anchor: str, size: float,
          colour: RGBColor, bold: bool = False) -> None:
    """An internal hyperlink to a bookmark, built as raw XML.

    python-docx has no API for this. Deliberately NOT a TOC field: a field
    renders as "Right-click to update" until someone does, and prints page
    numbers that are wrong the moment anything reflows. A list of live links
    is correct the instant the file is written and needs nothing from the
    reader.
    """
    h = OxmlElement("w:hyperlink")
    h.set(qn("w:anchor"), anchor)
    run = OxmlElement("w:r")
    rpr = OxmlElement("w:rPr")
    rfonts = OxmlElement("w:rFonts")
    rfonts.set(qn("w:ascii"), BODY_FACE)
    rfonts.set(qn("w:hAnsi"), BODY_FACE)
    rpr.append(rfonts)
    if bold:
        rpr.append(OxmlElement("w:b"))
    col = OxmlElement("w:color")
    col.set(qn("w:val"), str(colour))
    rpr.append(col)
    sz = OxmlElement("w:sz")
    sz.set(qn("w:val"), str(int(size * 2)))  # half-points
    rpr.append(sz)
    run.append(rpr)
    t = OxmlElement("w:t")
    t.text = text
    t.set(qn("xml:space"), "preserve")
    run.append(t)
    h.append(run)
    paragraph._p.append(h)


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


def markdown_body(doc, md: str, headings=None) -> None:
    """Headings, paragraphs, lists, tables, quotes and fenced code into Word.

    When `headings` is given, every H1 and H2 is bookmarked and recorded, so
    the contents page can link straight to it.
    """
    lines = md.replace("\r\n", "\n").split("\n")
    i, in_code, code_buf = 0, False, []
    bid = 100

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
            text = line.lstrip("#").strip().replace("**", "")
            par = doc.add_heading(text, min(level, 4))
            if headings is not None and level <= 2:
                bid += 1
                anchor = "sec%d" % bid
                _bookmark(par, anchor, bid)
                headings.append((level, text, anchor))
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
# 1. the five working documents, as Word
# --------------------------------------------------------------------------

def render_docx(source: Path, out_name: str, subtitle: str, blurb: str,
                commit: str) -> Path:
    md = source.read_text(encoding="utf-8")
    doc = Document()
    base_styles(doc)
    for s in doc.sections:
        s.left_margin = s.right_margin = Inches(1.0)

    centred(doc, "selodía", 34, CHARCOAL)
    centred(doc, subtitle, 16, TERRACOTTA)
    centred(doc, blurb, 10.5, FOREST, italic=True)
    # The commit stamp is the point, not the flourish: this document's own
    # recurring defect is stale status, and "which version is this" is the
    # question that catches it.
    centred(doc, f"Generated from commit {commit}  ·  {len(md.split()):,} words",
            9, GREY)
    centred(doc, "View \u203a Navigation Pane for a clickable contents tree",
            9, GREY, italic=True)
    doc.add_page_break()

    # Where the contents page has to land: straight after the cover's page
    # break, before a single line of the document itself.
    insert_at = len(doc.element.body)

    headings = []
    markdown_body(doc, md, headings)

    if headings:
        made = []
        h = doc.add_paragraph()
        r = h.add_run("Contents")
        r.font.size = Pt(15)
        r.bold = True
        r.font.color.rgb = FOREST
        h.paragraph_format.space_after = Pt(10)
        made.append(h)

        for level, text, anchor in headings:
            par = doc.add_paragraph()
            par.paragraph_format.space_after = Pt(2 if level == 2 else 6)
            par.paragraph_format.space_before = Pt(8 if level == 1 else 0)
            if level == 2:
                par.paragraph_format.left_indent = Inches(0.28)
            _link(par, text, anchor,
                  size=11 if level == 1 else 10,
                  colour=TERRACOTTA if level == 1 else CHARCOAL,
                  bold=level == 1)
            made.append(par)

        brk = doc.add_paragraph()
        brk.add_run().add_break(WD_BREAK.PAGE)
        made.append(brk)

        # Built at the end because the anchors do not exist until the body
        # has been written, then moved to the front. Reinserting in order
        # keeps the contents reading top to bottom rather than reversed.
        for offset, par in enumerate(made):
            doc.element.body.remove(par._p)
            doc.element.body.insert(insert_at + offset, par._p)

    out = WORD / f"{out_name}.docx"
    doc.save(out)
    return out


# --------------------------------------------------------------------------
# 2. the build-log articles, as Word, named by date
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

    WORD.mkdir(parents=True, exist_ok=True)
    commit = commit_hash()
    print(f"  commit {commit}")
    for filename, out_name, subtitle, blurb in DOCUMENTS:
        source = MOBILE / filename
        if not source.is_file():
            print(f"    MISSING, not rendered: {filename}")
            continue
        print(f"    {render_docx(source, out_name, subtitle, blurb, commit).name}")
    for p in render_articles():
        print(f"    {p.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
